import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { createAccountSchema, paginationSchema, type LedgerEntryDto } from '@spova/shared';
import { z } from 'zod';
import { AccountsService } from './accounts.service';
import { LedgerService } from '../ledger/ledger.service';
import { CurrentUser } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { money } from '../../common/money';
import type { LedgerEntry } from '@prisma/client';

export const ledgerToDto = (e: LedgerEntry): LedgerEntryDto => ({
  id: e.id,
  accountId: e.accountId,
  type: e.type,
  amount: money(e.amount),
  balanceAfter: money(e.balanceAfter),
  creditAfter: money(e.creditAfter),
  reason: e.reason,
  refType: e.refType,
  refId: e.refId,
  actorId: e.actorId,
  createdAt: e.createdAt.toISOString(),
});

@Controller('me/accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.accounts.listForUser(user.id);
    const dtos = await Promise.all(rows.map((r) => this.accounts.toDto(r)));
    return { demo: dtos.filter((d) => d.type === 'demo'), live: dtos.filter((d) => d.type === 'live') };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createAccountSchema)) body: z.infer<typeof createAccountSchema>) {
    const acc = await this.accounts.create(user.id, body.type);
    return this.accounts.toDto(acc);
  }

  @Get(':id')
  async one(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const acc = await this.accounts.getOwned(user.id, id);
    return this.accounts.toDto(acc);
  }

  @Get(':id/ledger')
  async ledgerList(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodPipe(paginationSchema)) q: z.infer<typeof paginationSchema>,
  ) {
    await this.accounts.getOwned(user.id, id);
    const r = await this.ledger.list(id, q.page, q.limit);
    return { ...r, items: r.items.map(ledgerToDto) };
  }
}
