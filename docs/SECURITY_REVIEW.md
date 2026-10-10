# Security review (11 October 2026)

Scope: the whole platform as committed on `main` (web app, API, worker, infra config). Method: dependency
audit, secret scan, source review of authentication, sessions, authorisation, input validation, file
handling, payments, headers and deployment config, plus a 74-page crawl of the public site, client area,
terminal and back office at desktop and phone widths looking for exceptions, console errors and failed
requests. Findings are listed with what was changed.

## Fixed in this review
| # | Area | Finding | Fix |
|---|---|---|---|
| 1 | Dependencies | `postcss` 8.4.31 (via Next 15.5) had 3 high / 1 moderate advisories (source-map file read, XSS in stringify); `deepmerge-ts` 7 (via Prisma CLI) had a stack-exhaustion advisory. | pnpm overrides force `postcss >= 8.5.23` and `deepmerge-ts >= 8`. `pnpm audit --prod`: no known vulnerabilities. Web build and Prisma generate verified. |
| 2 | Login redirect | `/login?next=` accepted any value starting with `/`, including `//evil.com` (protocol-relative, an open redirect after login). | Only same-origin paths are accepted (`/` not followed by `/` or `\`). |
| 3 | CSRF | Auth is cookie based. With `COOKIE_SAMESITE=lax` (default) cross-site writes are blocked by the browser, but split-domain deployments use `none`, where a cross-site HTML form could POST with the victim's cookies (simple requests bypass CORS preflight). | API middleware refuses `POST/PUT/PATCH/DELETE` whose `Origin` header is present and not in `WEB_ORIGIN`. Server-to-server callers (Stripe, worker) send no Origin and are unaffected. |
| 4 | Rate limiting | Client IP was taken from the **first** entry of `X-Forwarded-For`, which a client can forge; IP-based limits on login, registration, newsletter and password reset could be bypassed or pointed at someone else's IP. | The **last** entry (set by the trusted proxy) is used. |
| 5 | Payments | Card payment intents had no per-user rate limit: a logged-in user could open unlimited pending requests and gateway intents. | 10 intents per user per hour, like the other payment requests. |
| 6 | Containers | The API, worker and web images ran as root. | Runtime stages switch to the unprivileged `node` user; the upload directory and npm cache are owned by it. |
| 7 | Browser hardening | The web app sent no security headers beyond `X-Robots-Tag`. | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` on every response. |

## Verified as sound (no change needed)
- **Secrets**: no credentials in tracked files; `.env` is git-ignored; JWT secrets must be 32+ characters; the worker's internal token is compared with `timingSafeEqual`; Stripe keys only in environment.
- **Passwords**: 8 to 32 characters with upper, lower, digit and symbol; stored as salted hashes; password and token fields redacted from logs along with cookies and authorization headers.
- **Sessions**: short-lived access token + rotating refresh token; reuse of a rotated refresh token revokes every session of the user (theft signal); logout and admin freeze revoke immediately via Redis. Cookies are `HttpOnly`, `Secure` in production, scoped to the API domain.
- **Authorisation**: every route is authenticated by default (`@Public` is explicit); admin routes carry `@Roles('admin','superadmin')` at class level; clients can only read their own accounts, requests, documents and files (ownership checked in the service, 404 otherwise); the back office writes an audit row for every decision and configuration change.
- **Input validation**: all bodies and queries go through zod schemas; money is decimal strings with 2-dp checks; Prisma parameterised queries only (`$queryRaw` tagged templates, no `Unsafe` variants).
- **File uploads** (KYC, payment proof): 10 MB cap, MIME allow-list enforced by magic bytes (a renamed executable is rejected), server-generated UUID storage keys (no path traversal), private storage streamed through the API with `nosniff`, `no-store` and a sanitised `Content-Disposition`.
- **Trading engine**: orders rate-limited per account; balance changes only through the ledger with row locks; negative-balance clamp; idempotency keys supported.
- **Payments**: deposits/withdrawals are requests approved by staff (or a signed gateway webhook); withdrawals re-check available funds at approval; webhook signatures verified with the provider secret; replayed events are ignored (idempotent settlement).
- **Abuse limits**: login 10/min per IP and 20/h per email, registration 5/h per IP, password reset 3/h per email, uploads 20 to 30/h, tickets 10/h, newsletter 10/h.
- **Transport**: Helmet on the API; CORS restricted to `WEB_ORIGIN` with credentials; API served only on a subdomain of the web domain in production.
- **Privacy**: client area, terminal and back office are `noindex`; cookie banner sets nothing but the session cookie unless accepted.

## Recommendations (not done, decide when to schedule)
1. **Two-factor authentication** for back-office accounts (TOTP), then optional for clients. Highest-value next step for a money platform.
2. **Email verification** at registration and a notification email on login from a new device.
3. **Content-Security-Policy** on the web app with nonces (Next inline scripts and Stripe's iframe need allow-listing). Medium effort.
4. **Account lockout feedback**: today repeated failures are rate-limited; add a temporary lock with email notice after N failures.
5. **Admin IP allow-list or VPN** for `/admin` once the team is fixed.
6. **Dependency updates on a schedule** (`pnpm audit` in CI already fails the build on high severity).
7. **Penetration test** by a third party before accepting real client money, as most high-risk payment providers will ask for one.
