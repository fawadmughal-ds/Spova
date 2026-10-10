import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Back-office editable configuration rows (`app_settings`). Values are JSON; callers validate with zod. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  async set(key: string, value: unknown, updatedBy?: string) {
    const json = value as Prisma.InputJsonValue;
    await this.prisma.appSetting.upsert({ where: { key }, create: { key, value: json, updatedBy: updatedBy ?? null }, update: { value: json, updatedBy: updatedBy ?? null } });
  }
}
