import nodemailer, { Transporter } from 'nodemailer';
import { getSetting, setSetting } from './db.js';
import { decryptSecret, encryptSecret } from './secrets.js';

export { encryptSecret };

/**
 * Outgoing e-mail. The SMTP server is configured from the app (Configuración → Servidor de correo) and saved in the
 * database; if nothing is saved there, the SMTP_* environment variables are used as a fallback.
 * SMTP_HOST=console (or "console" as host in the app) prints messages to the API log instead of sending them.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  /** AES-GCM encrypted password (never sent to the browser) */
  passEnc?: string;
}

const SETTING_KEY = 'smtp';

export const getStoredSmtp = () => getSetting<SmtpConfig | null>(SETTING_KEY, null);

export async function saveStoredSmtp(config: SmtpConfig | null) {
  await setSetting(SETTING_KEY, config); // null clears it (the env fallback applies again)
  invalidateTransporter();
}

interface ActiveConfig { host: string; port: number; secure: boolean; user: string; pass: string; from: string; source: 'app' | 'env' }

async function activeConfig(): Promise<ActiveConfig | null> {
  const stored = await getStoredSmtp();
  if (stored?.host) {
    return {
      host: stored.host, port: stored.port, secure: stored.secure, user: stored.user,
      pass: stored.passEnc ? decryptSecret(stored.passEnc) : '', from: stored.from, source: 'app',
    };
  }
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    host, port, secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    user: process.env.SMTP_USER ?? '', pass: process.env.SMTP_PASS ?? '', from: process.env.SMTP_FROM ?? '', source: 'env',
  };
}

export async function mailMode(): Promise<'smtp' | 'console' | 'off'> {
  const config = await activeConfig();
  if (!config) return 'off';
  return config.host === 'console' ? 'console' : 'smtp';
}

export async function mailSource(): Promise<'app' | 'env' | 'none'> {
  return (await activeConfig())?.source ?? 'none';
}

let cached: { transporter: Transporter; key: string } | null = null;
const invalidateTransporter = () => { cached = null; };

async function getTransporter(): Promise<{ transporter: Transporter; config: ActiveConfig }> {
  const config = await activeConfig();
  if (!config) throw new Error('El servidor de correo (SMTP) no está configurado.');
  const key = JSON.stringify(config);
  if (!cached || cached.key !== key) {
    cached = {
      key,
      transporter: config.host === 'console'
        ? nodemailer.createTransport({ jsonTransport: true })
        : nodemailer.createTransport({
            host: config.host, port: config.port, secure: config.secure,
            auth: config.user ? { user: config.user, pass: config.pass } : undefined,
            connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000,
          }),
    };
  }
  return { transporter: cached.transporter, config };
}

export interface MailAttachment { filename: string; content: string | Buffer; contentType?: string }

export async function sendMail(options: { to: string[]; subject: string; html: string; text?: string; attachments?: MailAttachment[] }) {
  const { transporter, config } = await getTransporter();
  const info = await transporter.sendMail({
    from: config.from || config.user || 'formularios@localhost',
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  });
  if (config.host === 'console') {
    const message = JSON.parse(String((info as { message?: string }).message ?? '{}'));
    console.log(`[correo simulado] Para: ${options.to.join(', ')} | Asunto: ${message.subject ?? options.subject} | Adjuntos: ${options.attachments?.map(a => a.filename).join(', ') || 'ninguno'}`);
  }
}

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
