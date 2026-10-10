import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(level: string, pretty: boolean): Logger {
  return pino({
    level,
    base: { svc: 'worker' },
    transport: pretty ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,svc' } } : undefined,
  });
}
