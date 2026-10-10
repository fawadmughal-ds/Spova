import { Module } from '@nestjs/common';
import { ControlService } from './control.service';
import { ControlController, PlatformPublicController } from './control.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RealtimeModule, AuthModule],
  providers: [ControlService],
  controllers: [ControlController, PlatformPublicController],
  exports: [ControlService],
})
export class ControlModule {}
