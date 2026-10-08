import { ApiError } from '@/lib/api';
import { fmtMoney } from '@/lib/utils';

export interface FriendlyError {
  code: string;
  status: number;
  /** one-line headline */
  title: string;
  /** server message or a hint, already safe to show */
  body?: string;
  /** where a link helps the client fix it */
  link?: { href: string; label: string };
}

/** Turns an ApiError (or anything thrown) into copy the client can act on. Server messages are kept; codes add a headline and a next step. */
export function friendlyError(e: unknown): FriendlyError {
  if (!(e instanceof ApiError)) {
    return { code: 'network', status: 0, title: 'Something went wrong', body: 'Check your connection and try again.' };
  }
  const details = (e.details ?? {}) as Record<string, unknown>;
  switch (e.code) {
    case 'demo_account':
      return { ...base(e), title: 'Demo accounts use virtual funds', link: { href: '/app/accounts', label: 'Open a live account' } };
    case 'kyc_required':
      return { ...base(e), title: 'Verification required', link: { href: '/app/documents', label: 'Upload documents' } };
    case 'insufficient_funds': {
      const available = typeof details.available === 'string' ? details.available : null;
      return {
        ...base(e),
        title: 'Amount exceeds what can be withdrawn',
        body: available !== null ? `You can withdraw up to ${fmtMoney(available)} USD right now (balance minus margin in use and pending withdrawals).` : e.message,
      };
    }
    case 'account_frozen':
    case 'account_disabled':
      return { ...base(e), title: 'Account restricted', link: { href: '/app/help', label: 'Contact support' } };
    case 'amount_min':
    case 'amount_max':
      return { ...base(e), title: 'Amount out of range' };
    case 'method_unavailable':
      return { ...base(e), title: 'Method not available' };
    case 'file_type':
      return { ...base(e), title: 'Unsupported file' };
    case 'file_too_large':
      return { ...base(e), title: 'File too large' };
    case 'not_pending':
      return { ...base(e), title: 'Already processed' };
    case 'ticket_closed':
      return { ...base(e), title: 'Ticket is closed' };
    case 'validation':
      return { ...base(e), title: 'Check the form' };
    default:
      if (e.status === 429) return { ...base(e), title: 'Too many requests', body: e.message || 'Please wait a little and try again.' };
      return { ...base(e), title: e.status >= 500 ? 'Server error' : 'Request failed' };
  }
}

const base = (e: ApiError) => ({ code: e.code, status: e.status, body: e.message });

/** Reads `details.available` off an insufficient_funds error, or null. */
export function availableFrom(e: unknown): string | null {
  if (e instanceof ApiError && e.code === 'insufficient_funds') {
    const d = e.details as { available?: string } | undefined;
    return d?.available ?? null;
  }
  return null;
}
