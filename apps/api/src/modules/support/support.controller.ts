import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { createTicketSchema, paginationSchema, ticketMessageSchema, ticketStatusSchema, type CreateTicketInput, type TicketMessageInput } from '@spova/shared';
import { SupportService } from './support.service';
import { ClientIp, CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const inboxQuery = paginationSchema.extend({
  status: z.enum(['open', 'answered', 'closed']).optional(),
  userId: z.string().uuid().optional(),
});

@Controller('me/tickets')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.support.listMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createTicketSchema)) body: CreateTicketInput) {
    return this.support.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.support.getMine(user.id, id);
  }

  @Post(':id/messages')
  reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ticketMessageSchema)) body: TicketMessageInput) {
    return this.support.replyMine(user.id, id, body.body);
  }

  /** Clients can only close. */
  @Post(':id/close')
  close(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.support.closeMine(user.id, id);
  }
}

@Controller('admin/tickets')
@Roles('admin', 'superadmin')
export class SupportAdminController {
  constructor(private readonly support: SupportService) {}

  @Get()
  inbox(@Query(new ZodPipe(inboxQuery)) q: z.infer<typeof inboxQuery>) {
    return this.support.inbox(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.support.get(id);
  }

  @Post(':id/messages')
  reply(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(ticketMessageSchema)) body: TicketMessageInput) {
    return this.support.reply({ id: actor.id, ip }, id, body.body);
  }

  @Patch(':id')
  status(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(ticketStatusSchema)) body: z.infer<typeof ticketStatusSchema>) {
    return this.support.setStatus({ id: actor.id, ip }, id, body.status);
  }
}
