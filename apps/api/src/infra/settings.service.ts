import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Back-office editable configuration rows (`app_settings`). Values are JSON; callers validate with zod. */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cache = new Map<string, { at: number; value: unknown }>();

  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : fallback;
  }

  /** Hot-path read (order placement, registration): the row is re-read at most every `ttlMs`. */
  async getCached<T>(key: string, fallback: T, ttlMs = 5000): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
    const value = await this.get(key, fallback);
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  async set(key: string, value: unknown, updatedBy?: string) {
    const json = value as Prisma.InputJsonValue;
    await this.prisma.appSetting.upsert({ where: { key }, create: { key, value: json, updatedBy: updatedBy ?? null }, update: { value: json, updatedBy: updatedBy ?? null } });
    this.cache.delete(key);
  }
}
