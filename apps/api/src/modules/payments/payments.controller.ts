import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  depositRequestSchema,
  paginationSchema,
  paymentDecisionSchema,
  withdrawRequestSchema,
  type DepositRequestInput,
  type PaymentDecisionInput,
  type WithdrawRequestInput,
} from '@spova/shared';
import { PaymentsService } from './payments.service';
import { ClientIp, CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const listQuery = paginationSchema.extend({
  kind: z.enum(['deposit', 'withdraw']).optional(),
  status: z.enum(['pending', 'approved', 'declined', 'cancelled']).optional(),
});
const adminQuery = listQuery.extend({ userId: z.string().uuid().optional() });

@Controller('me/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('methods')
  methods() {
    return this.payments.methods();
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.payments.list(user.id, q);
  }

  @Post('deposit')
  deposit(@CurrentUser() user: AuthUser, @Body(new ZodPipe(depositRequestSchema)) body: DepositRequestInput) {
    return this.payments.deposit(user.id, body);
  }

  @Post('withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Body(new ZodPipe(withdrawRequestSchema)) body: WithdrawRequestInput) {
    return this.payments.withdraw(user.id, body);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.cancel(user.id, id);
  }
}

@Controller('admin/payments')
@Roles('admin', 'superadmin')
export class PaymentsAdminController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  queue(@Query(new ZodPipe(adminQuery)) q: z.infer<typeof adminQuery>) {
    return this.payments.queue(q);
  }

  @Patch(':id')
  decide(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(paymentDecisionSchema)) body: PaymentDecisionInput) {
    return this.payments.decide({ id: actor.id, ip }, id, body);
  }
}
