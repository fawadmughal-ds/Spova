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
      text: `Hi ${firstName},\n\nYour ${brand} account is ready. A demo trading account (login ${loginCode}) has been created for you.\n\nLogin: ${env.WEB_ORIGIN}/login\n\nTrading CFDs involves significant risk of loss.`,
      html: `<p>Hi ${esc(firstName)},</p><p>Your ${esc(brand)} account is ready. A demo trading account (login <b>${loginCode}</b>) has been created for you.</p><p><a href="${env.WEB_ORIGIN}/login">Log in</a></p><p style="color:#888;font-size:12px">Trading CFDs involves significant risk of loss.</p>`,
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
  adminAlert(subject: string, body: string) {
    if (!env.ADMIN_NOTIFY_EMAIL) return Promise.resolve();
    return this.send({ to: env.ADMIN_NOTIFY_EMAIL, subject: `[${env.BRAND_NAME} back office] ${subject}`, text: body, html: `<p>${esc(body)}</p>` });
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
