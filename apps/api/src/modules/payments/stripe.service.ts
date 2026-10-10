import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type { CardIntentDto, CardIntentInput } from '@spova/shared';
import { env } from '../../config/env';
import { ApiError } from '../../common/errors';
import { PrismaService } from '../../infra/prisma.service';
import { PaymentsService } from './payments.service';
import { D } from '../../common/money';

/**
 * Card deposits through Stripe (reference gateway; any PSP with a hosted/element checkout + webhook fits the same shape).
 * Flow: client asks for an intent -> we create a pending deposit request + PaymentIntent -> the browser confirms the card
 * with Stripe.js (card data never touches us) -> Stripe's webhook settles the request through the ledger.
 */
@Injectable()
export class StripeService {
  private readonly log = new Logger('Stripe');
  private readonly stripe: Stripe | null = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' }) : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  get configured() {
    return !!this.stripe && !!env.STRIPE_PUBLISHABLE_KEY;
  }

  get publishableKey() {
    return env.STRIPE_PUBLISHABLE_KEY;
  }

  async createIntent(userId: string, input: CardIntentInput): Promise<CardIntentDto> {
    if (!this.stripe || !this.configured) throw ApiError.unavailable('gateway_not_configured', 'Card payments are not connected yet');
    const req = await this.payments.openCardRequest(userId, input);
    const cents = D(req.amount).mul(100).toDecimalPlaces(0).toNumber();
    try {
      const pi = await this.stripe.paymentIntents.create(
        {
          amount: cents,
          currency: req.currency.toLowerCase(),
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          description: `Deposit #${req.id.slice(0, 8)} account ${req.accountLogin}`,
          metadata: { requestId: req.id, userId, accountLogin: String(req.accountLogin) },
        },
        { idempotencyKey: `deposit-${req.id}` },
      );
      await this.prisma.paymentRequest.update({ where: { id: req.id }, data: { reference: pi.id } });
      return { requestId: req.id, provider: 'stripe', clientSecret: pi.client_secret! };
    } catch (e) {
      await this.prisma.paymentRequest.update({ where: { id: req.id }, data: { status: 'cancelled', adminNote: 'Gateway error before payment', decidedAt: new Date() } }).catch(() => undefined);
      this.log.error({ err: (e as Error).message }, 'payment intent failed');
      throw ApiError.unavailable('gateway_error', 'The card gateway did not accept the request. Try again later.');
    }
  }

  /** Stripe -> us. Signature-checked with the webhook secret; events for unknown or already decided requests are ignored. */
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ received: true; handled: string }> {
    if (!this.stripe || !env.STRIPE_WEBHOOK_SECRET) throw ApiError.unavailable('gateway_not_configured', 'Card payments are not connected yet');
    if (!signature) throw ApiError.badRequest('signature_missing', 'Missing Stripe-Signature header');
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      throw ApiError.badRequest('signature_invalid', `Webhook signature verification failed: ${(e as Error).message}`);
    }
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const requestId = pi.metadata?.requestId;
      if (!requestId) return { received: true, handled: 'no-request' };
      if (event.type === 'payment_intent.succeeded') {
        const paid = D(pi.amount_received).div(100);
        await this.payments.settleByGateway(requestId, { provider: 'stripe', reference: pi.id, paidAmount: paid.toFixed(2), currency: pi.currency.toUpperCase() });
      } else {
        const reason = pi.last_payment_error?.message ?? (event.type === 'payment_intent.canceled' ? 'Payment cancelled' : 'Card declined');
        await this.payments.failByGateway(requestId, { provider: 'stripe', reference: pi.id, reason });
      }
      return { received: true, handled: event.type };
    }
    return { received: true, handled: 'ignored' };
  }
}
