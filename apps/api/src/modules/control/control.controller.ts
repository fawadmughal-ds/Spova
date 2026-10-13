import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ApiError } from '../../common/errors';
import {
  TIERS,
  adminSymbolPatchSchema,
  broadcastSchema,
  platformSettingsSchema,
  riskConfigSchema,
  staffCreateSchema,
  staffPatchSchema,
  type AdminSymbolPatch,
  type BroadcastInput,
  type PlatformSettings,
  type RiskConfigInput,
  type StaffCreateInput,
  type StaffPatchInput,
  type Tier, emailSettingsSchema, type EmailSettings, emailTemplatesSchema, type EmailTemplates, EMAIL_TYPES, type EmailType } from '@spova/shared';
import { ControlService } from './control.service';
import { ClientIp, CurrentUser, Public, Roles } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const tierParam = z.enum(TIERS);

@Controller('admin')
@Roles('admin', 'superadmin')
export class ControlController {
  constructor(private readonly control: ControlService) {}

  @Get('symbols')
  symbols() {
    return this.control.symbols();
  }

  @Patch('symbols/:id')
  patchSymbol(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(adminSymbolPatchSchema)) body: AdminSymbolPatch) {
    return this.control.patchSymbol({ ...actor, ip }, id, body);
  }

  @Get('risk-config')
  risk() {
    return this.control.riskConfigs();
  }

  @Put('risk-config/:tier')
  putRisk(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('tier', new ZodPipe(tierParam)) tier: Tier, @Body(new ZodPipe(riskConfigSchema)) body: RiskConfigInput) {
    return this.control.putRiskConfig({ ...actor, ip }, tier, body);
  }

  @Get('platform')
  platform() {
    return this.control.platform();
  }

  @Put('platform')
  setPlatform(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Body(new ZodPipe(platformSettingsSchema)) body: PlatformSettings) {
    return this.control.setPlatform({ ...actor, ip }, body);
  }

  @Get('email-settings')
  emailSettings() {
    return this.control.emailSettings();
  }

  @Put('email-settings')
  setEmailSettings(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Body(new ZodPipe(emailSettingsSchema)) body: EmailSettings) {
    return this.control.setEmailSettings({ ...actor, ip }, body);
  }

  @Get('email-templates')
  emailTemplates() {
    return this.control.emailTemplates();
  }

  @Put('email-templates')
  setEmailTemplates(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Body(new ZodPipe(emailTemplatesSchema)) body: EmailTemplates) {
    return this.control.setEmailTemplates({ ...actor, ip }, body);
  }

  @Get('email-preview/:type')
  emailPreview(@Param('type') type: string) {
    if (!(EMAIL_TYPES as readonly string[]).includes(type)) throw ApiError.badRequest('bad_type', 'Unknown email type');
    return this.control.emailPreview(type as EmailType);
  }

  @Get('staff')
  staff() {
    return this.control.staff();
  }

  @Post('staff')
  createStaff(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Body(new ZodPipe(staffCreateSchema)) body: StaffCreateInput) {
    return this.control.createStaff({ ...actor, ip }, body);
  }

  @Patch('staff/:id')
  patchStaff(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(staffPatchSchema)) body: StaffPatchInput) {
    return this.control.patchStaff({ ...actor, ip }, id, body);
  }

  @Post('broadcast')
  broadcast(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Body(new ZodPipe(broadcastSchema)) body: BroadcastInput) {
    return this.control.broadcast({ ...actor, ip }, body);
  }
}

/** Switches the apps need before login (registration) and while trading (halt, announcement). */
@Controller('market')
@Public()
export class PlatformPublicController {
  constructor(private readonly control: ControlService) {}

  @Get('platform')
  platform() {
    return this.control.platformPublic();
  }
}
