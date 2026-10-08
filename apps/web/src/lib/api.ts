import type { ApiError as ApiErrorShape } from '@spova/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh. Returns true when a new access cookie was set. */
async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

interface Options extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip refresh-and-retry (used by auth endpoints themselves). */
  noRetry?: boolean;
}

/**
 * Browser-side typed fetch. Cookies travel automatically (credentials: include).
 * On 401 it refreshes once and retries. Throws ApiError with the server's {code,message}.
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, noRetry, headers, ...rest } = opts;
  const doFetch = () =>
    fetch(`${API_URL}/v1${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(headers ?? {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();
  if (res.status === 401 && !noRetry) {
    const ok = await refreshSession();
    if (ok) res = await doFetch();
  }

  if (!res.ok) {
    let payload: Partial<ApiErrorShape> = {};
    try {
      payload = (await res.json()) as ApiErrorShape;
    } catch {
      /* non-json */
    }
    throw new ApiError(res.status, payload.code ?? 'error', payload.message ?? res.statusText, payload.details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

/** multipart/form-data POST (file uploads). The browser sets the boundary header itself. */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const doFetch = () => fetch(`${API_URL}/v1${path}`, { method: 'POST', credentials: 'include', body: form });
  let res = await doFetch();
  if (res.status === 401) {
    const ok = await refreshSession();
    if (ok) res = await doFetch();
  }
  if (!res.ok) {
    let payload: Partial<ApiErrorShape> = {};
    try {
      payload = (await res.json()) as ApiErrorShape;
    } catch {
      /* non-json */
    }
    throw new ApiError(res.status, payload.code ?? 'error', payload.message ?? res.statusText, payload.details);
  }
  return (await res.json()) as T;
}

/** URL of a private file served through the API (auth cookie travels with the request). */
export const fileUrl = (path: string) => `${API_URL}/v1${path}`;
