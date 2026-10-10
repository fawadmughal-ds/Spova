import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { MailService } from './mail.service';
import { StorageService } from './storage.service';
import { SettingsService } from './settings.service';
import { env } from '../config/env';

@Global()
@Module({
  imports: [JwtModule.register({ secret: env.JWT_ACCESS_SECRET })],
  providers: [PrismaService, RedisService, MailService, StorageService, SettingsService],
  exports: [PrismaService, RedisService, MailService, StorageService, SettingsService, JwtModule],
})
export class InfraModule {}
