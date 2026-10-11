import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { DEFAULT_EMAIL_SETTINGS, EMAIL_SETTINGS_KEY, type EmailSettings, type EmailType } from '@spova/shared';
import { env } from '../config/env';
import { SettingsService } from './settings.service';

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * MAIL_PROVIDER=console prints the mail (and any links) to the API log - fine for dev/demo.
 * MAIL_PROVIDER=resend sends through Resend. Domain SPF/DKIM must be set before 9 Oct demo.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private readonly resend = env.MAIL_PROVIDER === 'resend' && env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

  constructor(private readonly settings: SettingsService) {}

  /** A notification type the admin can switch off from the dashboard. Transactional mail (password reset, payment result) is not gated. */
  private async enabled(type: EmailType): Promise<boolean> {
    const cfg = await this.settings.getCached<EmailSettings>(EMAIL_SETTINGS_KEY, DEFAULT_EMAIL_SETTINGS, 10000);
    return cfg[type] !== false;
  }

  async send(mail: Mail): Promise<void> {
    if (!this.resend) {
      this.log.log(`\n--- MAIL (console) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n----------------------`);
      return;
    }
    const { error } = await this.resend.emails.send({
      from: `${env.BRAND_NAME} <${env.MAIL_FROM}>`,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (error) this.log.error(`resend failed: ${error.message}`);
  }

  async welcome(to: string, firstName: string, loginCode: number) {
    if (!(await this.enabled('welcome'))) return;
    const brand = env.BRAND_NAME;
    return this.send({
      to,
      subject: `Welcome to ${brand}`,
      text: `Hi ${firstName},\n\nYour ${brand} account is ready. Your live trading account (login ${loginCode}) is open. Upload your documents within 15 days to keep it active.\n\nLogin: ${env.WEB_ORIGIN}/login\n\nTrading CFDs involves significant risk of loss.`,
      html: `<p>Hi ${esc(firstName)},</p><p>Your ${esc(brand)} account is ready. Your live trading account (login <b>${loginCode}</b>) is open. Upload your documents within 15 days to keep it active.</p><p><a href="${env.WEB_ORIGIN}/login">Log in</a></p><p style="color:#888;font-size:12px">Trading CFDs involves significant risk of loss.</p>`,
    });
  }

  passwordReset(to: string, token: string) {
    const url = `${env.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: `${env.BRAND_NAME} - reset your password`,
      text: `Reset your password (valid 1 hour):\n${url}\n\nIf you did not request this, ignore this email.`,
      html: `<p>Reset your password (valid 1 hour):</p><p><a href="${url}">${url}</a></p><p>If you did not request this, ignore this email.</p>`,
    });
  }

  ledgerNotice(to: string, title: string, body: string) {
    return this.send({
      to,
      subject: `${env.BRAND_NAME} - ${title}`,
      text: body,
      html: `<p>${esc(body)}</p>`,
    });
  }

  kycResult(to: string, group: string, status: 'approved' | 'rejected', reason?: string) {
    const label = { poi: 'Proof of identity', por: 'Proof of residence', payment: 'Payment method proof', other: 'Document' }[group] ?? 'Document';
    const body = status === 'approved' ? `${label}: approved. Thank you for verifying your account.` : `${label}: rejected. Reason: ${reason ?? 'not given'}. Please upload a new document from the client area.`;
    return this.send({ to, subject: `${env.BRAND_NAME} - verification ${status}`, text: body, html: `<p>${esc(body)}</p>` });
  }

  paymentResult(to: string, kind: 'deposit' | 'withdraw', amount: string, status: 'approved' | 'declined', note?: string) {
    const body =
      status === 'approved'
        ? `Your ${kind} request for ${amount} USD has been approved and posted to your account.`
        : `Your ${kind} request for ${amount} USD was declined. ${note ? `Note: ${note}` : ''}`.trim();
    return this.send({ to, subject: `${env.BRAND_NAME} - ${kind} ${status}`, text: body, html: `<p>${esc(body)}</p>` });
  }

  /** Bank / RTGS deposit: finance confirmation with the pay-to details. */
  depositInstructions(to: string, methodLabel: string, amount: string, currency: string, loginCode: number, ch: { title: string; fields: { label: string; value: string }[]; note?: string }) {
    const brand = env.BRAND_NAME;
    const lines = ch.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
    const body = `We have received your ${methodLabel} deposit request for ${amount} ${currency} on account ${loginCode}. Our finance team is reviewing it.\n\nPay to these details and your balance is credited once the transfer is confirmed:\n\n${ch.title}\n${lines}${ch.note ? `\n\n${ch.note}` : ''}\n\nAfter paying, you can attach the receipt from the Payments history in your client area.`;
    const htmlRows = ch.fields.map((f) => `<tr><td style="padding:2px 12px 2px 0;color:#667">${esc(f.label)}</td><td style="padding:2px 0"><b>${esc(f.value)}</b></td></tr>`).join('');
    return this.send({
      to,
      subject: `${brand} - your ${methodLabel} deposit details`,
      text: body,
      html: `<p>We have received your ${esc(methodLabel)} deposit request for <b>${esc(amount)} ${esc(currency)}</b> on account ${loginCode}. Our finance team is reviewing it.</p><p>Pay to these details and your balance is credited once the transfer is confirmed:</p><p><b>${esc(ch.title)}</b></p><table>${htmlRows}</table>${ch.note ? `<p>${esc(ch.note)}</p>` : ''}<p>After paying, attach the receipt from the Payments history in your client area.</p>`,
    });
  }

  /** Sent when a client submits a withdrawal; carries the profit-and-loss responsibility disclaimer. */
  withdrawReceived(to: string, amount: string, currency: string, loginCode: number) {
    const brand = env.BRAND_NAME;
    const disclaimer = `${brand} is not responsible for any profit or loss arising from your trading decisions. Trading CFDs carries a high risk of losing money and may not be suitable for everyone. You trade entirely at your own risk.`;
    const body = `We have received your withdrawal request for ${amount} ${currency} from account ${loginCode}. It is now pending review and you will be notified once it is processed.

${disclaimer}`;
    return this.send({ to, subject: `${brand} - withdrawal request received`, text: body, html: `<p>${esc(body).replace(/\n/g, '<br>')}</p>` });
  }

  ticketReply(to: string, subject: string, body: string) {
    const text = `A support agent replied to your ticket "${subject}":\n\n${body}\n\nReply from the Help section of your client area.`;
    return this.send({ to, subject: `${env.BRAND_NAME} - reply to your ticket`, text, html: `<p>${esc(text).replace(/\n/g, '<br>')}</p>` });
  }

  /** Back-office alert; silently skipped when ADMIN_NOTIFY_EMAIL is empty. */
  async kycReminder(to: string, firstName: string, days: number, deadline: Date) {
    if (!(await this.enabled('kycReminder'))) return;
    const brand = env.BRAND_NAME;
    const when = deadline.toISOString().slice(0, 10);
    const link = `${env.WEB_ORIGIN.split(',')[0]}/app/documents`;
    return this.send({
      to,
      subject: `${days} day${days === 1 ? '' : 's'} left to upload your documents`,
      text: `Hi ${firstName},\n\nYour ${brand} account needs proof of identity, proof of residence, a payment document and any other requested document by ${when}. After that date trading is paused until they arrive.\n\nUpload them here: ${link}`,
      html: `<p>Hi ${esc(firstName)},</p><p>Your ${esc(brand)} account needs <b>proof of identity, proof of residence, a payment document</b> and any other requested document by <b>${when}</b>. After that date trading is paused until they arrive.</p><p><a href="${link}">Upload documents</a></p>`,
    });
  }

  async kycFrozen(to: string, firstName: string) {
    if (!(await this.enabled('kycFrozen'))) return;
    const brand = env.BRAND_NAME;
    const link = `${env.WEB_ORIGIN.split(',')[0]}/app/documents`;
    return this.send({
      to,
      subject: `${brand}: trading paused until your documents arrive`,
      text: `Hi ${firstName},\n\nThe 15-day window to upload your documents has passed, so trading on your ${brand} account is paused. Upload the missing documents and trading resumes automatically: ${link}`,
      html: `<p>Hi ${esc(firstName)},</p><p>The 15-day window to upload your documents has passed, so trading on your ${esc(brand)} account is paused. Upload the missing documents and trading resumes automatically.</p><p><a href="${link}">Upload documents</a></p>`,
    });
  }

  async kycUnfrozen(to: string, firstName: string) {
    if (!(await this.enabled('kycUnfrozen'))) return;
    const brand = env.BRAND_NAME;
    return this.send({ to, subject: `${brand}: trading resumed`, text: `Hi ${firstName},\n\nTrading on your ${brand} account is open again.`, html: `<p>Hi ${esc(firstName)},</p><p>Trading on your ${esc(brand)} account is open again.</p>` });
  }

  /** New sign-in notice. */
  async login(to: string, firstName: string, when: Date, ip?: string) {
    if (!(await this.enabled('login'))) return;
    const brand = env.BRAND_NAME;
    const ts = when.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const body = `Hi ${firstName},\n\nWe noticed a sign-in to your ${brand} account on ${ts}${ip ? ` from ${ip}` : ''}. If this was you, no action is needed. If not, reset your password immediately and contact support.`;
    return this.send({ to, subject: `${brand}: new sign-in to your account`, text: body, html: `<p>Hi ${esc(firstName)},</p><p>We noticed a sign-in to your ${esc(brand)} account on <b>${ts}</b>${ip ? ` from <b>${esc(ip)}</b>` : ''}.</p><p>If this was you, no action is needed. If not, reset your password immediately and contact support.</p>` });
  }

  /** Credit / bonus / funds added to an account by the back office. */
  async creditAdded(to: string, firstName: string, amount: string, currency: string, loginCode: number, typeLabel: string) {
    if (!(await this.enabled('creditAdded'))) return;
    const brand = env.BRAND_NAME;
    const body = `Hi ${firstName},\n\n${amount} ${currency} ${typeLabel} has been added to your ${brand} account ${loginCode}. You can see it in your client area.`;
    return this.send({ to, subject: `${brand}: ${amount} ${currency} ${typeLabel} added`, text: body, html: `<p>Hi ${esc(firstName)},</p><p><b>${esc(amount)} ${esc(currency)}</b> ${esc(typeLabel)} has been added to your ${esc(brand)} account <b>${loginCode}</b>. You can see it in your client area.</p>` });
  }

  /** Admin-triggered prompt inviting the client to fund their account, with a deposit button. */
  async depositInvite(to: string, firstName: string) {
    if (!(await this.enabled('depositInvite'))) return;
    const brand = env.BRAND_NAME;
    const link = `${env.WEB_ORIGIN.split(',')[0]}/app/payments`;
    const body = `Hi ${firstName},\n\nYou can fund your ${brand} account to start trading. Make a deposit here: ${link}`;
    return this.send({
      to,
      subject: `${brand}: fund your account`,
      text: body,
      html: `<p>Hi ${esc(firstName)},</p><p>You can fund your ${esc(brand)} account to start trading.</p><p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#2e9e5b;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Make a deposit</a></p><p style="color:#888;font-size:12px">Or open: ${link}</p>`,
    });
  }

  adminAlert(subject: string, body: string) {
    if (!env.ADMIN_NOTIFY_EMAIL) return Promise.resolve();
    return this.send({ to: env.ADMIN_NOTIFY_EMAIL, subject: `[${env.BRAND_NAME} back office] ${subject}`, text: body, html: `<p>${esc(body)}</p>` });
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
