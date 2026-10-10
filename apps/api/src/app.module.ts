import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { InfraModule } from './infra/infra.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AdminModule } from './modules/admin/admin.module';
import { MarketModule } from './modules/market/market.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { KycModule } from './modules/kyc/kyc.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SupportModule } from './modules/support/support.module';
import { TradingModule } from './modules/trading/trading.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { HealthController } from './modules/health/health.controller';
import { env } from './config/env';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        redact: ['req.headers.cookie', 'req.headers.authorization', 'req.body.password', 'req.body.current', 'req.body.next'],
        autoLogging: { ignore: (req) => req.url === '/health' },
      },
    }),
    InfraModule,
    QuotesModule,
    RealtimeModule,
    LedgerModule,
    AccountsModule,
    AuthModule,
    UsersModule,
    AdminModule,
    MarketModule,
    NewsletterModule,
    KycModule,
    PaymentsModule,
    SupportModule,
    TradingModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
