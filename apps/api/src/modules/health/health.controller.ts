import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { Public } from '../../common/auth/decorators';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  live() {
    return { ok: true, ts: Date.now() };
  }

  @Get('ready')
  async ready() {
    const [db, redis] = await Promise.allSettled([this.prisma.$queryRaw`SELECT 1`, this.redis.client.ping()]);
    const ok = db.status === 'fulfilled' && redis.status === 'fulfilled';
    return { ok, db: db.status === 'fulfilled', redis: redis.status === 'fulfilled' };
  }
}
