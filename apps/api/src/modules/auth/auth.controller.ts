import { Body, Controller, Get, Headers, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  COOKIE_NAMES,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginInput,
  type RegisterInput,
} from '@spova/shared';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ClientIp, CurrentUser, Public } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { RedisService } from '../../infra/redis.service';
import { SettingsService } from '../../infra/settings.service';
import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettings } from '@spova/shared';
import { ApiError } from '../../common/errors';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodPipe(registerSchema)) body: RegisterInput,
    @ClientIp() ip: string,
    @Headers('user-agent') ua: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!(await this.redis.allow(`register:ip:${ip}`, 5, 3600))) throw ApiError.tooMany();
    const platform = await this.settings.getCached<PlatformSettings>('platform', DEFAULT_PLATFORM_SETTINGS);
    if (!platform.registrationOpen) throw ApiError.forbidden('registration_closed', 'New registrations are paused. Please try again later.');
    const { me, tokens } = await this.auth.register(body, { ip, ua });
    setAuthCookies(res, tokens);
    return me;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @ClientIp() ip: string,
    @Headers('user-agent') ua: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { me, tokens } = await this.auth.login(body, { ip, ua });
    setAuthCookies(res, tokens);
    return me;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @ClientIp() ip: string,
    @Headers('user-agent') ua: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.auth.refresh(req.cookies?.[COOKIE_NAMES.REFRESH], { ip, ua });
      setAuthCookies(res, tokens);
      return { ok: true };
    } catch (e) {
      clearAuthCookies(res);
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sessionId);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Public()
  @Post('deposit-link')
  @HttpCode(200)
  async depositLink(
    @Body(new ZodPipe(z.object({ token: z.string().min(10).max(2000) }))) body: { token: string },
    @ClientIp() ip: string,
    @Headers('user-agent') ua: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { me, tokens } = await this.auth.consumeDepositLink(body.token, { ip, ua });
    setAuthCookies(res, tokens);
    return { ok: true, me, panel: 'deposit' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Body(new ZodPipe(forgotPasswordSchema)) body: z.infer<typeof forgotPasswordSchema>, @ClientIp() ip: string) {
    await this.auth.forgotPassword(body.email, ip);
    return { ok: true };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body(new ZodPipe(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>) {
    await this.auth.resetPassword(body.token, body.password);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
