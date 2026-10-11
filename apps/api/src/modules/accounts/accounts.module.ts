import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { StatementService } from './statement.service';
import { AccountsController } from './accounts.controller';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [AccountsService, StatementService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
