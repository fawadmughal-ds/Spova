export * from './enums';
export * from './schemas';
export * from './types';

export const WS_EVENTS = {
  // client -> server
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SELECT_ACCOUNT: 'select_account',
  PING: 'ping',
  // server -> client
  PONG: 'pong',
  TICK: 'tick',
  CANDLE: 'candle',
  ACCOUNT: 'account',
  NOTICE: 'notice',
  POSITION_OPENED: 'position:opened',
  POSITION_UPDATED: 'position:updated',
  POSITION_CLOSED: 'position:closed',
  ORDER_FILLED: 'order:filled',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_REJECTED: 'order:rejected',
  KYC_STATUS: 'kyc:status',
  PAYMENT_STATUS: 'payment:status',
  ADMIN_LEDGER: 'admin:ledger',
} as const;

export const COOKIE_NAMES = {
  ACCESS: 'sp_at',
  REFRESH: 'sp_rt',
} as const;
