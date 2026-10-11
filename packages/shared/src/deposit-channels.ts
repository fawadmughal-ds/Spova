import type { DepositChannels } from './schemas';
import type { DepositChannelDto } from './types';

/** Public view of one deposit channel. `brand` names the payee where the admin left it blank. */
export function depositChannelPublic(id: string, cfg: DepositChannels, brand: string): DepositChannelDto | undefined {
  switch (id) {
    case 'bank': {
      const c = cfg.bank;
      return {
        title: 'Bank transfer details',
        fields: [
          { label: 'Bank', value: c.bankName },
          { label: 'Account name', value: c.accountName || brand, copy: true },
          { label: 'Account number', value: c.accountNumber, copy: true },
          { label: 'IFSC', value: c.ifsc, copy: true },
          { label: 'SWIFT', value: c.swift, copy: true },
        ].filter((f) => f.value),
        qr: null,
        qrKind: null,
        note: c.note,
        proofRequired: true,
        currency: c.currency || 'INR',
      };
    }
    case 'rtgs': {
      const c = cfg.rtgs;
      return {
        title: 'RTGS transfer details',
        fields: [
          { label: 'Bank', value: c.bankName },
          { label: 'Account name', value: c.accountName || brand, copy: true },
          { label: 'Account number', value: c.accountNumber, copy: true },
          { label: 'IFSC', value: c.ifsc, copy: true },
          { label: 'SWIFT', value: c.swift, copy: true },
        ].filter((f) => f.value),
        qr: null,
        qrKind: null,
        note: c.note,
        proofRequired: true,
        currency: c.currency || 'INR',
      };
    }
    case 'upi': {
      const c = cfg.upi;
      const pn = encodeURIComponent(c.payeeName || brand);
      return {
        title: 'Pay by UPI',
        fields: [
          { label: 'UPI ID', value: c.vpa, copy: true },
          { label: 'Payee', value: c.payeeName || brand },
        ].filter((f) => f.value),
        qr: c.vpa ? `upi://pay?pa=${encodeURIComponent(c.vpa)}&pn=${pn}&cu=INR` : null,
        qrKind: 'upi',
        note: c.note,
        proofRequired: true,
        currency: c.currency || 'INR',
      };
    }
    case 'binance': {
      const c = cfg.binance;
      return {
        title: 'Binance Pay',
        fields: [
          { label: 'Binance Pay ID', value: c.payId, copy: true },
          { label: 'Binance email', value: c.email, copy: true },
        ].filter((f) => f.value),
        qr: c.qrLink || (c.payId ? c.payId : null),
        qrKind: c.qrLink ? 'link' : 'address',
        note: c.note,
        proofRequired: true,
        currency: 'USDT',
      };
    }
    case 'crypto_usdt': {
      const c = cfg.crypto_usdt;
      return {
        title: `USDT (${c.network || 'TRC20'}) wallet`,
        fields: [
          { label: 'Address', value: c.address, copy: true },
          { label: 'Network', value: c.network || 'TRC20' },
          { label: 'Asset', value: 'USDT' },
        ].filter((f) => f.value),
        qr: c.address || null,
        qrKind: 'address',
        note: c.note,
        proofRequired: true,
        currency: 'USDT',
      };
    }
    case 'card':
      return { title: 'Credit or Debit Card', fields: [], qr: null, qrKind: null, note: cfg.card.note, proofRequired: false, currency: 'USD' };
    default:
      return undefined;
  }
}

/** Deposit availability: the static method flag AND the admin's channel switch. */
export const depositEnabled = (id: string, cfg: DepositChannels): boolean => (cfg as Record<string, { enabled?: boolean } | undefined>)[id]?.enabled ?? false;
