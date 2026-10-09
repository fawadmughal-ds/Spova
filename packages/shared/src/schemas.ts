import { z } from 'zod';
import { ACCOUNT_TYPES, KYC_GROUPS, KycGroup, LEDGER_TYPES, ORDER_SIDES, ORDER_TYPES, USER_STATUSES } from './enums';

// Password policy (matches Spova hint): 8-32 chars, upper, lower, digit, special.
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(32, 'At most 32 characters')
  .regex(/[a-z]/, 'One lowercase letter')
  .regex(/[A-Z]/, 'One uppercase letter')
  .regex(/[0-9]/, 'One digit')
  .regex(/[^A-Za-z0-9]/, 'One special character');

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Money travels as a string decimal with max 2dp. Never a JS float.
export const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Amount must be a positive number with up to 2 decimals')
  .refine((v) => Number(v) > 0, 'Amount must be greater than 0');

// ---------- auth ----------
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Phone must be in international format, e.g. +971501234567'),
  countryCode: z.string().trim().length(2).toUpperCase(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const eighteen = new Date();
      eighteen.setFullYear(eighteen.getFullYear() - 18);
      return d <= eighteen;
    }, 'You must be at least 18'),
  tcAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  riskAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the risk disclosure' }) }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  current: z.string().min(1).max(128),
  next: passwordSchema,
});

// ---------- profile ----------
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/)
    .optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  city: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  zip: z.string().trim().max(20).optional().nullable(),
  language: z.string().trim().max(8).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const notificationPrefsSchema = z.object({
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  push: z.boolean().optional(),
  calls: z.boolean().optional(),
});

// ---------- accounts ----------
export const createAccountSchema = z.object({
  type: z.enum(ACCOUNT_TYPES),
  currency: z.literal('USD').default('USD'),
});

// ---------- admin ----------
export const adminCreditSchema = z.object({
  amount: moneySchema,
  reason: z.string().trim().min(3).max(300),
  type: z.enum(['deposit', 'credit', 'bonus']).default('credit'),
});
export type AdminCreditInput = z.infer<typeof adminCreditSchema>;

export const adminDebitSchema = z.object({
  amount: moneySchema,
  reason: z.string().trim().min(3).max(300),
  type: z.enum(['withdraw', 'debit', 'fee']).default('debit'),
  force: z.boolean().optional().default(false),
});
export type AdminDebitInput = z.infer<typeof adminDebitSchema>;

