import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors, type RawBodyRequest } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import {
  KYC_MAX_BYTES,
  cardIntentSchema,
  depositChannelsSchema,
  depositRequestSchema,
  paginationSchema,
  paymentDecisionSchema,
  withdrawRequestSchema,
  type CardIntentInput,
  type DepositChannels,
  type DepositRequestInput,
  type PaymentDecisionInput,
  type WithdrawRequestInput,
} from '@spova/shared';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { ClientIp, CurrentUser, Public, Roles } from '../../common/auth/decorators';
import { ADMIN_ROLES, type AuthUser } from '../../common/auth/auth.types';
import { ApiError } from '../../common/errors';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const listQuery = paginationSchema.extend({
  kind: z.enum(['deposit', 'withdraw']).optional(),
  status: z.enum(['pending', 'approved', 'declined', 'cancelled']).optional(),
});
const adminQuery = listQuery.extend({ userId: z.string().uuid().optional() });

/** Streams a payment slip with headers that stop the browser from executing it. */
async function streamProof(res: Response, svc: PaymentsService, id: string, requester: { id: string; isAdmin: boolean }) {
  const { name, mime, stored } = await svc.proof(id, requester);
  res.setHeader('Content-Type', mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${name.replace(/[^\w.\- ]/g, '_')}"`);
  if (stored.size) res.setHeader('Content-Length', String(stored.size));
  stored.body.pipe(res);
}

@Controller('me/payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly stripe: StripeService,
  ) {}

  @Get('methods')
  methods() {
    return this.payments.methods(this.stripe.configured ? { provider: 'stripe', publishableKey: this.stripe.publishableKey } : null);
  }

  /** Legal footer + USD -> local currency rates for the cashier. */
  @Get('cashier')
  cashier() {
    return this.payments.cashierInfo();
  }

  /** Card deposit: opens the request and returns the gateway client secret for the browser to confirm the card. */
  @Post('card/intent')
  cardIntent(@CurrentUser() user: AuthUser, @Body(new ZodPipe(cardIntentSchema)) body: CardIntentInput) {
    return this.stripe.createIntent(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.payments.list(user.id, q);
  }

  @Post('deposit')
  deposit(@CurrentUser() user: AuthUser, @Body(new ZodPipe(depositRequestSchema)) body: DepositRequestInput) {
    return this.payments.deposit(user.id, body);
  }

  @Post('withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Body(new ZodPipe(withdrawRequestSchema)) body: WithdrawRequestInput) {
    return this.payments.withdraw(user.id, body);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.cancel(user.id, id);
  }

  /** multipart/form-data with one `file` (jpg/png/webp/pdf, max 10 MB): the payment slip / screenshot. */
  @Post(':id/proof')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: KYC_MAX_BYTES, files: 1 } }))
  proof(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw ApiError.badRequest('file_missing', 'Attach a file');
    return this.payments.attachProof(user.id, id, file);
  }

  @Get(':id/proof')
  proofFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return streamProof(res, this.payments, id, { id: user.id, isAdmin: ADMIN_ROLES.includes(user.role) });
  }
}

/** Gateway callbacks. No session: authenticity comes from the provider's signature over the raw body. */
@Controller('payments/webhooks')
@Public()
export class PaymentsWebhookController {
  constructor(private readonly stripe: StripeService) {}

  @Post('stripe')
  stripeHook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.stripe.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
  }
}

@Controller('admin/payments')
@Roles('admin', 'superadmin')
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  queue(@Query(new ZodPipe(adminQuery)) q: z.infer<typeof adminQuery>) {
    return this.payments.queue(q);
  }

  /** Deposit channels (bank / UPI / Binance Pay / USDT / card) shown to clients. */
  @Get('channels')
  channels() {
    return this.payments.channels();
  }

  @Put('channels')
  setChannels(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Body(new ZodPipe(depositChannelsSchema)) body: DepositChannels) {
    return this.payments.setChannels({ id: actor.id, ip }, body);
  }

  @Get(':id/proof')
  proofFile(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    return streamProof(res, this.payments, id, { id: user.id, isAdmin: true });
  }

  @Patch(':id')
  decide(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(paymentDecisionSchema)) body: PaymentDecisionInput) {
    return this.payments.decide({ id: actor.id, ip }, id, body);
  }
}
