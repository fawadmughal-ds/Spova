import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  adminCreditSchema,
  adminDebitSchema,
  adminUpdateAccountSchema,
  adminUpdateUserSchema,
  moneySchema,
  paginationSchema,
  type AdminCreditInput,
  type AdminDebitInput,
} from '@spova/shared';
import { AdminService } from './admin.service';
import { ClientIp, CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const listUsersQuery = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'frozen', 'closed']).optional(),
});
const listAccountsQuery = z.object({
  userId: z.string().uuid().optional(),
  type: z.enum(['demo', 'live']).optional(),
  loginCode: z.coerce.number().int().optional(),
});
const auditQuery = paginationSchema.extend({
  targetId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
});
const removeCreditSchema = z.object({ amount: moneySchema, reason: z.string().trim().min(3).max(300) });

@Controller('admin')
@Roles('admin', 'superadmin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  users(@Query(new ZodPipe(listUsersQuery)) q: z.infer<typeof listUsersQuery>) {
    return this.admin.listUsers(q);
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string,
    @Param('id') id: string,
    @Body(new ZodPipe(adminUpdateUserSchema)) body: z.infer<typeof adminUpdateUserSchema>,
  ) {
    return this.admin.updateUser({ ...actor, ip }, id, body);
  }

  @Get('accounts')
  accounts(@Query(new ZodPipe(listAccountsQuery)) q: z.infer<typeof listAccountsQuery>) {
    return this.admin.listAccounts(q);
  }

  @Patch('accounts/:id')
  updateAccount(
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string,
    @Param('id') id: string,
    @Body(new ZodPipe(adminUpdateAccountSchema)) body: z.infer<typeof adminUpdateAccountSchema>,
  ) {
    return this.admin.updateAccount({ ...actor, ip }, id, body);
  }

  @Post('accounts/:id/credit')
  credit(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(adminCreditSchema)) body: AdminCreditInput) {
    return this.admin.credit({ ...actor, ip }, id, body);
  }

  @Post('accounts/:id/debit')
  debit(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(adminDebitSchema)) body: AdminDebitInput) {
    return this.admin.debit({ ...actor, ip }, id, body);
  }

  @Post('accounts/:id/remove-credit')
  removeCredit(
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string,
    @Param('id') id: string,
    @Body(new ZodPipe(removeCreditSchema)) body: z.infer<typeof removeCreditSchema>,
  ) {
    return this.admin.removeCredit({ ...actor, ip }, id, body);
  }

  @Get('accounts/:id/ledger')
  ledger(@Param('id') id: string, @Query(new ZodPipe(paginationSchema)) q: z.infer<typeof paginationSchema>) {
    return this.admin.accountLedger(id, q.page, q.limit);
  }

  @Get('audit')
  audit(@Query(new ZodPipe(auditQuery)) q: z.infer<typeof auditQuery>) {
    return this.admin.audit(q);
  }
}
