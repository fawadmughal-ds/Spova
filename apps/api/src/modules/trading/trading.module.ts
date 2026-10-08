import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { InternalTradingController, MarketDataController, TradingAdminController, TradingController } from './trading.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountsModule } from '../accounts/accounts.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [LedgerModule, AccountsModule, RealtimeModule],
  providers: [TradingService],
  controllers: [TradingController, MarketDataController, InternalTradingController, TradingAdminController],
  exports: [TradingService],
})
export class TradingModule {}
