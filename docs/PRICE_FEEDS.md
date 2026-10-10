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
| Forex, metals, indices, energies | **OANDA v20 streaming** (`FEED_OANDA=on`) or the synthetic demo feed | free (practice account) |
| Shares (AAPL, TSLA, AMZN, NVDA) | synthetic demo feed | - |

The synthetic feed is a demo generator: realistic movement, session-aware, but **not the market**. Switch
OANDA on before any real client trades.

## Turning on real prices (OANDA, free)
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
