import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsAdminController, PaymentsController } from './payments.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountsModule } from '../accounts/accounts.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [LedgerModule, AccountsModule, RealtimeModule],
  providers: [PaymentsService],
  controllers: [PaymentsController, PaymentsAdminController],
})
export class PaymentsModule {}
