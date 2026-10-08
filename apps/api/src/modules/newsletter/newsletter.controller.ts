import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { Public } from '../../common/auth/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ApiError } from '../../common/errors';

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254),
  source: z.string().trim().max(40).optional(),
});

@Controller('newsletter')
@Public()
export class NewsletterController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Idempotent: re-subscribing an existing address re-activates it instead of failing. */
  @Post('subscribe')
  async subscribe(@Body(new ZodPipe(subscribeSchema)) body: z.infer<typeof subscribeSchema>, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || 'unknown';
    if (!(await this.redis.allow(`newsletter:ip:${ip}`, 10, 3600))) throw ApiError.tooMany('Too many attempts. Try again later.');

    await this.prisma.newsletterSubscriber.upsert({
      where: { email: body.email },
      create: { email: body.email, source: body.source ?? 'footer' },
      update: { active: true, unsubscribedAt: null },
    });
    return { ok: true };
  }
}
