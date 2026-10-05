import { Injectable } from '@nestjs/common';
import { LedgerType, Prisma, TradingAccount } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { PrismaService } from '../../infra/prisma.service';
import { D, toDb, ZERO } from '../../common/money';
import { ApiError } from '../../common/errors';

export interface PostEntryInput {
  accountId: string;
  type: LedgerType;
  /** Signed amount. Positive adds money, negative removes. */
  amount: Decimal;
  reason: string;
  refType?: string;
  refId?: string;
  actorId?: string | null;
  /** 'balance' (default) or 'credit' bucket. bonus -> credit. */
  bucket?: 'balance' | 'credit';
  /** Allow balance to go negative (superadmin force). */
  allowNegative?: boolean;
}

export interface PostEntryResult {
  entryId: string;
  balanceAfter: Decimal;
  creditAfter: Decimal;
  account: TradingAccount;
}

/**
 * The ONLY code path that changes trading_accounts.balance / credit.
 * Pattern (ARCHITECTURE §07): SELECT ... FOR UPDATE -> INSERT ledger_entries -> UPDATE account. Same transaction.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Post inside an existing transaction (so callers can bundle audit/payment updates). */
  async postInTx(tx: Prisma.TransactionClient, input: PostEntryInput): Promise<PostEntryResult> {
    if (input.amount.decimalPlaces() > 2) throw ApiError.badRequest('money_precision', 'Amount has more than 2 decimals');
    if (input.amount.isZero()) throw ApiError.badRequest('money_zero', 'Amount must not be zero');

    const rows = await tx.$queryRaw<TradingAccount[]>`
      SELECT * FROM trading_accounts WHERE id = ${input.accountId}::uuid FOR UPDATE
    `;
    const acc = rows[0];
    if (!acc) throw ApiError.notFound('account_not_found', 'Trading account not found');

    const bucket = input.bucket ?? 'balance';
    let balanceAfter = D(acc.balance);
    let creditAfter = D(acc.credit);

    if (bucket === 'balance') balanceAfter = balanceAfter.plus(input.amount);
    else creditAfter = creditAfter.plus(input.amount);

    if (!input.allowNegative) {
      if (balanceAfter.lt(ZERO)) {
        throw ApiError.unprocessable('insufficient_balance', 'Insufficient balance', {
          balance: acc.balance.toString(),
          requested: input.amount.abs().toFixed(2),
        });
      }
      if (creditAfter.lt(ZERO)) {
        throw ApiError.unprocessable('insufficient_credit', 'Insufficient credit', {
          credit: acc.credit.toString(),
          requested: input.amount.abs().toFixed(2),
        });
      }
    }

    const entry = await tx.ledgerEntry.create({
      data: {
        accountId: acc.id,
        type: input.type,
        amount: toDb(input.amount),
        balanceAfter: toDb(balanceAfter),
        creditAfter: toDb(creditAfter),
        reason: input.reason,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        actorId: input.actorId ?? null,
      },
      select: { id: true },
    });

    const account = await tx.tradingAccount.update({
      where: { id: acc.id },
      data: { balance: toDb(balanceAfter), credit: toDb(creditAfter) },
    });

    return { entryId: entry.id, balanceAfter, creditAfter, account };
  }

  /** Post in its own transaction. */
  post(input: PostEntryInput): Promise<PostEntryResult> {
    return this.prisma.$transaction((tx) => this.postInTx(tx, input), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 10_000,
    });
  }

  async list(accountId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ledgerEntry.findMany({
        where: { accountId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ledgerEntry.count({ where: { accountId } }),
    ]);
    return { items, total, page, limit };
  }
}
