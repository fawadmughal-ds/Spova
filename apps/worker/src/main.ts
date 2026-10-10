import { loadConfig } from './config';
import { createLogger } from './logger';
import { createRedis, publishWs } from './redis';
import { createDb } from './db';
import { SymbolRegistry } from './symbols';
import { Ingest } from './feeds/ingest';
import { BinanceFeed } from './feeds/binance';
import { SyntheticFeed } from './feeds/synthetic';
import { OANDA_INSTRUMENTS, OandaFeed } from './feeds/oanda';
import { FeedHealth } from './feeds/health';
import { CandleService } from './candles/service';
import { CandleBackfill } from './candles/backfill';
import { runCandleRetention } from './candles/retention';
import { InternalClient } from './internal-client';
import { TradingIndex } from './risk/index';
import { RiskEngine } from './risk/engine';
import { SwapJob } from './jobs/swap';
import { startHeartbeat } from './jobs/heartbeat';
import { daily } from './jobs/scheduler';
import { startHealthServer } from './health-server';
import type { FeedAdapter } from './feed';
import type { TradingEvent } from '@spova/shared';

/**
 * Spova worker (Phase 3): price ingest -> candles -> risk loop -> jobs. Exactly one instance runs.
 * It never writes orders/positions/ledger itself; money moves only through the API's internal endpoints.
 */
