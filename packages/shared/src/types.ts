import type { Timeframe } from './enums';
import type {
  AssetClass,
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
  kyc: {
    poi: boolean;
    por: boolean;
    payment: boolean;
    /** ISO time by which all four document groups must be uploaded */
    deadlineAt: string | null;
    /** whole days until the deadline (negative = overdue), null for staff */
    daysLeft: number | null;
    /** one document (not rejected) in each of the four groups */
    complete: boolean;
    /** deadline passed without complete documents: trading blocked until uploaded or unfrozen by an admin */
    frozen: boolean;
  };
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
  /** suitability / KYC questionnaire answers captured at sign-up (null for accounts created before it existed) */
  sourceOfFunds: string | null;
  employmentStatus: string | null;
  annualIncome: string | null;
  netWorth: string | null;
  expectedDeposit: string | null;
  tradingExperience: string | null;
  tradingObjective: string | null;
}

/** One timestamped agent comment on a client's file. */
export interface ClientNoteDto {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
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
  /** overnight swap charges waived for this account (admin-controlled) */
  swapFree: boolean;
  /** per-account USD->local FX override for deposits; null = use the global cashier rate */
  usdRate: string | null;
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
  kycDeadlineAt: string | null;
  kycFrozen: boolean;
  accountsCount: number;
  totalBalance: string;
  createdAt: string;
  lastLoginAt: string | null;
  /** last authenticated activity; drives the online dot */
  lastSeenAt: string | null;
  /** true when lastSeenAt is within the online window (~3 min) */
  online: boolean;
  /** currently open positions across the client's accounts */
  openTrades: number;
}

/** Per-client trading / money summary for the admin detail view. */
export interface AdminUserStatsDto {
  openTrades: number;
  closedTrades: number;
  totalVolumeLots: string;
  realizedPnl: string;
  depositsApproved: string;
  withdrawalsApproved: string;
  /** admin manual credits + bonuses added to this client's accounts (all time) */
  manualCredits: string;
  pendingPayments: number;
  openTickets: number;
}

export interface AdminUserDetailDto extends AdminUserRowDto {
  profile: ProfileDto | null;
  accounts: AccountDto[];
  /** the single free-text "about this client" note (User.adminNotes) */
  notes: string | null;
  /** timestamped agent comment log (newest first) */
  comments: ClientNoteDto[];
  lastLoginIp: string | null;
  stats: AdminUserStatsDto;
}

export interface ActivityEventDto {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  kind: string;
  title: string;
  detail: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
}

export interface ActivityFeedDto {
  items: ActivityEventDto[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminDashboardDto {
  clients: number;
  newClients7d: number;
  pendingKyc: number;
  pendingPayments: number;
  openPositions: number;
  demoBalanceTotal: string;
  liveBalanceTotal: string;
  openTickets: number;
  /** approved today (UTC) */
  depositsToday: string;
  withdrawalsToday: string;
  /** approved all-time, across all clients */
  depositsTotal: string;
  withdrawalsTotal: string;
  /** admin manual credits + bonuses, all-time */
  manualCreditsTotal: string;
  pendingDepositsTotal: string;
  pendingWithdrawalsTotal: string;
  /** distinct clients with a session opened in the last 24 hours */
  activeClients24h: number;
  /** net open lots per symbol (buy minus sell), largest first */
  exposure: { symbol: string; buyLots: string; sellLots: string; netLots: string; positions: number }[];
  /** price feed health keys as the worker writes them */
  feeds: { source: string; status: 'up' | 'down' | 'unknown' }[];
  tradingHalt: boolean;
  /** clients whose document deadline is within 3 days and who have not uploaded everything */
  kycDueSoon: number;
  /** clients frozen for missing documents */
  kycFrozen: number;
}

/** Row of the back-office document deadline list. */
export interface KycDeadlineRowDto {
  user: { id: string; email: string; firstName: string | null; lastName: string | null };
  deadlineAt: string;
  daysLeft: number;
  frozen: boolean;
  frozenAt: string | null;
  /** groups with at least one non-rejected document */
  uploadedGroups: KycGroup[];
  complete: boolean;
}

export interface AdminSymbolDto {
  id: string;
  name: string;
  assetClass: AssetClass;
  digits: number;
  contractSize: string;
  minLot: string;
  maxLot: string;
  lotStep: string;
  leverageMax: number;
  spreadMarkup: string;
  swapLong: string;
  swapShort: string;
  feedSource: string;
  feedSymbol: string;
  enabled: boolean;
  featured: boolean;
  sortOrder: number;
  /** last quote from Redis, if the worker is running */
  bid: string | null;
  ask: string | null;
  quoteTs: number | null;
  openPositions: number;
}

export interface RiskConfigDto {
  tier: Tier;
  marginCallPct: number;
  stopOutPct: number;
  defaultLeverage: number;
  maxLeverage: number;
  minDeposit: string;
  spreadDiscountPct: number;
  accounts: number;
}

/** What clients may see of the platform switches. */
export interface PlatformPublicDto {
  tradingHalt: { enabled: boolean; message: string };
  announcement: { enabled: boolean; text: string; level: 'info' | 'warning' | 'danger' | 'success' };
  registrationOpen: boolean;
  liveAccountsOpen: boolean;
}

export interface StaffDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'admin' | 'superadmin';
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface BroadcastResultDto {
  recipients: number;
  emailed: number;
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
  type: 'margin_call' | 'stop_out' | 'trading_blocked' | 'kyc' | 'payment' | 'ledger' | 'broadcast';
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
  /** currency the client actually pays in (the cashier shows the converted amount) */
  currency: string;
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
  /** card: the gateway the browser talks to (publishable key only) */
  gateway?: { provider: 'stripe'; publishableKey: string };
}

/** Cashier page extras: legal footer and USD -> currency rates for the "charged by" line. */
export interface CashierInfoDto {
  footer: string;
  fx: Record<string, number>;
}

export interface CardIntentDto {
  requestId: string;
  provider: 'stripe';
  clientSecret: string;
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
  /** safe card metadata for a card deposit (never the full number or CVV): brand, last four, cardholder name and the provider's response/decline code */
  card: { brand: string | null; last4: string | null; name: string | null; code: string | null } | null;
  /** true when the attempt was recorded in test mode (no gateway connected) and declined automatically */
  testMode: boolean;
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
  tf: Timeframe;
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
