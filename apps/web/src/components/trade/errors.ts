import { ApiError } from '@/lib/api';
import { fmtMoney } from '@/lib/utils';
import { friendlyError, type FriendlyError } from '@/components/portal/api-error';

/** Trading error codes on top of the portal's friendlyError. */
export function tradeError(e: unknown): FriendlyError {
  if (!(e instanceof ApiError)) return friendlyError(e);
  const d = (e.details ?? {}) as Record<string, unknown>;
  const base = { code: e.code, status: e.status, body: e.message };
  switch (e.code) {
    case 'symbol_unknown':
      return { ...base, title: 'Unknown instrument', body: 'This symbol is not available for trading.' };
    case 'market_closed':
      return { ...base, title: 'Market closed', body: e.message || 'This market is outside its trading session.' };
    case 'quote_stale':
      return { ...base, title: 'No live price', body: 'We have no fresh price for this instrument. Try again in a moment.' };
    case 'lots_invalid':
      return { ...base, title: 'Check the volume' };
    case 'sl_tp_invalid':
      return { ...base, title: 'Check stop loss / take profit' };
    case 'price_invalid':
      return { ...base, title: 'Check the order price' };
    case 'insufficient_margin': {
      const req = typeof d.required === 'string' ? d.required : null;
      const free = typeof d.freeMargin === 'string' ? d.freeMargin : null;
      return {
        ...base,
        title: 'Not enough free margin',
        body: req && free ? `This order needs ${fmtMoney(req)} USD of margin; ${fmtMoney(free)} USD is free. Reduce the volume or close a position.` : e.message,
      };
    }
    case 'no_conversion':
      return { ...base, title: 'No conversion rate', body: 'We cannot value this instrument in USD right now. Try again in a moment.' };
    case 'trading_blocked':
      return { ...base, title: 'Trading blocked', body: 'Trading on this account has been disabled by the broker.', link: { href: '/app/help', label: 'Contact support' } };
    case 'account_disabled':
      return { ...base, title: 'Account disabled', link: { href: '/app/help', label: 'Contact support' } };
    case 'account_frozen':
      return { ...base, title: 'Account restricted', link: { href: '/app/help', label: 'Contact support' } };
    case 'not_pending':
      return { ...base, title: 'Order already processed' };
    case 'already_closed':
      return { ...base, title: 'Position already closed' };
    case 'position_not_found':
      return { ...base, title: 'Position not found', body: 'It may already have been closed.' };
    case 'order_not_found':
      return { ...base, title: 'Order not found' };
    default:
      if (e.status === 429) return { ...base, title: 'Too many orders', body: 'Up to 10 orders per second per account. Wait a moment and try again.' };
      return friendlyError(e);
  }
}
