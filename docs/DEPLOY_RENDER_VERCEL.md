# Preview deploy: Render (API + DB) and Vercel (web)

For client previews on free plans. Not for real money: free services sleep when idle, the free Postgres is
deleted after 30 days.

## 0. Before you start
- The repo must be on GitHub (`fawadmughal-ds/Spova`) with the latest `main`.
- Accounts: https://render.com and https://vercel.com (sign in with GitHub on both).

## 1. Render: database, Redis, API (one Blueprint)
1. Render dashboard → **New → Blueprint** → pick the `Spova` repo → it reads `render.yaml` from the repo root.
2. It proposes: `spova-db` (Postgres, free), `spova-redis` (Key Value, free) and `spova-api` (Docker, free). Click **Apply**. First build takes 5–10 minutes.
3. Open `spova-api` → **Environment** → set `WEB_ORIGIN` to your Vercel URL once you have it (step 2),
   e.g. `https://spova.vercel.app` (comma-separate several). Save → it redeploys.
4. Note the API URL, e.g. `https://spova-api.onrender.com`. Check `https://spova-api.onrender.com/health/ready`
   returns `{"ok":true,...}`.
5. Admin login: `SEED_ADMIN_EMAIL` (default `admin@xyz.local`) with the generated `SEED_ADMIN_PASSWORD`
   (read it in `spova-api` → Environment). A demo client `client@xyz.local / Client@12345` (login 100001)
   is created because `SEED_DEMO_CLIENT=true`.


## 2. Vercel: the website
1. Vercel → **Add New → Project** → import `Spova`.
2. **Root Directory**: `apps/web` (click Edit, choose the folder). Framework: Next.js (auto).
   The install/build commands come from `apps/web/vercel.json`.
3. **Environment variables** (Production + Preview):
   - `NEXT_PUBLIC_API_URL` = `https://spova-api.onrender.com`
   - `NEXT_PUBLIC_WS_URL`  = `https://spova-api.onrender.com`
   - `NEXT_PUBLIC_BRAND_NAME` = `XYZ` (or the real brand)
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-project>.vercel.app`
4. Deploy. Copy the production URL and put it into Render's `WEB_ORIGIN` (step 1.3).

## 3. Check it works
- Open the Vercel URL → register a client → log in → `/app` shows the demo account.
- Admin: `/admin` with the seeded superadmin.

## Free-plan behaviour you will notice
- **Sleep after 15 min idle**: the first request takes 30–60 s (API cold start). Keep it awake with a free pinger
  (UptimeRobot / cron-job.org) hitting `https://spova-api.onrender.com/health` every 5 min.
- **Postgres expires after 30 days** on the free plan (Render emails you). Upgrade to keep the data.
- **Emails** print to the API log (`MAIL_PROVIDER=console`). Set `MAIL_PROVIDER=resend` + `RESEND_API_KEY`
  for real mail.

## Cookies across two domains
The web (vercel.app) and the API (onrender.com) are different sites, so the API sets its auth cookies with
`SameSite=None; Secure` (`COOKIE_SAMESITE=none`, already in `render.yaml`). If you later serve both under one
domain (e.g. `app.example.com` + `api.example.com`), switch back to `lax` and set `COOKIE_DOMAIN=.example.com`.

## Custom domain later
Vercel → Project → Domains → add `www.yourdomain.com`; Render → `spova-api` → Settings → Custom domain
`api.yourdomain.com`; then update `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `WEB_ORIGIN`, and the cookie
settings above.
