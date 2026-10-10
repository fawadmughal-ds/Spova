# Card and cashier payments

The deposit page is a cashier like MatchTrader's: **Main Payment** (card, UPI, local bank) and
**Alternative payment** (Binance Pay, USDT). Bank / UPI / Binance / USDT are manual: the client gets the
pay-to details and a QR, pays, uploads the receipt, the back office approves. **Cards are automatic**: the
browser hands the card to the gateway, the gateway tells our API by webhook, the API credits the account
through the ledger in the same second. Nobody at the broker touches card numbers (no PCI scope).

## 1. The hard part: a provider that accepts a CFD broker
Stripe, PayPal, Razorpay, PayU and the usual gateways **ban forex / CFD trading** in their terms. They may
approve the account at signup and freeze the money later. Brokers use *high-risk* providers:

| Type | Names | Notes |
|---|---|---|
| Cashier aggregators (one contract, many PSPs) | Praxis Cashier, BridgerPay, PayPound | What Spova's cashier is built on. Cards + UPI + local banking + crypto in one approval. |
| Direct high-risk acquirers | Nuvei, Unlimit, Paysafe, eMerchantPay, Payabl, Decta | Cards only; you integrate each one. |
| Crypto on-ramps | CryptoPayx, NOWPayments, CoinPayments | Accept cards for USDT purchase that lands in your wallet. |

They ask for: registered company, **broker licence / registration** (Seychelles FSA, Mauritius FSC,
Labuan, Comoros/Anjouan like Spova's "L15955/MT"), director IDs, bank account, website with risk warning,
terms, refund policy and KYC. Terms are typically a setup fee (500 to 3,000 USD), 3 to 6 % per deposit, a
5 to 10 % rolling reserve for 6 months, chargeback limits. Approval takes 2 to 6 weeks.

## 2. What is built (works with any of them)
- `POST /me/payments/card/intent` opens a pending deposit and asks the gateway for a client secret.
- The browser confirms the card with the gateway's own fields (Stripe Elements today).
- `POST /payments/webhooks/stripe` receives the result, checks the signature, and settles: ledger entry,
  request approved, client notified, admin audit row `payment.gateway.settle`. Declines close the request
  with the reason. Everything is idempotent (a replayed webhook does nothing).
- Admin sees card deposits in the payments queue with the gateway reference.
Swapping provider = one adapter file (`apps/api/src/modules/payments/stripe.service.ts` is the template):
create-intent, verify-webhook, map events. Praxis / BridgerPay use a hosted page instead of inline fields:
the adapter returns a redirect URL and the cashier opens it.

## 3. Stripe step by step (test mode works today, no approval needed)
Use this to run and demo the full card flow now; for production you need a provider from section 1 (or a
Stripe account approved for your business category, which Stripe normally refuses for CFDs).
1. https://dashboard.stripe.com/register -> create account (email, password, country of the company).
2. Toggle **Test mode** (top right). Go to **Developers -> API keys**.
   - **Publishable key** `pk_test_...` -> `STRIPE_PUBLISHABLE_KEY`
   - **Secret key** `sk_test_...` -> `STRIPE_SECRET_KEY`
3. **Developers -> Webhooks -> Add endpoint**. URL: `https://api.yourdomain.com/v1/payments/webhooks/stripe`.
   Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`.
   Copy the **Signing secret** `whsec_...` -> `STRIPE_WEBHOOK_SECRET`.
4. Put the three values in the API service's environment (Render -> spova-api -> Environment) and redeploy.
   The card tile switches from "payment link" mode to live card fields automatically.
5. Test card: `4242 4242 4242 4242`, any future expiry, any CVC. Declined card: `4000 0000 0000 0002`.
   The balance in the terminal updates within a second of the webhook.
Local development: `stripe listen --forward-to localhost:4000/v1/payments/webhooks/stripe` (Stripe CLI)
prints a `whsec_...` to use locally.

## 4. Praxis / BridgerPay later
Sign the contract, receive `merchant id`, `application key`, `secret`, and the cashier URL. Tell the
developer; the adapter returns their hosted cashier URL for the chosen method and their webhook
(`notification_url`) is wired to the same settle / fail functions. The UI does not change.
