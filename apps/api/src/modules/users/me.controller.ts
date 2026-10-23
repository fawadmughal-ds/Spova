import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { changePasswordSchema, notificationPrefsSchema, onboardingSchema, updateProfileSchema, type OnboardingInput, type UpdateProfileInput } from '@spova/shared';
import { z } from 'zod';
import { PrismaService } from '../../infra/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @Get('profile')
  async profile(@CurrentUser() user: AuthUser) {
    const me = await this.auth.me(user.id);
    return me.profile;
  }

  @Patch('profile')
  async update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput) {
    await this.prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName }),
        ...(body.lastName !== undefined && { lastName: body.lastName }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.dob !== undefined && { dob: new Date(body.dob) }),
        ...(body.countryCode !== undefined && { countryCode: body.countryCode }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.zip !== undefined && { zip: body.zip }),
        ...(body.language !== undefined && { language: body.language }),
      },
    });
    const me = await this.auth.me(user.id);
    return me.profile;
  }

  /** Required onboarding completed on first dashboard entry: DOB, country, address + the suitability questionnaire. */
  @Post('onboarding')
  async onboarding(@CurrentUser() user: AuthUser, @Body(new ZodPipe(onboardingSchema)) body: OnboardingInput) {
    await this.prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        dob: new Date(body.dob),
        countryCode: body.countryCode,
        address: body.address,
        city: body.city,
        zip: body.zip || null,
        sourceOfFunds: body.sourceOfFunds,
        employmentStatus: body.employmentStatus,
        jobRole: body.jobRole,
        jobRoleOther: body.jobRole === 'other' ? (body.jobRoleOther ?? null) : null,
        annualIncome: body.annualIncome,
        netWorth: body.netWorth,
        expectedDeposit: body.expectedDeposit,
        tradingExperience: body.tradingExperience,
        tradingObjective: body.tradingObjective,
        usCitizen: body.usCitizen,
        pep: body.pep,
      },
    });
    return this.auth.me(user.id);
  }

  @Get('notification-prefs')
  async prefs(@CurrentUser() user: AuthUser) {
    const p = await this.prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    return { email: p.notifEmail, sms: p.notifSms, push: p.notifPush, calls: p.notifCalls };
  }

  @Patch('notification-prefs')
  async updatePrefs(@CurrentUser() user: AuthUser, @Body(new ZodPipe(notificationPrefsSchema)) body: z.infer<typeof notificationPrefsSchema>) {
    const p = await this.prisma.userProfile.update({
      where: { userId: user.id },
      data: {
        ...(body.email !== undefined && { notifEmail: body.email }),
        ...(body.sms !== undefined && { notifSms: body.sms }),
        ...(body.push !== undefined && { notifPush: body.push }),
        ...(body.calls !== undefined && { notifCalls: body.calls }),
      },
    });
    return { email: p.notifEmail, sms: p.notifSms, push: p.notifPush, calls: p.notifCalls };
  }

  @Patch('password')
  async password(@CurrentUser() user: AuthUser, @Body(new ZodPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>) {
    await this.auth.changePassword(user.id, body.current, body.next, user.sessionId);
    return { ok: true };
  }
}
