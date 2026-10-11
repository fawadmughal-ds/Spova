import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { env } from './config/env';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  // Allowed browser origins: the WEB_ORIGIN list, plus the app's own domain and its subdomains (APP_DOMAIN),
  // so a mistyped WEB_ORIGIN on the host cannot lock every client out of login.
  const listed = new Set(env.WEB_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean));
  const ownDomain = env.APP_DOMAIN && env.APP_DOMAIN !== 'localhost' ? env.APP_DOMAIN.toLowerCase() : null;
  const originAllowed = (origin: string) => {
    if (listed.has(origin)) return true;
    if (!ownDomain) return false;
    try {
      const u = new URL(origin);
      return u.protocol === 'https:' && (u.hostname === ownDomain || u.hostname.endsWith(`.${ownDomain}`));
    } catch {
      return false;
    }
  };
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || originAllowed(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-CSRF'],
  });
  // CSRF defence in depth: a browser always sends Origin on cross-site POST/PUT/PATCH/DELETE (forms included).
  // Cookies may run with SameSite=None on split-domain deployments, so refuse state changes from any
  // origin outside WEB_ORIGIN. Server-to-server callers (Stripe webhooks, the worker) send no Origin.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (origin && !originAllowed(origin)) {
      res.status(403).json({ code: 'origin_forbidden', message: 'Cross-site request refused' });
      return;
    }
    next();
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(env.API_PORT, '0.0.0.0');
}

bootstrap();
