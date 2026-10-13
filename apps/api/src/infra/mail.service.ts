import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import { DEFAULT_EMAIL_SETTINGS, EMAIL_SETTINGS_KEY, EMAIL_TEMPLATES_KEY, type EmailSettings, type EmailTemplates, type EmailType, type EmailTemplateOverride } from '@spova/shared';
import { env } from '../config/env';
import { SettingsService } from './settings.service';

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Brand palette (hard-coded; email clients drop CSS variables).
const C = {
  blue: '#2563eb',
  dark: '#1e3a8a',
  ink: '#0f172a',
  muted: '#64748b',
  bg: '#eef2f7',
  border: '#e2e8f0',
  soft: '#f1f5f9',
  green: '#16a34a',
  red: '#dc2626',
};
/** Primary site origin (WEB_ORIGIN may be a comma list). */
const WEB = (env.WEB_ORIGIN || '').split(',')[0] || 'https://www.zerventa.com';
const LOGO = `${WEB}/brand/zerventa-mark.png`;

/**
 * MAIL_PROVIDER=console prints the mail to the API log (dev/demo).
 * MAIL_PROVIDER=smtp sends through nodemailer (Hostinger). MAIL_PROVIDER=resend via Resend.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');
  private readonly resend = env.MAIL_PROVIDER === 'resend' && env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  private readonly smtp: Transporter | null =
    env.MAIL_PROVIDER === 'smtp' && env.SMTP_HOST
      ? nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined })
      : null;

  constructor(private readonly settings: SettingsService) {}

  private async enabled(type: EmailType): Promise<boolean> {
    const cfg = await this.settings.getCached<EmailSettings>(EMAIL_SETTINGS_KEY, DEFAULT_EMAIL_SETTINGS, 10000);
    return cfg[type] !== false;
  }

  /** Admin content override for a type (subject + opening line); the branded layout stays fixed. */
  private async ovr(type: EmailType): Promise<EmailTemplateOverride> {
    const t = await this.settings.getCached<EmailTemplates>(EMAIL_TEMPLATES_KEY, {}, 10000);
    return (t[type] ?? {}) as EmailTemplateOverride;
  }

  async send(mail: Mail): Promise<void> {
    const from = `${env.BRAND_NAME} <${env.MAIL_FROM}>`;
    if (this.smtp) {
      try {
        await this.smtp.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
      } catch (e) {
        this.log.error(`smtp send failed: ${(e as Error).message}`);
      }
      return;
    }
    if (this.resend) {
      const { error } = await this.resend.emails.send({ from, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
      if (error) this.log.error(`resend failed: ${error.message}`);
      return;
    }
    this.log.log(`\n--- MAIL (console) ---\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n----------------------`);
  }

  // ---------------------------------------------------------------------------
  // Branded HTML layout — table-based, inline styles, logo header + footer.
  // ---------------------------------------------------------------------------
  private wrap(opts: { preheader?: string; heading?: string; bodyHtml: string; cta?: { label: string; url: string; color?: string } }): string {
    const brand = env.BRAND_NAME;
    const year = new Date().getUTCFullYear();
    const cta = opts.cta
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="border-radius:10px;background:${opts.cta.color ?? C.blue}">
<a href="${opts.cta.url}" style="display:inline-block;padding:13px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px">${esc(opts.cta.label)}</a>
</td></tr></table>`
      : '';
    const heading = opts.heading ? `<h1 style="margin:0 0 16px;font:700 21px/1.3 Arial,Helvetica,sans-serif;color:${C.ink}">${esc(opts.heading)}</h1>` : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader ?? opts.heading ?? brand)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:28px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:4px 6px 18px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle"><img src="${LOGO}" width="40" height="40" alt="${esc(brand)}" style="display:block;border:0;border-radius:11px"></td>
<td style="vertical-align:middle;padding-left:11px;font:700 21px/1 Arial,Helvetica,sans-serif;color:${C.dark};letter-spacing:-0.3px">${esc(brand)}</td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${C.border};border-radius:16px;padding:34px 34px 30px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:${C.ink};box-shadow:0 1px 2px rgba(15,23,42,0.04)">
<div style="height:4px;width:46px;background:${C.blue};border-radius:4px;margin:0 0 22px"></div>
${heading}${opts.bodyHtml}${cta}
</td></tr>
<tr><td style="padding:22px 10px 8px;font:400 12px/1.65 Arial,Helvetica,sans-serif;color:${C.muted}">
<p style="margin:0 0 9px">Need help? Email <a href="mailto:${esc(env.MAIL_FROM)}" style="color:${C.blue};text-decoration:none">${esc(env.MAIL_FROM)}</a></p>
<p style="margin:0 0 9px">Trading CFDs carries a high risk of losing money rapidly due to leverage. ${esc(brand)} is not responsible for any profit or loss arising from your trading decisions. You trade entirely at your own risk.</p>
<p style="margin:0;color:#94a3b8">&copy; ${year} ${esc(brand)}. All rights reserved.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  }

  /** A styled key/value table for details (bank fields, etc.). */
  private kvTable(rows: { label: string; value: string }[]): string {
    const body = rows
      .map(
        (r) =>
          `<tr><td style="padding:9px 14px;border-bottom:1px solid ${C.border};color:${C.muted};font-size:13px;white-space:nowrap">${esc(r.label)}</td><td style="padding:9px 14px;border-bottom:1px solid ${C.border};color:${C.ink};font-weight:700;text-align:right">${esc(r.value)}</td></tr>`,
      )
      .join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0;border:1px solid ${C.border};border-radius:12px;background:${C.soft};overflow:hidden">${body}</table>`;
  }

  private p(html: string): string {
    return `<p style="margin:0 0 14px">${html}</p>`;
  }

  // ---------------------------------------------------------------------------

  async welcome(to: string, firstName: string, loginCode: number) {
    if (!(await this.enabled('welcome'))) return;
    const o = await this.ovr('welcome');
    const brand = env.BRAND_NAME;
    const login = `${WEB}/login`;
    return this.send({
      to,
      subject: o.subject || `Welcome to ${brand}`,
      text: `Hi ${firstName},\n\nYour ${brand} demo account (login ${loginCode}) is ready with $10,000 to practice. When you are ready, open a live account from your client area; you then have 15 days to upload your documents.\n\nLog in: ${login}\n\nTrading CFDs involves significant risk of loss.`,
      html: this.wrap({
        preheader: `Your ${brand} account is ready — login ${loginCode}.`,
        heading: `Welcome to ${brand}, ${firstName}`,
        bodyHtml:
          (o.intro ? this.p(esc(o.intro)) : '') +
          this.p('Your demo account is ready with <b>$10,000</b> to practice, no deposit needed.') +
          this.kvTable([{ label: 'Demo account login', value: String(loginCode) }]) +
          this.p('When you are ready to trade for real, open a live account from your client area. You then have <b>15 days</b> to upload your documents.'),
        cta: { label: 'Log in to your account', url: login },
      }),
    });
  }

  passwordReset(to: string, token: string) {
    const url = `${WEB}/reset-password?token=${encodeURIComponent(token)}`;
    return this.send({
      to,
      subject: `${env.BRAND_NAME} - reset your password`,
      text: `Reset your password (valid 1 hour):\n${url}\n\nIf you did not request this, ignore this email.`,
      html: this.wrap({
        preheader: 'Reset your password (link valid for 1 hour).',
        heading: 'Reset your password',
        bodyHtml: this.p('We received a request to reset your password. This link is valid for <b>1 hour</b>.') + this.p(`<span style="color:${C.muted};font-size:13px">If you did not request this, you can safely ignore this email.</span>`),
        cta: { label: 'Reset password', url },
      }),
    });
  }

  ledgerNotice(to: string, title: string, body: string) {
    return this.send({
      to,
      subject: `${env.BRAND_NAME} - ${title}`,
      text: body,
      html: this.wrap({ heading: title, bodyHtml: this.p(esc(body)) }),
    });
  }

  kycResult(to: string, group: string, status: 'approved' | 'rejected', reason?: string) {
    const label = { poi: 'Proof of identity', por: 'Proof of residence', payment: 'Payment method proof', other: 'Document' }[group] ?? 'Document';
    const ok = status === 'approved';
    const body = ok ? `${label}: approved. Thank you for verifying your account.` : `${label}: rejected. Reason: ${reason ?? 'not given'}. Please upload a new document from the client area.`;
    return this.send({
      to,
      subject: `${env.BRAND_NAME} - verification ${status}`,
      text: body,
      html: this.wrap({
        heading: ok ? 'Verification approved' : 'Verification needs attention',
        bodyHtml: ok
          ? this.p(`<b>${esc(label)}</b> has been <b style="color:${C.green}">approved</b>. Thank you for verifying your account.`)
          : this.p(`<b>${esc(label)}</b> was <b style="color:${C.red}">rejected</b>.`) + this.p(`Reason: ${esc(reason ?? 'not given')}`) + this.p('Please upload a new document from your client area.'),
        cta: ok ? undefined : { label: 'Upload a new document', url: `${WEB}/client-area?panel=documents` },
      }),
    });
  }

  paymentResult(to: string, kind: 'deposit' | 'withdraw', amount: string, status: 'approved' | 'declined', note?: string) {
    const ok = status === 'approved';
    const body = ok ? `Your ${kind} request for ${amount} USD has been approved and posted to your account.` : `Your ${kind} request for ${amount} USD was declined. ${note ? `Note: ${note}` : ''}`.trim();
    return this.send({
      to,
      subject: `${env.BRAND_NAME} - ${kind} ${status}`,
      text: body,
      html: this.wrap({
        heading: `${kind === 'deposit' ? 'Deposit' : 'Withdrawal'} ${ok ? 'approved' : 'declined'}`,
        bodyHtml: ok
          ? this.p(`Your ${esc(kind)} request for <b>${esc(amount)} USD</b> has been <b style="color:${C.green}">approved</b> and posted to your account.`)
          : this.p(`Your ${esc(kind)} request for <b>${esc(amount)} USD</b> was <b style="color:${C.red}">declined</b>.`) + (note ? this.p(`Note: ${esc(note)}`) : ''),
        cta: { label: 'Open client area', url: `${WEB}/client-area?panel=payments` },
      }),
    });
  }

  depositInstructions(to: string, methodLabel: string, amount: string, currency: string, loginCode: number, ch: { title: string; fields: { label: string; value: string }[]; note?: string }) {
    const brand = env.BRAND_NAME;
    const lines = ch.fields.map((f) => `${f.label}: ${f.value}`).join('\n');
    const body = `We have received your ${methodLabel} deposit request for ${amount} ${currency} on account ${loginCode}. Our finance team is reviewing it.\n\nPay to these details and your balance is credited once the transfer is confirmed:\n\n${ch.title}\n${lines}${ch.note ? `\n\n${ch.note}` : ''}\n\nAfter paying, you can attach the receipt from the Payments history in your client area.`;
    return this.send({
      to,
      subject: `${brand} - your ${methodLabel} deposit details`,
      text: body,
      html: this.wrap({
        heading: `Your ${methodLabel} deposit details`,
        bodyHtml:
          this.p(`We have received your ${esc(methodLabel)} deposit request for <b>${esc(amount)} ${esc(currency)}</b> on account <b>${loginCode}</b>. Our finance team is reviewing it.`) +
          this.p(`Pay to the details below and your balance is credited once the transfer is confirmed:`) +
          this.p(`<b>${esc(ch.title)}</b>`) +
          this.kvTable(ch.fields) +
          (ch.note ? this.p(`<span style="color:${C.muted};font-size:13px">${esc(ch.note)}</span>`) : '') +
          this.p('After paying, attach the receipt from the Payments history in your client area.'),
        cta: { label: 'Go to Payments', url: `${WEB}/client-area?panel=payments` },
      }),
    });
  }

  withdrawReceived(to: string, amount: string, currency: string, loginCode: number) {
    const brand = env.BRAND_NAME;
    const disclaimer = `${brand} is not responsible for any profit or loss arising from your trading decisions. Trading CFDs carries a high risk of losing money and may not be suitable for everyone. You trade entirely at your own risk.`;
    const body = `We have received your withdrawal request for ${amount} ${currency} from account ${loginCode}. It is now pending review and you will be notified once it is processed.\n\n${disclaimer}`;
    return this.send({
      to,
      subject: `${brand} - withdrawal request received`,
      text: body,
      html: this.wrap({
        heading: 'Withdrawal request received',
        bodyHtml:
          this.p(`We have received your withdrawal request for <b>${esc(amount)} ${esc(currency)}</b> from account <b>${loginCode}</b>.`) +
          this.p('It is now pending review, and you will be notified once it is processed.'),
        cta: { label: 'View payment history', url: `${WEB}/client-area?panel=payments` },
      }),
    });
  }

  ticketReply(to: string, subject: string, body: string) {
    const text = `A support agent replied to your ticket "${subject}":\n\n${body}\n\nReply from the Help section of your client area.`;
    return this.send({
      to,
      subject: `${env.BRAND_NAME} - reply to your ticket`,
      text,
      html: this.wrap({
        heading: 'Reply to your support ticket',
        bodyHtml: this.p(`A support agent replied to your ticket <b>"${esc(subject)}"</b>:`) + `<div style="margin:0 0 14px;padding:14px 16px;background:${C.soft};border-left:3px solid ${C.blue};border-radius:8px;color:${C.ink}">${esc(body).replace(/\n/g, '<br>')}</div>`,
        cta: { label: 'Open Help centre', url: `${WEB}/client-area?panel=help` },
      }),
    });
  }

  async kycReminder(to: string, firstName: string, days: number, deadline: Date) {
    if (!(await this.enabled('kycReminder'))) return;
    const o = await this.ovr('kycReminder');
    const brand = env.BRAND_NAME;
    const when = deadline.toISOString().slice(0, 10);
    const link = `${WEB}/client-area?panel=documents`;
    return this.send({
      to,
      subject: o.subject || `${days} day${days === 1 ? '' : 's'} left to upload your documents`,
      text: `Hi ${firstName},\n\nYour ${brand} account needs proof of identity, proof of residence, a payment document and any other requested document by ${when}. After that date trading is paused until they arrive.\n\nUpload them here: ${link}`,
      html: this.wrap({
        preheader: `${days} day${days === 1 ? '' : 's'} left to verify your account.`,
        heading: `${days} day${days === 1 ? '' : 's'} left to verify`,
        bodyHtml: (o.intro ? this.p(esc(o.intro)) : '') + this.p(`Hi ${esc(firstName)}, your account needs <b>proof of identity, proof of residence, a payment document</b> and any other requested document by <b>${when}</b>.`) + this.p('After that date, trading is paused until they arrive.'),
        cta: { label: 'Upload documents', url: link },
      }),
    });
  }

  async kycFrozen(to: string, firstName: string) {
    if (!(await this.enabled('kycFrozen'))) return;
    const o = await this.ovr('kycFrozen');
    const brand = env.BRAND_NAME;
    const link = `${WEB}/client-area?panel=documents`;
    return this.send({
      to,
      subject: o.subject || `${brand}: trading paused until your documents arrive`,
      text: `Hi ${firstName},\n\nThe 15-day window to upload your documents has passed, so trading on your ${brand} account is paused. Upload the missing documents and trading resumes automatically: ${link}`,
      html: this.wrap({
        heading: 'Trading paused',
        bodyHtml: (o.intro ? this.p(esc(o.intro)) : '') + this.p(`Hi ${esc(firstName)}, the 15-day window to upload your documents has passed, so trading on your account is paused.`) + this.p('Upload the missing documents and trading resumes automatically.'),
        cta: { label: 'Upload documents', url: link },
      }),
    });
  }

  async kycUnfrozen(to: string, firstName: string) {
    if (!(await this.enabled('kycUnfrozen'))) return;
    const o = await this.ovr('kycUnfrozen');
    const brand = env.BRAND_NAME;
    return this.send({
      to,
      subject: o.subject || `${brand}: trading resumed`,
      text: `Hi ${firstName},\n\nTrading on your ${brand} account is open again.`,
      html: this.wrap({
        heading: 'Trading resumed',
        bodyHtml: (o.intro ? this.p(esc(o.intro)) : '') + this.p(`Hi ${esc(firstName)}, trading on your account is <b style="color:${C.green}">open again</b>. Thank you for verifying.`),
        cta: { label: 'Start trading', url: `${WEB}/client-area` },
      }),
    });
  }

  async login(to: string, firstName: string, when: Date, ip?: string) {
    if (!(await this.enabled('login'))) return;
    const o = await this.ovr('login');
    const brand = env.BRAND_NAME;
    const ts = when.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const body = `Hi ${firstName},\n\nWe noticed a sign-in to your ${brand} account on ${ts}${ip ? ` from ${ip}` : ''}. If this was you, no action is needed. If not, reset your password immediately and contact support.`;
    return this.send({
      to,
      subject: o.subject || `${brand}: new sign-in to your account`,
      text: body,
      html: this.wrap({
        preheader: `New sign-in on ${ts}.`,
        heading: 'New sign-in to your account',
        bodyHtml: (o.intro ? this.p(esc(o.intro)) : '') + this.p(`Hi ${esc(firstName)}, we noticed a sign-in to your account.`) + this.kvTable([{ label: 'Time', value: ts }, ...(ip ? [{ label: 'IP address', value: ip }] : [])]) + this.p(`<span style="color:${C.muted};font-size:13px">If this was you, no action is needed. If not, reset your password immediately and contact support.</span>`),
      }),
    });
  }

  async creditAdded(to: string, firstName: string, amount: string, currency: string, loginCode: number, typeLabel: string) {
    if (!(await this.enabled('creditAdded'))) return;
    const o = await this.ovr('creditAdded');
    const brand = env.BRAND_NAME;
    const body = `Hi ${firstName},\n\n${amount} ${currency} ${typeLabel} has been added to your ${brand} account ${loginCode}. You can see it in your client area.`;
    return this.send({
      to,
      subject: o.subject || `${brand}: ${amount} ${currency} ${typeLabel} added`,
      text: body,
      html: this.wrap({
        heading: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} added`,
        bodyHtml: (o.intro ? this.p(esc(o.intro)) : '') + this.p(`Hi ${esc(firstName)}, good news:`) + this.kvTable([{ label: typeLabel, value: `${amount} ${currency}` }, { label: 'Account', value: String(loginCode) }]) + this.p('You can see the updated balance in your client area.'),
        cta: { label: 'Open client area', url: `${WEB}/client-area`, color: C.green },
      }),
    });
  }

  /** Admin-triggered prompt inviting the client to fund their account. `url` lets the back office pass a one-click deposit link. */
  async depositInvite(to: string, firstName: string, url?: string) {
    if (!(await this.enabled('depositInvite'))) return;
    const o = await this.ovr('depositInvite');
    const brand = env.BRAND_NAME;
    const link = url ?? `${WEB}/client-area?panel=deposit`;
    const body = `Hi ${firstName},\n\nYou can fund your ${brand} account to start trading. Make a deposit here: ${link}`;
    return this.send({
      to,
      subject: o.subject || `${brand}: fund your account`,
      text: body,
      html: this.wrap({
        preheader: 'Fund your account to start trading.',
        heading: 'Fund your account',
        bodyHtml: (o.intro ? this.p(esc(o.intro)) : '') + this.p(`Hi ${esc(firstName)}, you can fund your ${esc(brand)} account to start trading.`) + (url ? this.p(`<span style="color:${C.muted};font-size:13px">This secure link opens your deposit page directly and is valid for 15 minutes.</span>`) : ''),
        cta: { label: 'Make a deposit', url: link, color: C.green },
      }),
    });
  }

  /** Render a branded sample of one notification email for the admin preview (applies the admin's overrides). */
  async renderPreview(type: EmailType): Promise<{ subject: string; html: string }> {
    const brand = env.BRAND_NAME;
    const o = await this.ovr(type);
    const intro = o.intro ? this.p(esc(o.intro)) : '';
    const name = 'Alex';
    switch (type) {
      case 'welcome':
        return {
          subject: o.subject || `Welcome to ${brand}`,
          html: this.wrap({ heading: `Welcome to ${brand}, ${name}`, bodyHtml: intro + this.p('Your account is ready to go. Your live trading account is open and waiting.') + this.kvTable([{ label: 'Account login', value: '500123' }]) + this.p('Upload your verification documents within <b>15 days</b> to keep the account active.'), cta: { label: 'Log in to your account', url: `${WEB}/login` } }),
        };
      case 'login':
        return {
          subject: o.subject || `${brand}: new sign-in to your account`,
          html: this.wrap({ heading: 'New sign-in to your account', bodyHtml: intro + this.p(`Hi ${name}, we noticed a sign-in to your account.`) + this.kvTable([{ label: 'Time', value: '2026-10-13 09:10 UTC' }, { label: 'IP address', value: '203.0.113.9' }]) + this.p(`<span style="color:${C.muted};font-size:13px">If this was you, no action is needed. If not, reset your password immediately.</span>`) }),
        };
      case 'kycReminder':
        return {
          subject: o.subject || `3 days left to upload your documents`,
          html: this.wrap({ heading: '3 days left to verify', bodyHtml: intro + this.p(`Hi ${name}, your account needs <b>proof of identity, proof of residence, a payment document</b> and any other requested document by <b>2026-10-16</b>.`) + this.p('After that date, trading is paused until they arrive.'), cta: { label: 'Upload documents', url: `${WEB}/client-area?panel=documents` } }),
        };
      case 'kycFrozen':
        return {
          subject: o.subject || `${brand}: trading paused until your documents arrive`,
          html: this.wrap({ heading: 'Trading paused', bodyHtml: intro + this.p(`Hi ${name}, the 15-day window to upload your documents has passed, so trading on your account is paused.`) + this.p('Upload the missing documents and trading resumes automatically.'), cta: { label: 'Upload documents', url: `${WEB}/client-area?panel=documents` } }),
        };
      case 'kycUnfrozen':
        return {
          subject: o.subject || `${brand}: trading resumed`,
          html: this.wrap({ heading: 'Trading resumed', bodyHtml: intro + this.p(`Hi ${name}, trading on your account is <b style="color:${C.green}">open again</b>. Thank you for verifying.`), cta: { label: 'Start trading', url: `${WEB}/client-area` } }),
        };
      case 'creditAdded':
        return {
          subject: o.subject || `${brand}: 500.00 USD credit added`,
          html: this.wrap({ heading: 'Credit added', bodyHtml: intro + this.p(`Hi ${name}, good news:`) + this.kvTable([{ label: 'credit', value: '500.00 USD' }, { label: 'Account', value: '500123' }]) + this.p('You can see the updated balance in your client area.'), cta: { label: 'Open client area', url: `${WEB}/client-area`, color: C.green } }),
        };
      case 'depositInvite':
        return {
          subject: o.subject || `${brand}: fund your account`,
          html: this.wrap({ heading: 'Fund your account', bodyHtml: intro + this.p(`Hi ${name}, you can fund your ${brand} account to start trading.`) + this.p(`<span style="color:${C.muted};font-size:13px">This secure link opens your deposit page directly and is valid for 15 minutes.</span>`), cta: { label: 'Make a deposit', url: `${WEB}/client-area?panel=deposit`, color: C.green } }),
        };
    }
  }

  adminAlert(subject: string, body: string) {
    if (!env.ADMIN_NOTIFY_EMAIL) return Promise.resolve();
    return this.send({
      to: env.ADMIN_NOTIFY_EMAIL,
      subject: `[${env.BRAND_NAME} back office] ${subject}`,
      text: body,
      html: this.wrap({ heading: subject, bodyHtml: this.p(esc(body).replace(/\n/g, '<br>')) }),
    });
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
