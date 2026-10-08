import { Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycAdminController, KycController } from './kyc.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [KycService],
  controllers: [KycController, KycAdminController],
  exports: [KycService],
})
export class KycModule {}
