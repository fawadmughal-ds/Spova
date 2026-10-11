import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { StatementQuery } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { env } from '../../config/env';
import { money } from '../../common/money';
import { ApiError } from '../../common/errors';

interface Built {
  filename: string;
  mime: string;
  body: Buffer;
}

const fmtTs = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Account statement for a date range: balances, every ledger entry and every trade closed in the period, as PDF or CSV. */
@Injectable()
export class StatementService {
  constructor(private readonly prisma: PrismaService) {}

  async build(accountId: string, q: StatementQuery): Promise<Built> {
    const from = new Date(`${q.from}T00:00:00.000Z`);
    const to = new Date(`${q.to}T23:59:59.999Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw ApiError.badRequest('dates_invalid', 'Invalid dates');
    if (to.getTime() - from.getTime() > 400 * 86_400_000) throw ApiError.badRequest('range_too_long', 'A statement covers at most 400 days');

    const acc = await this.prisma.tradingAccount.findUniqueOrThrow({ where: { id: accountId }, include: { user: { include: { profile: true } } } });
    const [before, entries, trades] = await Promise.all([
      this.prisma.ledgerEntry.findFirst({ where: { accountId, createdAt: { lt: from } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.ledgerEntry.findMany({ where: { accountId, createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.position.findMany({ where: { accountId, status: 'closed', closeAt: { gte: from, lte: to } }, orderBy: { closeAt: 'asc' } }),
    ]);
    const opening = before ? money(before.balanceAfter) : '0.00';
    const closing = entries.length ? money(entries[entries.length - 1]!.balanceAfter) : opening;
    const sum = (type: string) => money(entries.filter((e) => e.type === type).reduce((a, e) => a + Number(e.amount), 0));
    const totals = {
      deposits: sum('deposit'),
      withdrawals: sum('withdraw'),
      credit: money(entries.filter((e) => e.type === 'credit').reduce((a, e) => a + Number(e.amount), 0)),
      tradingPnl: money(trades.reduce((a, t) => a + Number(t.realizedPnl ?? 0), 0)),
      swaps: money(trades.reduce((a, t) => a + Number(t.swapAccrued), 0)),
      commissions: money(trades.reduce((a, t) => a + Number(t.commission), 0)),
    };
    const name = `${acc.user.profile?.firstName ?? ''} ${acc.user.profile?.lastName ?? ''}`.trim() || acc.user.email;
    const base = `statement-${acc.loginCode}-${q.from}-to-${q.to}`;

    if (q.format === 'csv') {
      const lines: string[] = [];
      lines.push(['Account statement', env.BRAND_NAME].map(csvCell).join(','));
      lines.push(['Client', name, 'Email', acc.user.email].map(csvCell).join(','));
      lines.push(['Account', acc.loginCode, 'Type', acc.type, 'Currency', acc.currency].map(csvCell).join(','));
      lines.push(['Period', q.from, q.to].map(csvCell).join(','));
      lines.push('');
      lines.push(['Opening balance', opening, 'Closing balance', closing].map(csvCell).join(','));
      lines.push(['Deposits', totals.deposits, 'Withdrawals', totals.withdrawals, 'Credit', totals.credit].map(csvCell).join(','));
      lines.push(['Trading P/L', totals.tradingPnl, 'Swaps', totals.swaps, 'Commissions', totals.commissions].map(csvCell).join(','));
      lines.push('');
      lines.push('Closed trades');
      lines.push(['Closed at', 'Symbol', 'Side', 'Lots', 'Open price', 'Close price', 'Opened at', 'Swap', 'Commission', 'Profit', 'Reason'].join(','));
      for (const t of trades) lines.push([fmtTs(t.closeAt!), t.symbolId, t.side, money(t.lots), t.openPrice.toString(), t.closePrice?.toString() ?? '', fmtTs(t.openAt), money(t.swapAccrued), money(t.commission), money(t.realizedPnl ?? 0), t.closeReason ?? ''].map(csvCell).join(','));
      lines.push('');
      lines.push('Ledger');
      lines.push(['Time', 'Type', 'Amount', 'Balance after', 'Credit after', 'Reason'].join(','));
      for (const e of entries) lines.push([fmtTs(e.createdAt), e.type, money(e.amount), money(e.balanceAfter), money(e.creditAfter), e.reason].map(csvCell).join(','));
      return { filename: `${base}.csv`, mime: 'text/csv; charset=utf-8', body: Buffer.from(lines.join('\n'), 'utf8') };
    }

    const body = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Statement ${acc.loginCode}`, Author: env.BRAND_NAME } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      const W = doc.page.width - 80;
      const line = () => doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).strokeColor('#e2e7f0').lineWidth(1).stroke();
      const ensure = (h: number) => {
        if (doc.y + h > doc.page.height - 60) doc.addPage();
      };
      // header
      doc.roundedRect(40, 40, 26, 26, 7).fill('#2563eb');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text('Z', 48, 46);
      doc.fillColor('#0b1220').font('Helvetica-Bold').fontSize(18).text(env.BRAND_NAME, 74, 44);
      doc.font('Helvetica').fontSize(9).fillColor('#55617a').text('Account statement', 74, 64);
      doc.fontSize(9).fillColor('#55617a').text(`Generated ${fmtTs(new Date())}`, 40, 46, { width: W, align: 'right' });
      doc.moveDown(2);
      doc.y = 90;
      line();
      doc.moveDown(0.6);
      doc.fillColor('#0b1220').font('Helvetica-Bold').fontSize(11).text(name);
      doc.font('Helvetica').fontSize(9).fillColor('#3f4a62').text(acc.user.email);
      doc.text(`Account ${acc.loginCode} · ${acc.type.toUpperCase()} · ${acc.currency} · leverage 1:${acc.leverage}`);
      doc.text(`Period ${q.from} to ${q.to} (UTC)`);
      doc.moveDown(0.8);
      // summary grid
      const cells: [string, string][] = [
        ['Opening balance', opening],
        ['Deposits', totals.deposits],
        ['Withdrawals', totals.withdrawals],
        ['Credit', totals.credit],
        ['Trading P/L', totals.tradingPnl],
        ['Swaps', totals.swaps],
        ['Commissions', totals.commissions],
        ['Closing balance', closing],
      ];
      const cw = W / 4;
      const top = doc.y;
      cells.forEach(([k, v], i) => {
        const x = 40 + (i % 4) * cw;
        const y = top + Math.floor(i / 4) * 40;
        doc.roundedRect(x + 2, y, cw - 4, 36, 6).fill('#f5f7fb');
        doc.fillColor('#6b778f').font('Helvetica').fontSize(7.5).text(k.toUpperCase(), x + 10, y + 7);
        doc.fillColor(k === 'Closing balance' || k === 'Opening balance' ? '#0b1220' : Number(v) < 0 ? '#b91c1c' : Number(v) > 0 ? '#15803d' : '#0b1220').font('Helvetica-Bold').fontSize(11).text(`${v} ${acc.currency}`, x + 10, y + 18);
      });
      doc.y = top + 88;
      doc.x = 40;
      // tables
      const table = (title: string, cols: { h: string; w: number; align?: 'left' | 'right' }[], rows: string[][]) => {
        ensure(60);
        doc.fillColor('#0b1220').font('Helvetica-Bold').fontSize(11).text(title, 40, doc.y);
        doc.moveDown(0.4);
        const header = () => {
          let x = 40;
          const y = doc.y;
          doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#6b778f');
          for (const c of cols) {
            doc.text(c.h.toUpperCase(), x, y, { width: c.w, align: c.align ?? 'left' });
            x += c.w;
          }
          doc.y = y + 12;
          line();
          doc.moveDown(0.3);
        };
        header();
        if (rows.length === 0) {
          doc.font('Helvetica').fontSize(9).fillColor('#6b778f').text('Nothing in this period.', 40, doc.y);
          doc.moveDown(1.2);
          return;
        }
        for (const r of rows) {
          if (doc.y + 16 > doc.page.height - 60) {
            doc.addPage();
            header();
          }
          let x = 40;
          const y = doc.y;
          doc.font('Helvetica').fontSize(8.5).fillColor('#141b2c');
          r.forEach((cell, i) => {
            const c = cols[i]!;
            const neg = c.align === 'right' && /^-\d/.test(cell);
            doc.fillColor(neg ? '#b91c1c' : '#141b2c').text(cell, x, y, { width: c.w - 6, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
            x += c.w;
          });
          doc.y = y + 14;
        }
        doc.moveDown(1);
      };
      table(
        `Closed trades (${trades.length})`,
        [
          { h: 'Closed at', w: 92 },
          { h: 'Symbol', w: 58 },
          { h: 'Side', w: 32 },
          { h: 'Lots', w: 36, align: 'right' },
          { h: 'Open', w: 62, align: 'right' },
          { h: 'Close', w: 62, align: 'right' },
          { h: 'Swap', w: 48, align: 'right' },
          { h: 'Comm.', w: 48, align: 'right' },
          { h: 'Profit', w: 60, align: 'right' },
          { h: 'Reason', w: 50 },
        ],
        trades.map((t) => [fmtTs(t.closeAt!).replace(' UTC', ''), t.symbolId, t.side.toUpperCase(), money(t.lots), t.openPrice.toString(), t.closePrice?.toString() ?? '', money(t.swapAccrued), money(t.commission), money(t.realizedPnl ?? 0), t.closeReason ?? '']),
      );
      table(
        `Ledger (${entries.length})`,
        [
          { h: 'Time', w: 92 },
          { h: 'Type', w: 60 },
          { h: 'Amount', w: 70, align: 'right' },
          { h: 'Balance after', w: 80, align: 'right' },
          { h: 'Reason', w: 210 },
        ],
        entries.map((e) => [fmtTs(e.createdAt).replace(' UTC', ''), e.type, money(e.amount), money(e.balanceAfter), e.reason]),
      );
      ensure(40);
      doc.font('Helvetica').fontSize(7.5).fillColor('#6b778f').text(`${env.BRAND_NAME} · This statement is generated from the account ledger. CFDs carry a high risk of loss. Times are UTC.`, 40, doc.page.height - 50, { width: W, align: 'center' });
      doc.end();
    });
    return { filename: `${base}.pdf`, mime: 'application/pdf', body };
  }
}
