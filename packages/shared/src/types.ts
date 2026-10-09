import type {
  AccountStatus,
  AccountType,
  CloseReason,
  KycGroup,
  KycStatus,
  LedgerType,
  OrderSide,
  OrderStatus,
  OrderType,
  PaymentKind,
  PaymentStatus,
  PositionStatus,
  Role,
  TicketStatus,
  Tier,
  UserStatus,
} from './enums';

// Wire shapes returned by the API. Money is always a string decimal ("1234.56").

export interface MeDto {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  kyc: { poi: boolean; por: boolean; payment: boolean };
  emailVerified: boolean;
  profile: ProfileDto | null;
}

export interface ProfileDto {
  firstName: string;
  lastName: string;
  phone: string;
  dob: string | null;
  countryCode: string;
  city: string | null;
  address: string | null;
  zip: string | null;
  language: string;
  notifEmail: boolean;
  notifSms: boolean;
  notifPush: boolean;
  notifCalls: boolean;
}

export interface AccountDto {
  id: string;
  type: AccountType;
  loginCode: number;
  tier: Tier;
  currency: string;
  leverage: number;
  balance: string;
  credit: string;
  equity: string;
  usedMargin: string;
  freeMargin: string;
  marginLevel: string | null;
  status: AccountStatus;
  tradingBlocked: boolean;
  createdAt: string;
}

