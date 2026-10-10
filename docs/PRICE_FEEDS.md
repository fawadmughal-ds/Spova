# Price feeds: where prices come from and how to match Spova

## Where Spova's prices come from
Spova runs on MatchTrader (Match-Trade Technologies). The platform itself has no public price API:
the broker's prices come from its **liquidity providers** (banks / prime-of-prime such as Finalto,
B2Broker, Match-Prime...) through MatchTrader's bridge, and each broker then adds its own spread markup.
So nobody can subscribe to "Spova's feed". What we can do is quote the **same underlying market** and
set our markup so the displayed spreads match the ones Spova publishes on its website.

Two prices from two brokers on the same instrument always differ by a fraction of a pip (different LPs,
different markup, different tick timing). That is normal; MatchTrader brokers differ from each other too.

## What we use today
| Asset class | Source | Cost |
|---|---|---|
| Crypto (BTC, ETH, LTC, XRP, SOL) | Binance bookTicker websocket | free, no key |
| Forex, metals, indices, energies | **OANDA v20 streaming** (`FEED_OANDA=on`), else **Finnhub's OANDA relay** (`FEED_FINNHUB=on`), else the synthetic demo feed | free |
| Shares (AAPL, TSLA, AMZN, NVDA) | **Finnhub** trade websocket (`FEED_FINNHUB=on`), else synthetic | free |

Priority per symbol: direct OANDA > Finnhub > synthetic. Shares only exist on Finnhub.

## Finnhub (works from Pakistan, no documents)
1. https://finnhub.io -> **Get free API key** (email only). Copy the key.
2. Worker env: `FEED_FINNHUB=on`, `FINNHUB_TOKEN=<key>`, `FINNHUB_FOREX=on`. Restart the worker.
3. The log shows `finnhub: connected and subscribed`; `feed:finnhub:status` in Redis goes `up`.
Limits of the free tier: 50 websocket symbols (we use 24), US share trades during US market hours, forex /
metals / indices relayed from OANDA. **No candle history on the free tier**, so those symbols keep the
synthetic history generated backwards from the live price until a candle source exists (a direct OANDA
account backfills real history, see below). The live candles are real from the moment the feed is on.

The synthetic feed is a demo generator: realistic movement, session-aware, but **not the market**. Switch
OANDA on before any real client trades.

## OANDA direct (real history too; not available to Pakistan residents)
OANDA does not open accounts, demo included, for residents of Pakistan. The demo signup needs only name,
email and phone (no documents), but the country list must contain your country of residence. If a partner or
company entity in a supported country (UAE, UK, EU, Singapore, Australia, ...) opens the practice account,
its token can be used by the worker from anywhere; that is a decision for the business owner, not a
technical one.

### Turning on real prices (OANDA, free)
1. Create a free practice account at https://www.oanda.com (any region's demo signup works).
2. In the account portal open **Manage API Access** and generate a **personal access token**.
3. Note the practice **account ID** (format `101-004-1234567-001`).
4. Set on the worker (Render env or `.env`):
   ```
   FEED_OANDA=on
   OANDA_TOKEN=<token>
   OANDA_ACCOUNT_ID=101-004-1234567-001
   OANDA_ENV=practice
   ```
5. Restart the worker. The log shows `oanda: streaming` and the list of symbols it took over. Redis key
   `feed:oanda:status` reports `up`/`down`; the terminal's wifi icon reflects it.
6. On that first boot the worker deletes the synthetic candle history of those symbols and backfills real
   OANDA candles for every timeframe (`CANDLE_BACKFILL_BARS` per timeframe, 1500 by default), so the chart
   shows real history behind the live ticks. This happens once; later boots keep the accumulated candles.

Practice and live OANDA accounts stream the same market prices; the practice one is free and enough for
the feed. Instrument mapping lives in `apps/worker/src/feeds/oanda.ts` (`OANDA_INSTRUMENTS`): EUR_USD,
XAU_USD, SPX500_USD, NAS100_USD, US30_USD, DE30_EUR, UK100_GBP, WTICO_USD, BCO_USD, NATGAS_USD, ...

## Matching Spova's spreads
Our quote = venue price +/- `spreadMarkup / 2` per symbol (`symbols.spread_markup` in the DB, editable in
the admin symbol settings). Spova lists typical spreads per account tier on its website (we copied them in
the tier pages). Set each symbol's markup so `ask - bid` on our terminal equals the Spova spread for the
tier you want to mirror; the mid price then tracks the same market.

## If you want to buy a feed later
Only needed for shares or if OANDA's instrument list is too small:
- **Polygon.io** (stocks + forex + crypto, websocket, from ~$29/month for delayed, ~$199 real-time stocks).
- **Twelve Data** (forex, stocks, indices, crypto; websocket on the Pro plan, ~$79/month).
- **Finnhub** (US stocks real-time trades websocket on the free tier, 60 REST calls/min).
Any of these plugs in as a `FeedAdapter` in `apps/worker/src/feeds/`, exactly like Binance and OANDA.
