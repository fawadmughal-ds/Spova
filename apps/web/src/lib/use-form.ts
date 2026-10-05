'use client';

import { useCallback, useState } from 'react';
import type { ZodSchema } from 'zod';
import { ApiError } from './api';

/** Tiny form helper: zod validation per field + server error mapping. Avoids pulling react-hook-form for a handful of forms. */
export function useForm<T extends Record<string, unknown>>(schema: ZodSchema<T>, initial: Partial<T> = {}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback((name: string, value: unknown) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => {
      if (!e[name]) return e;
      const { [name]: _drop, ...rest } = e;
      return rest;
    });
  }, []);

  const bind = (name: string) => ({
    name,
    value: (values[name] as string | number | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(name, e.target.value),
    error: errors[name],
  });

  const bindCheckbox = (name: string) => ({
    name,
    checked: !!values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(name, e.target.checked),
  });

  const submit = async (fn: (data: T) => Promise<void>) => {
    setServerError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const k = String(i.path[0] ?? '_');
        if (!errs[k]) errs[k] = i.message;
      }
      setErrors(errs);
      return false;
    }
    setSubmitting(true);
    try {
      await fn(parsed.data);
      return true;
    } catch (e) {
      if (e instanceof ApiError) {
        const d = e.details as { path?: string; message?: string }[] | undefined;
        if (Array.isArray(d) && d[0]?.path) {
          setErrors(Object.fromEntries(d.map((x) => [x.path!, x.message ?? 'Invalid'])));
        }
        setServerError(e.message);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, errors, serverError, submitting, set, bind, bindCheckbox, submit, setServerError };
}