async function main() {
  const cfg = loadConfig();
  const log = createLogger(cfg.LOG_LEVEL, cfg.NODE_ENV !== 'production');
  if (cfg.INTERNAL_TOKEN.length < 24) log.warn('INTERNAL_TOKEN is shorter than 24 chars; the API will refuse it in production');

  const redis = createRedis(cfg.REDIS_URL);
  const sub = createRedis(cfg.REDIS_URL, { subscriber: true });
  const db = createDb(cfg.DATABASE_URL);
  redis.on('error', (e) => log.warn({ err: e.message }, 'redis error'));
  sub.on('error', (e) => log.warn({ err: e.message }, 'redis(sub) error'));

  await db.$connect();
  const symbols = new SymbolRegistry(db, log);
  await symbols.load();
  symbols.startAutoReload();
  log.info({ symbols: symbols.enabled().length, binance: cfg.FEED_BINANCE, synthetic: cfg.FEED_SYNTHETIC, risk: cfg.RISK_ENGINE }, 'worker starting');

  // ---- ingest + candles
  const ingest = new Ingest(redis, symbols, log);
  await ingest.loadBookFromRedis();
  const candles = new CandleService(db, redis, log);
  ingest.onTick(candles.onTick);
  candles.start();

  // ---- risk loop (needs the API's internal endpoints)
  const api = new InternalClient(log, { baseUrl: cfg.API_URL, token: cfg.INTERNAL_TOKEN });
  let index: TradingIndex | undefined;
  let risk: RiskEngine | undefined;
  if (cfg.RISK_ENGINE) {
    index = new TradingIndex(api, log, cfg.INDEX_REFRESH_MS);
    risk = new RiskEngine(index, api, redis, ingest.book, symbols, log, { accountLoopMs: cfg.ACCOUNT_LOOP_MS });
    ingest.onTick(risk.onTick);
    await sub.subscribe('trading:events');
    sub.on('message', (channel, raw) => {
      if (channel !== 'trading:events') return;
      try {
        index!.onTradingEvent(JSON.parse(raw) as TradingEvent);
      } catch (e) {
        log.warn({ err: (e as Error).message }, 'bad trading event');
      }
    });
    await index.refresh(); // tolerant: logs and keeps an empty index when the API is down
    index.start();
    risk.start();
  }

  // ---- feeds
  const feeds: FeedAdapter[] = [];
  // OANDA takes over every synthetic symbol it can quote; the rest (shares) stay synthetic
  const oandaOn = cfg.FEED_OANDA && !!cfg.OANDA_TOKEN && !!cfg.OANDA_ACCOUNT_ID;
  if (cfg.FEED_OANDA && !oandaOn) log.error('FEED_OANDA=on but OANDA_TOKEN / OANDA_ACCOUNT_ID missing; staying on the synthetic feed');
  const oandaSymbols = new Set(oandaOn ? symbols.enabled().filter((s) => s.feedSource === 'synthetic' && OANDA_INSTRUMENTS[s.id]).map((s) => s.id) : []);
  const health = new FeedHealth(redis, symbols, ingest, log, { binance: cfg.FEED_BINANCE, synthetic: cfg.FEED_SYNTHETIC, oanda: oandaOn }, oandaSymbols);
  if (oandaOn) {
    const oanda = new OandaFeed(log, { token: cfg.OANDA_TOKEN, accountId: cfg.OANDA_ACCOUNT_ID, env: cfg.OANDA_ENV });
    oanda.onStatus = (s) => health.setOandaSocket(s === 'up');
    const map = Object.fromEntries([...oandaSymbols].map((id) => [OANDA_INSTRUMENTS[id], id]));
    await oanda.connect(map, (t) => ingest.handle(t));
    feeds.push(oanda);
    log.info({ symbols: [...oandaSymbols] }, 'oanda: real prices replace the synthetic feed for these symbols');
  }
  if (cfg.FEED_BINANCE) {
    const binance = new BinanceFeed(log);
    binance.onStatus = (s) => health.setBinanceSocket(s === 'up');
    await binance.connect(symbols.feedMap('binance'), (t) => ingest.handle(t));
    feeds.push(binance);
  }
  if (cfg.FEED_SYNTHETIC) {
    const infos = symbols
      .enabled()
      .filter((s) => s.feedSource === 'synthetic' && !oandaSymbols.has(s.id))
      .map((s) => {
        const q = ingest.book[s.id];
        return { id: s.id, assetClass: s.assetClass, digits: s.digits, startPrice: q ? (Number(q.bid) + Number(q.ask)) / 2 : undefined };
      });
    const synthetic = new SyntheticFeed(log, infos, (id, now) => symbols.isOpen(id, now));
    const synthMap = Object.fromEntries(Object.entries(symbols.feedMap('synthetic')).filter(([, id]) => !oandaSymbols.has(id)));
    await synthetic.connect(synthMap, (t) => ingest.handle(t));
    feeds.push(synthetic);
  }
  health.start();

  // ---- jobs
  const stopHeartbeat = startHeartbeat(redis, log);
  const swap = new SwapJob(api, redis, log);
  if (cfg.SWAP_CRON && cfg.RISK_ENGINE) swap.start();
  const stopRetention = daily(0, 5, 0, () => runCandleRetention(db, log).then(() => undefined), (e) => log.error({ err: e }, 'candle retention failed'));
  void runCandleRetention(db, log).catch((e) => log.warn({ err: e }, 'candle retention (boot) failed'));

  if (cfg.CANDLE_BACKFILL) {
    // first boot with OANDA on: drop the synthetic history of the symbols it quotes, so the chart shows real candles only
    if (oandaOn) {
      for (const id of oandaSymbols) {
        const key = `candles:source:${id}`;
        if ((await redis.get(key)) === 'oanda') continue;
        const gone = await db.candle.deleteMany({ where: { symbolId: id } });
        await redis.set(key, 'oanda');
        log.info({ symbol: id, deleted: gone.count }, 'synthetic history dropped; OANDA history will be backfilled');
      }
    }
    const backfill = new CandleBackfill(db, symbols, log, {
      minBars: cfg.CANDLE_BACKFILL_MIN_BARS,
      bars: cfg.CANDLE_BACKFILL_BARS,
      oanda: oandaOn ? { token: cfg.OANDA_TOKEN, accountId: cfg.OANDA_ACCOUNT_ID, env: cfg.OANDA_ENV, instruments: Object.fromEntries([...oandaSymbols].map((id) => [id, OANDA_INSTRUMENTS[id]])) } : undefined,
      currentPrice: (id) => {
        const q = ingest.book[id];
        return q ? (Number(q.bid) + Number(q.ask)) / 2 : undefined;
      },
    });
    // give the feeds a moment so synthetic history ends at a live price
    setTimeout(() => {
      backfill
        .run()
        .then((n) => log.info({ bars: n }, 'candle backfill complete'))
        .catch((e) => log.error({ err: e }, 'candle backfill failed'));
    }, 3000).unref();
  }

  // ---- optional HTTP health (PORT is set by hosts that require a bound port)
  const stopHealth = process.env.PORT ? startHealthServer(Number(process.env.PORT), log, () => ({ ingest: ingest.counters(), risk: risk?.stats })) : undefined;

  // ---- periodic status line
  const statusTimer = setInterval(() => {
    log.info({ ingest: ingest.counters(), candles: candles.stats(), index: index?.stats(), risk: risk?.stats }, 'status');
  }, 30_000);
  statusTimer.unref();

  // ---- shutdown
  let stopping = false;
  const shutdown = async (sig: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ sig }, 'shutting down');
    const timeout = setTimeout(() => {
      log.error('shutdown timed out, exiting');
      process.exit(1);
    }, 10_000);
    timeout.unref();
    try {
      clearInterval(statusTimer);
      stopHeartbeat();
      stopRetention();
      if (stopHealth) await stopHealth();
      swap.halt();
      health.stop();
      symbols.stop();
      await Promise.all(feeds.map((f) => f.disconnect()));
      risk?.stop();
      index?.stop();
      ingest.flush();
      await candles.stop();
      await publishWs(redis, 'admin', 'worker:status', { status: 'down', ts: Date.now() }).catch(() => {});
      await Promise.all([redis.quit().catch(() => {}), sub.quit().catch(() => {}), db.$disconnect().catch(() => {})]);
      log.info('bye');
      process.exit(0);
    } catch (e) {
      log.error({ err: e }, 'shutdown error');
      process.exit(1);
    }
  };
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void shutdown(sig));
  process.on('unhandledRejection', (reason) => log.error({ err: reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'uncaughtException');
    void shutdown('uncaughtException');
  });

  log.info('worker up');
}

main().catch((e) => {
  // logger may not exist yet (config error)
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
