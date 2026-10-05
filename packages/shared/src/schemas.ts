import { z } from 'zod';
import { ACCOUNT_TYPES, LEDGER_TYPES, USER_STATUSES } from './enums';

// Password policy (matches Spova hint): 8-32 chars, upper, lower, digit, special.
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(32, 'At most 32 characters')
  .regex(/[a-z]/, 'One lowercase letter')
  .regex(/[A-Z]/, 'One uppercase letter')
  .regex(/[0-9]/, 'One digit')
  .regex(/[^A-Za-z0-9]/, 'One special character');

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Money travels as a string decimal with max 2dp. Never a JS float.
export const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Amount must be a positive number with up to 2 decimals')
  .refine((v) => Number(v) > 0, 'Amount must be greater than 0');

// ---------- auth ----------
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Phone must be in international format, e.g. +971501234567'),
  countryCode: z.string().trim().length(2).toUpperCase(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const eighteen = new Date();
      eighteen.setFullYear(eighteen.getFullYear() - 18);
      return d <= eighteen;
    }, 'You must be at least 18'),
  tcAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  riskAccepted: z.literal(true, { errorMap: () => ({ message: 'You must accept the risk disclosure' }) }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  current: z.string().min(1).max(128),
  next: passwordSchema,
});

// ---------- profile ----------
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/)
    .optional(),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  city: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  zip: z.string().trim().max(20).optional().nullable(),
  language: z.string().trim().max(8).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const notificationPrefsSchema = z.object({
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  push: z.boolean().optional(),
  calls: z.boolean().optional(),
});

// ---------- accounts ----------
export const createAccountSchema = z.object({
  type: z.enum(ACCOUNT_TYPES),
  currency: z.literal('USD').default('USD'),
});

// ---------- admin ----------
export const adminCreditSchema = z.object({
  amount: moneySchema,
  reason: z.string().trim().min(3).max(300),
  type: z.enum(['deposit', 'credit', 'bonus']).default('credit'),
});
export type AdminCreditInput = z.infer<typeof adminCreditSchema>;

export const adminDebitSchema = z.object({
  amount: moneySchema,
  reason: z.string().trim().min(3).max(300),
  type: z.enum(['withdraw', 'debit', 'fee']).default('debit'),
  force: z.boolean().optional().default(false),
});
export type AdminDebitInput = z.infer<typeof adminDebitSchema>;

export const adminUpdateUserSchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const adminUpdateAccountSchema = z.object({
  leverage: z.number().int().min(1).max(1000).optional(),
  tier: z.enum(['classic', 'silver', 'gold', 'platinum', 'vip']).optional(),
  status: z.enum(['enabled', 'disabled', 'readonly']).optional(),
  tradingBlocked: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const LEDGER_TYPE_VALUES = LEDGER_TYPES;
