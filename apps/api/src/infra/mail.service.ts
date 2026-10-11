import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../config/env';

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

  welcome(to: string, firstName: string, loginCode: number) {
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

  ticketReply(to: string, subject: string, body: string) {
    const text = `A support agent replied to your ticket "${subject}":\n\n${body}\n\nReply from the Help section of your client area.`;
    return this.send({ to, subject: `${env.BRAND_NAME} - reply to your ticket`, text, html: `<p>${esc(text).replace(/\n/g, '<br>')}</p>` });
  }

  /** Back-office alert; silently skipped when ADMIN_NOTIFY_EMAIL is empty. */
  kycReminder(to: string, firstName: string, days: number, deadline: Date) {
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

  kycFrozen(to: string, firstName: string) {
    const brand = env.BRAND_NAME;
    const link = `${env.WEB_ORIGIN.split(',')[0]}/app/documents`;
    return this.send({
      to,
      subject: `${brand}: trading paused until your documents arrive`,
      text: `Hi ${firstName},\n\nThe 15-day window to upload your documents has passed, so trading on your ${brand} account is paused. Upload the missing documents and trading resumes automatically: ${link}`,
      html: `<p>Hi ${esc(firstName)},</p><p>The 15-day window to upload your documents has passed, so trading on your ${esc(brand)} account is paused. Upload the missing documents and trading resumes automatically.</p><p><a href="${link}">Upload documents</a></p>`,
    });
  }

  kycUnfrozen(to: string, firstName: string) {
    const brand = env.BRAND_NAME;
    return this.send({ to, subject: `${brand}: trading resumed`, text: `Hi ${firstName},\n\nTrading on your ${brand} account is open again.`, html: `<p>Hi ${esc(firstName)},</p><p>Trading on your ${esc(brand)} account is open again.</p>` });
  }

  adminAlert(subject: string, body: string) {
    if (!env.ADMIN_NOTIFY_EMAIL) return Promise.resolve();
    return this.send({ to: env.ADMIN_NOTIFY_EMAIL, subject: `[${env.BRAND_NAME} back office] ${subject}`, text: body, html: `<p>${esc(body)}</p>` });
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
