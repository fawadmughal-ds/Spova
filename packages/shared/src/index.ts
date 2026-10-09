export * from './enums';
export * from './schemas';
export * from './deposit-channels';
export * from './types';
export * from './risk';

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
  ADMIN_KYC_NEW: 'admin:kyc:new',
  ADMIN_PAYMENT_NEW: 'admin:payment:new',
  ADMIN_TICKET_NEW: 'admin:ticket:new',
  TICKET_UPDATED: 'ticket:updated',
  ADMIN_POSITION: 'admin:position:event',
  ADMIN_STOPOUT: 'admin:stopout',
} as const;

export const COOKIE_NAMES = {
  ACCESS: 'sp_at',
  REFRESH: 'sp_rt',
} as const;
