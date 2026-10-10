import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsAdminController, PaymentsController, PaymentsWebhookController } from './payments.controller';
import { StripeService } from './stripe.service';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountsModule } from '../accounts/accounts.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [LedgerModule, AccountsModule, RealtimeModule],
  providers: [PaymentsService, StripeService],
  controllers: [PaymentsController, PaymentsWebhookController, PaymentsAdminController],
})
export class PaymentsModule {}
