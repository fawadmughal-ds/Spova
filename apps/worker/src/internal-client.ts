import type { Quote } from '@spova/shared';
import type { Logger } from './logger';
import type { TradingIndexDto } from './risk/index-types';

export interface InternalResult<T = unknown> {
  ok: boolean;
  status: number;
  body: T | null;
}

export interface InternalClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  fetchImpl?: typeof fetch;
}

export class InternalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Thin wrapper over the API's /v1/internal/trading/* endpoints (docs/PHASE3_CONTRACT.md).
 * - `X-Internal-Token` on every call, per-call timeout
 * - network errors / 5xx: retried with exponential backoff, then thrown
 * - 4xx: logged and returned as {ok:false} so the caller continues (the API is the authority)
 */
export class InternalClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly f: typeof fetch;

  constructor(
    private readonly log: Logger,
    opts: InternalClientOptions,
  ) {
    this.base = `${opts.baseUrl.replace(/\/$/, '')}/v1/internal/trading`;
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this.retries = opts.retries ?? 3;
    this.backoffMs = opts.backoffMs ?? 300;
    this.f = opts.fetchImpl ?? fetch;
    this.token = opts.token;
  }
  private readonly token: string;

  index() {
    return this.request<TradingIndexDto>('GET', '/index');
  }
  close(body: { positionId: string; reason: 'sl' | 'tp' | 'stopout'; quote: Quote }) {
    return this.request('POST', '/close', body);
  }
  fill(body: { orderId: string; quote: Quote }) {
    return this.request('POST', '/fill', body);
  }
  stopOut(body: { accountId: string }) {
    return this.request('POST', '/stop-out', body);
  }
  marginCall(body: { accountId: string; level: string }) {
    return this.request('POST', '/margin-call', body);
  }
  swap(body: { date: string }) {
    return this.request('POST', '/swap', body);
  }

  async request<T = unknown>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<InternalResult<T>> {
    let attempt = 0;
    for (;;) {
      try {
        const res = await this.f(`${this.base}${path}`, {
          method,
          headers: { 'content-type': 'application/json', 'x-internal-token': this.token },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const text = await res.text();
        let parsed: T | null = null;
        if (text) {
          try {
            parsed = JSON.parse(text) as T;
          } catch {
            parsed = text as unknown as T;
          }
        }
        if (res.ok) return { ok: true, status: res.status, body: parsed };
        if (res.status >= 500) throw new InternalApiError(`${method} ${path} -> ${res.status}`, res.status);
        this.log.warn({ method, path, status: res.status, body: typeof parsed === 'string' ? parsed.slice(0, 300) : parsed }, 'internal api rejected');
        return { ok: false, status: res.status, body: parsed };
      } catch (e) {
        attempt++;
        const err = e as Error;
        if (attempt > this.retries) {
          this.log.error({ method, path, attempt, err: err.message }, 'internal api call failed');
          throw err;
        }
        const delay = this.backoffMs * 3 ** (attempt - 1);
        this.log.warn({ method, path, attempt, delay, err: err.message }, 'internal api retry');
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
}
