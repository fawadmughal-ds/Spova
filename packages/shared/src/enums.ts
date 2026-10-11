// Mirrors Postgres enums in apps/api/prisma/schema.prisma (ARCHITECTURE §06).
// Keep both in sync. Values are lowercase on the wire.

export const ROLES = ['client', 'admin', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['active', 'frozen', 'closed'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ACCOUNT_TYPES = ['demo', 'live'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_STATUSES = ['enabled', 'disabled', 'readonly'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const TIERS = ['classic', 'silver', 'gold', 'platinum', 'vip'] as const;
export type Tier = (typeof TIERS)[number];

export const LEDGER_TYPES = [
  'deposit',
  'withdraw',
  'credit',
  'debit',
  'bonus',
  'pnl',
  'swap',
  'fee',
  'commission',
  'adjustment',
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

export const PAYMENT_KINDS = ['deposit', 'withdraw'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_STATUSES = ['pending', 'approved', 'declined', 'cancelled'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const KYC_GROUPS = ['poi', 'por', 'payment', 'other'] as const;
export type KycGroup = (typeof KYC_GROUPS)[number];

export const KYC_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const ASSET_CLASSES = ['forex', 'index', 'commodity', 'stock', 'crypto', 'metal'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ORDER_SIDES = ['buy', 'sell'] as const;
export type OrderSide = (typeof ORDER_SIDES)[number];

export const ORDER_TYPES = ['market', 'limit', 'stop'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_STATUSES = ['pending', 'filled', 'cancelled', 'rejected', 'expired'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const POSITION_STATUSES = ['open', 'closed'] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const CLOSE_REASONS = ['user', 'sl', 'tp', 'stopout', 'admin', 'expiry'] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const TIMEFRAMES = ['m1', 'm5', 'm15', 'm30', 'h1', 'h4', 'd1', 'w1', 'mn1'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export const TICKET_STATUSES = ['open', 'answered', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