export const adminUpdateUserSchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const adminUpdateAccountSchema = z.object({
  leverage: z.number().int().min(1).max(1000).optional(),
  tier: z.enum(['classic', 'silver', 'gold', 'platinum', 'vip']).optional(),
  status: z.enum(['enabled', 'disabled', 'readonly']).optional(),
  tradingBlocked: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const LEDGER_TYPE_VALUES = LEDGER_TYPES;

// ---------- phase 2: kyc / payments / support ----------
/** Accepted document types per KYC group (value -> label). */
export const KYC_DOC_TYPES: Record<KycGroup, { value: string; label: string }[]> = {
  poi: [
    { value: 'passport', label: 'Passport' },
    { value: 'id_card', label: 'ID Card Front' },
    { value: 'id_card_back', label: 'ID Card Back' },
    { value: 'driving_licence', label: 'Driving License Front' },
    { value: 'driving_licence_back', label: 'Driving License Back' },
    { value: 'selfie', label: 'Selfie with document' },
  ],
  por: [
    { value: 'utility_bill', label: 'Utility Bill' },
    { value: 'bank_statement', label: 'Bank Statement' },
    { value: 'tax_letter', label: 'Government / Tax Letter' },
    { value: 'rental_agreement', label: 'Rental Agreement' },
    { value: 'residence_other', label: 'Other proof of residence' },
  ],
  payment: [
    { value: 'card_front', label: 'Credit Card Front (middle digits hidden)' },
    { value: 'card_back', label: 'Credit Card Back (CVV hidden)' },
    { value: 'bank_proof', label: 'Bank Account Proof' },
    { value: 'crypto_wallet', label: 'Crypto Wallet Ownership' },
    { value: 'payment_other', label: 'Other payment document' },
  ],
  other: [
    { value: 'source_of_funds', label: 'Source of Funds' },
    { value: 'declaration', label: 'Signed Declaration' },
    { value: 'other', label: 'Other document' },
  ],
};
export const KYC_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const KYC_MAX_BYTES = 10 * 1024 * 1024;

export const kycUploadMetaSchema = z
  .object({ group: z.enum(KYC_GROUPS), docType: z.string().trim().min(2).max(40) })
  .refine((v) => KYC_DOC_TYPES[v.group].some((t) => t.value === v.docType), { path: ['docType'], message: 'Unknown document type for this group' });
export type KycUploadMeta = z.infer<typeof kycUploadMetaSchema>;

export const kycReviewSchema = z
  .object({ status: z.enum(['approved', 'rejected']), reason: z.string().trim().max(300).optional() })
  .refine((v) => v.status === 'approved' || (v.reason && v.reason.length >= 3), { path: ['reason'], message: 'Give the client a reason for the rejection' });
export type KycReviewInput = z.infer<typeof kycReviewSchema>;

/** Payment methods offered in v1. Card stays visible but disabled until a PSP is connected (Phase 5). */
export const PAYMENT_METHODS = [
  { id: 'bank', label: 'Bank transfer', kinds: ['deposit', 'withdraw'], enabled: true, minDeposit: '200', maxDeposit: '100000', minWithdraw: '50', maxWithdraw: '100000', eta: '1-3 business days' },
  { id: 'upi', label: 'UPI', kinds: ['deposit'], enabled: true, minDeposit: '200', maxDeposit: '20000', minWithdraw: '0', maxWithdraw: '0', eta: 'Within hours' },
  { id: 'binance', label: 'Binance Pay', kinds: ['deposit', 'withdraw'], enabled: true, minDeposit: '200', maxDeposit: '100000', minWithdraw: '50', maxWithdraw: '100000', eta: 'Same day' },
  { id: 'crypto_usdt', label: 'Crypto (USDT)', kinds: ['deposit', 'withdraw'], enabled: true, minDeposit: '200', maxDeposit: '100000', minWithdraw: '50', maxWithdraw: '100000', eta: 'Same day' },
  { id: 'card', label: 'Card', kinds: ['deposit'], enabled: false, minDeposit: '200', maxDeposit: '5000', minWithdraw: '0', maxWithdraw: '0', eta: 'Payment link' },
] as const;
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id'];
export const PAYMENT_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id) as [PaymentMethodId, ...PaymentMethodId[]];

export const depositRequestSchema = z.object({
  accountId: z.string().uuid(),
  amount: moneySchema,
  method: z.enum(PAYMENT_METHOD_IDS),
  /** bank reference / tx hash the client used, if any */
  reference: z.string().trim().max(120).optional(),
});
export type DepositRequestInput = z.infer<typeof depositRequestSchema>;

export const withdrawRequestSchema = z.object({
  accountId: z.string().uuid(),
  amount: moneySchema,
  method: z.enum(PAYMENT_METHOD_IDS),
  /** where to send the money: IBAN / account number or wallet address + network */
  destination: z.object({
    label: z.string().trim().min(2).max(80),
    details: z.string().trim().min(4).max(200),
  }),
  reason: z.string().trim().max(200).optional(),
});
export type WithdrawRequestInput = z.infer<typeof withdrawRequestSchema>;

/**
 * Where clients send their deposits, per method. Edited by admins in the back office (stored as the
 * `deposit_channels` app setting); clients only ever see the public projection (`DepositChannelDto`).
 */
const note = z.string().trim().max(300).default('');
export const depositChannelsSchema = z.object({
  bank: z.object({ enabled: z.boolean(), bankName: z.string().trim().max(80).default(''), accountName: z.string().trim().max(80).default(''), accountNumber: z.string().trim().max(40).default(''), ifsc: z.string().trim().max(20).default(''), swift: z.string().trim().max(20).default(''), note }),
  upi: z.object({ enabled: z.boolean(), vpa: z.string().trim().max(80).default(''), payeeName: z.string().trim().max(80).default(''), note }),
  binance: z.object({ enabled: z.boolean(), payId: z.string().trim().max(40).default(''), email: z.string().trim().max(120).default(''), qrLink: z.string().trim().max(300).default(''), note }),
  crypto_usdt: z.object({ enabled: z.boolean(), address: z.string().trim().max(120).default(''), network: z.string().trim().max(40).default('TRC20'), note }),
  card: z.object({ enabled: z.boolean(), note }),
});
export type DepositChannels = z.infer<typeof depositChannelsSchema>;

export const DEFAULT_DEPOSIT_CHANNELS: DepositChannels = {
  bank: { enabled: true, bankName: 'HDFC Bank', accountName: 'XYZ Markets Ltd', accountNumber: '50200012345678', ifsc: 'HDFC0001234', swift: 'HDFCINBB', note: 'Use your account login as the transfer remark. INR transfers are converted at the rate of the day.' },
  upi: { enabled: true, vpa: 'xyzmarkets@hdfcbank', payeeName: 'XYZ Markets', note: 'Scan the QR with any UPI app (GPay, PhonePe, Paytm) or pay to the UPI ID. Keep the screenshot of the success screen.' },
  binance: { enabled: true, payId: '123456789', email: 'pay@xyz.local', qrLink: '', note: 'Binance app → Pay → Send → enter the Pay ID (or scan). Send USDT. Zero fee inside Binance.' },
  crypto_usdt: { enabled: true, address: 'TXYZ1111111111111111111111111111111', network: 'TRC20', note: 'Send USDT on the TRC20 network only. Transfers on another network cannot be recovered.' },
  card: { enabled: false, note: 'After you submit, our team emails you a secure card payment link within business hours.' },
};

export const paymentDecisionSchema = z
  .object({ status: z.enum(['approved', 'declined']), note: z.string().trim().max(300).optional() })
  .refine((v) => v.status === 'approved' || (v.note && v.note.length >= 3), { path: ['note'], message: 'Give the client a reason for the decline' });
export type PaymentDecisionInput = z.infer<typeof paymentDecisionSchema>;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(4000),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const ticketMessageSchema = z.object({ body: z.string().trim().min(1).max(4000) });
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;

export const ticketStatusSchema = z.object({ status: z.enum(['open', 'answered', 'closed']) });

// ---------- phase 3: trading ----------
const priceSchema = z.string().trim().regex(/^\d{1,12}(\.\d{1,6})?$/, 'Price must be a positive number with up to 6 decimals').refine((v) => Number(v) > 0, 'Price must be greater than 0');
const lotsSchema = z.string().trim().regex(/^\d{1,6}(\.\d{1,2})?$/, 'Volume must have at most 2 decimals').refine((v) => Number(v) > 0, 'Volume must be greater than 0');

export const placeOrderSchema = z
  .object({
    symbol: z.string().trim().min(3).max(16),
    side: z.enum(ORDER_SIDES),
    type: z.enum(ORDER_TYPES),
    lots: lotsSchema,
    /** required for limit / stop */
    price: priceSchema.optional(),
    sl: priceSchema.nullable().optional(),
    tp: priceSchema.nullable().optional(),
    /** idempotency: same clientRef on the same account returns the first order */
    clientRef: z.string().trim().min(4).max(64).optional(),
  })
  .refine((v) => v.type === 'market' || !!v.price, { path: ['price'], message: 'Pending orders need a price' });
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const modifyPositionSchema = z.object({ sl: priceSchema.nullable().optional(), tp: priceSchema.nullable().optional() });
export type ModifyPositionInput = z.infer<typeof modifyPositionSchema>;

export const closePositionSchema = z.object({ lots: lotsSchema.optional() });
export type ClosePositionInput = z.infer<typeof closePositionSchema>;

export const candlesQuerySchema = z.object({
  tf: z.enum(['m1', 'm5', 'm15', 'h1', 'h4', 'd1']).default('m1'),
  from: z.coerce.number().int().optional(),
  to: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(1500).default(500),
});

// worker -> api (internal, token-guarded)
const quoteBody = z.object({ bid: priceSchema, ask: priceSchema, ts: z.number().int() });
export const internalCloseSchema = z.object({ positionId: z.string().uuid(), reason: z.enum(['sl', 'tp', 'stopout']), quote: quoteBody });
export const internalFillSchema = z.object({ orderId: z.string().uuid(), quote: quoteBody });
export const internalStopOutSchema = z.object({ accountId: z.string().uuid() });
export const internalMarginCallSchema = z.object({ accountId: z.string().uuid(), level: z.string() });
export const internalSwapSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
