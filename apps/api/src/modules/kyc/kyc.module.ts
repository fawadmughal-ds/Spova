import { Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycDeadlineService } from './kyc-deadline.service';
import { KycAdminController, KycController } from './kyc.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [KycService, KycDeadlineService],
  controllers: [KycController, KycAdminController],
  exports: [KycService, KycDeadlineService],
})
export class KycModule {}
