import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportAdminController, SupportController } from './support.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [SupportService],
  controllers: [SupportController, SupportAdminController],
})
export class SupportModule {}