export interface LedgerEntryDto {
  id: string;
  accountId: string;
  type: LedgerType;
  amount: string;
  balanceAfter: string;
  creditAfter: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// Admin views
export interface AdminUserRowDto {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  firstName: string | null;
  lastName: string | null;
  countryCode: string | null;
  kyc: { poi: boolean; por: boolean };
  accountsCount: number;
  totalBalance: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserDetailDto extends AdminUserRowDto {
  profile: ProfileDto | null;
  accounts: AccountDto[];
  notes: string | null;
  lastLoginIp: string | null;
}

export interface AdminDashboardDto {
  clients: number;
  newClients7d: number;
  pendingKyc: number;
  pendingPayments: number;
  openPositions: number;
  demoBalanceTotal: string;
  liveBalanceTotal: string;
}

// WebSocket payloads (ARCHITECTURE §05)
export interface WsAccountSnapshot {
  accountId: string;
  balance: string;
  credit: string;
  equity: string;
  usedMargin: string;
  freeMargin: string;
  marginLevel: string | null;
  ts: number;
}

export interface WsNotice {
  type: 'margin_call' | 'stop_out' | 'trading_blocked' | 'kyc' | 'payment' | 'ledger';
  title: string;
  body: string;
  level: 'info' | 'warning' | 'danger' | 'success';
}

export type KycStatusMap = Record<'poi' | 'por' | 'payment', 'incomplete' | KycStatus>;

// ---------------------------------------------------------------- phase 2 DTOs
export interface KycDocumentDto {
  id: string;
  group: KycGroup;
  docType: string;
  originalName: string;
  mime: string;
  size: number;
  status: KycStatus;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface AdminKycRowDto extends KycDocumentDto {
  user: { id: string; email: string; firstName: string | null; lastName: string | null; countryCode: string | null };
}

/** One line of "pay to" details (account number, UPI id, wallet address...). */
export interface DepositChannelField {
  label: string;
  value: string;
  /** show a copy button */
  copy?: boolean;
}
/** Public projection of a deposit channel: what the client sees in the deposit form. */
export interface DepositChannelDto {
  title: string;
  fields: DepositChannelField[];
  /** QR payload (UPI URI, wallet address, Binance Pay link); null = no QR for this channel */
  qr: string | null;
  /** `upi`: the amount is appended to the URI client-side (`am=`), so the app pre-fills it */
  qrKind: 'upi' | 'address' | 'link' | null;
  note: string;
  /** a payment slip / screenshot must be attached to the request */
  proofRequired: boolean;
}
/** Economic calendar release (public feed, cached by the API). */
export interface CalendarEventDto {
  id: string;
  /** ISO 3166-1 alpha-2 of the issuing economy ("EU" for the euro area, "WW" for global) */
  country: string;
  currency: string;
  /** ISO timestamp of the release */
  at: string;
  title: string;
  /** 0 = holiday / no impact, 1 low, 2 medium, 3 high */
  impact: 0 | 1 | 2 | 3;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
}

export interface PaymentMethodDto {
  id: string;
  label: string;
  kinds: PaymentKind[];
  enabled: boolean;
  minDeposit: string;
  maxDeposit: string;
  minWithdraw: string;
  maxWithdraw: string;
  eta: string;
  /** present for deposit-capable methods: where to send the money */
  deposit?: DepositChannelDto;
}

export interface PaymentRequestDto {
  id: string;
  accountId: string;
  accountLogin: number;
  kind: PaymentKind;
  amount: string;
  currency: string;
  method: string;
  destination: { label: string; details: string } | null;
  reference: string | null;
  /** payment slip / screenshot attached by the client (file streams from /me/payments/:id/proof) */
  proof: { name: string; mime: string } | null;
  status: PaymentStatus;
  adminNote: string | null;
  decidedAt: string | null;
  ledgerEntryId: string | null;
  createdAt: string;
}

export interface AdminPaymentRowDto extends PaymentRequestDto {
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  account: { type: AccountType; balance: string; freeMargin: string };
}

export interface TicketMessageDto {
  id: string;
  authorId: string;
  body: string;
  isStaff: boolean;
  createdAt: string;
}

export interface TicketDto {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: { body: string; isStaff: boolean; createdAt: string } | null;
  /** present on admin rows */
  user?: { id: string; email: string; firstName: string | null; lastName: string | null };
}

export interface TicketDetailDto extends TicketDto {
  messages: TicketMessageDto[];
}

export interface WsKycStatus {
  documentId: string;
  group: KycGroup;
  status: KycStatus;
  reason?: string;
}

export interface WsPaymentStatus {
  paymentId: string;
  kind: PaymentKind;
  status: PaymentStatus;
  note?: string;
}

// ---------------------------------------------------------------- phase 3: trading DTOs
export interface QuoteDto {
  s: string;
  bid: string;
  ask: string;
  ts: number;
  /** older than QUOTE_MAX_AGE_MS or market closed: no trading */
  stale: boolean;
  open: boolean;
}

export interface WsTick {
  s: string;
  bid: string;
  ask: string;
  ts: number;
}

export interface CandleDto {
  /** bucket start, unix seconds */
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v?: number;
}

export interface WsCandle extends CandleDto {
  s: string;
  tf: 'm1' | 'm5' | 'm15' | 'h1' | 'h4' | 'd1';
  /** true when this bar has closed */
  closed?: boolean;
}

export interface PositionDto {
  id: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  lots: string;
  openPrice: string;
  openAt: string;
  sl: string | null;
  tp: string | null;
  marginUsed: string;
  swapAccrued: string;
  commission: string;
  status: PositionStatus;
  closePrice: string | null;
  closeAt: string | null;
  realizedPnl: string | null;
  closeReason: CloseReason | null;
  /** present on open positions when a quote exists */
  currentPrice: string | null;
  floatingPnl: string | null;
}

export interface OrderDto {
  id: string;
  accountId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  lots: string;
  price: string | null;
  sl: string | null;
  tp: string | null;
  status: OrderStatus;
  filledPrice: string | null;
  filledAt: string | null;
  positionId: string | null;
  rejectReason: string | null;
  clientRef: string | null;
  createdAt: string;
}

/** Response of POST /me/accounts/:id/orders */
export interface PlaceOrderResult {
  order: OrderDto;
  /** set when a market order filled */
  position: PositionDto | null;
  account: AccountDto;
}

export interface ClosePositionResult {
  position: PositionDto;
  realizedPnl: string;
  account: AccountDto;
}

/** Published by the API on Redis channel trading:events so the worker can refresh its in-memory index. */
export interface TradingEvent {
  type: 'position.opened' | 'position.updated' | 'position.closed' | 'order.placed' | 'order.cancelled' | 'order.filled' | 'order.rejected' | 'account.changed';
  accountId: string;
  symbol?: string;
  id?: string;
}
