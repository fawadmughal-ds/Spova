import { createServer } from 'node:http';
import type { Logger } from './logger';

/**
 * Minimal HTTP endpoint so the worker can run where a bound port is required (Render web services,
 * uptime pingers). GET /health -> {ok, uptime}. Only started when PORT is set.
 */
export function startHealthServer(port: number, log: Logger, status: () => Record<string, unknown>) {
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, uptime: Math.round(process.uptime()), ...status() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, '0.0.0.0', () => log.info({ port }, 'health server listening'));
  return () => new Promise<void>((r) => server.close(() => r()));
}
