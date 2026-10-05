import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [LedgerModule, AccountsModule, AuthModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
