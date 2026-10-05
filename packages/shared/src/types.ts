import type {
  AccountStatus,
  AccountType,
  KycStatus,
  LedgerType,
  Role,
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
