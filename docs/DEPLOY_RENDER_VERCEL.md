# Preview deploy: Render (API + worker + DB) and Vercel (web)

For client previews on free plans. Not for real money: free services sleep when idle, the free Postgres is
deleted after 30 days, and uploaded KYC files live on the service's disk (wiped on every deploy).

## 0. Before you start
- The repo must be on GitHub (`fawadmughal-ds/spova2`) with the latest `main`.
- Accounts: https://render.com and https://vercel.com (sign in with GitHub on both).

## 1. Render: database, Redis, API, worker (one Blueprint)
1. Render dashboard → **New → Blueprint** → pick the `spova2` repo → it reads `render.yaml` from the repo root.
2. It proposes: `spova-db` (Postgres, free), `spova-redis` (Key Value, free), `spova-api` and `spova-worker`
   (Docker, free). Click **Apply**. First build takes 5–10 minutes.
3. Open `spova-api` → **Environment** → set `WEB_ORIGIN` to your Vercel URL once you have it (step 2),
   e.g. `https://spova2.vercel.app` (comma-separate several). Save → it redeploys.
4. Note the API URL, e.g. `https://spova-api.onrender.com`. Check `https://spova-api.onrender.com/health/ready`
   returns `{"ok":true,...}`.
5. Admin login: `SEED_ADMIN_EMAIL` (default `admin@zerventa.local`) with the generated `SEED_ADMIN_PASSWORD`
   (read it in `spova-api` → Environment). A demo client `client@zerventa.local / Client@12345` (login 100001)
   is created because `SEED_DEMO_CLIENT=true`.

Why the worker is a "web" service: Render's free plan has no background workers, so the worker binds `$PORT`
and answers `/health`; its real work runs in the background.

## 2. Vercel: the website
1. Vercel → **Add New → Project** → import `spova2`.
2. **Root Directory**: `apps/web` (click Edit, choose the folder). Framework: Next.js (auto).
   The install/build commands come from `apps/web/vercel.json`.
3. **Environment variables** (Production + Preview):
   - `NEXT_PUBLIC_API_URL` = `https://spova-api.onrender.com`
   - `NEXT_PUBLIC_WS_URL`  = `https://spova-api.onrender.com`
   - `NEXT_PUBLIC_BRAND_NAME` = `Zerventa`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-project>.vercel.app`
4. Deploy. Copy the production URL and put it into Render's `WEB_ORIGIN` (step 1.3).

## 3. Check it works
- Open the Vercel URL → register a client → log in → `/app` shows the demo account.
- `/trade`: prices tick (crypto is live Binance; the rest is the synthetic demo feed).
- Admin: `/admin` with the seeded superadmin.

## Free-plan behaviour you will notice
- **Sleep after 15 min idle**: the first request takes 30–60 s (API cold start). The worker sleeps too, so
  prices stop until something wakes it. Keep both awake with a free pinger (UptimeRobot / cron-job.org)
  hitting `https://spova-api.onrender.com/health` and `https://spova-worker.onrender.com/health` every 5 min.
  Render free gives ~750 instance-hours a month; two always-awake services exceed that, so either let the
  worker sleep or upgrade one service to Starter ($7/month).
- **Postgres expires after 30 days** on the free plan (Render emails you). Upgrade to keep the data.
- **KYC uploads** are stored on local disk and vanish on redeploy. For a real deployment set
  `STORAGE_DRIVER=s3` with Cloudflare R2 keys.
- **Emails** print to the API log (`MAIL_PROVIDER=console`). Set `MAIL_PROVIDER=resend` + `RESEND_API_KEY`
  for real mail.

## The API must share your domain (required, not optional)
The web app's route guard reads the login cookie on the **web** domain, so the API must set cookies on the same
site. Put the API on a subdomain of your domain:
1. Render → `spova-api` → **Settings → Custom Domains** → add `api.yourdomain.com`.
2. DNS (Cloudflare/registrar): `CNAME api → spova-api.onrender.com` (DNS-only / grey cloud if Cloudflare).
3. Render → `spova-api` → **Environment**: `WEB_ORIGIN=https://www.yourdomain.com,https://yourdomain.com`,
   `COOKIE_SAMESITE=lax`, `COOKIE_DOMAIN=.yourdomain.com`. Save (redeploys).
4. Vercel → project → **Settings → Environment Variables**: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` =
   `https://api.yourdomain.com` → **Redeploy** (env vars are baked in at build time).
Only while you have no domain at all (pure `vercel.app` + `onrender.com`) use `COOKIE_SAMESITE=none`; then the
public pages work but Safari/iPhone block the login cookie and the client area cannot keep you signed in.

## Web domain
Vercel → Project → **Domains** → add `www.yourdomain.com` (and the apex) and follow the DNS records Vercel shows.
