import type {
  AccountStatus,
  AccountType,
  KycGroup,
  KycStatus,
  LedgerType,
  PaymentKind,
  PaymentStatus,
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
