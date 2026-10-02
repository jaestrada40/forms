import './env.js';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createMfaPendingToken, createToken, requireAuth, requireMfaPendingToken, requireRoles } from './auth.js';
import { audit, db, getSetting, initializeDatabase, setSetting } from './db.js';
import { encryptSecret, escapeHtml, getStoredSmtp, mailMode, mailSource, saveStoredSmtp, sendMail } from './mailer.js';
import { readSecret } from './secrets.js';
import { FailureLimiter, clearAuthCookie, createChallenge, rateLimit, sameOriginOnly, securityHeaders, setAuthCookie, uuidParam, verifyChallenge, verifyExternalCaptcha, evaluateRecaptchaV3, CaptchaProvider } from './security.js';
import { getSchedules, saveSchedules, sendScheduleNow, startBackgroundJobs, ReportSchedule } from './jobs.js';

authenticator.options = { window: 1 };

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const allowedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : (Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY));
app.use(securityHeaders);
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(sameOriginOnly(allowedOrigin));
// Public (unauthenticated) endpoints get a small body limit; the builder needs the larger one for embedded images.
app.use('/api/public', express.json({ limit: '1mb' }));
app.use(express.json({ limit: '15mb' }));
app.param('id', uuidParam);

// Failed logins per client IP. Successful logins do not reset it, or an attacker could clear it with their own account.
const loginFailuresByIp = new FailureLimiter(15 * 60_000, 30);
const loginFailuresByAccount = new FailureLimiter(15 * 60_000, 10);
const loginFailuresByAccountAndIp = new FailureLimiter(15 * 60_000, 5);
const mfaFailures = new FailureLimiter(5 * 60_000, 5);
const publicReadLimit = rateLimit({ windowMs: 60_000, max: 120 });
const publicSubmitLimit = rateLimit({ windowMs: 60_000, max: 20, key: req => `${req.ip}|${req.params.id}` });
// Compared against when the e-mail does not exist, so response time does not reveal which accounts exist
const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), 12);

/** Signs a session token and stores it in the HttpOnly cookie. The token is also returned for API clients. */
function startSession(res: express.Response, user: { id: string; name: string; email: string; role: string }) {
  const token = createToken({ id: user.id, name: user.name, email: user.email, role: user.role as never });
  setAuthCookie(res, token);
  return token;
}

/** Admins and Creators must use one of the institution's allowed e-mail domains (empty setting = no restriction). */
async function emailDomainError(email: string, role: string): Promise<string | null> {
  if (role !== 'Administrador' && role !== 'Creador') return null;
  const institution = await getSetting<{ allowedDomains?: string }>('institution', {});
  const domains = (institution.allowedDomains ?? '').split(/[,;\s]+/).map(d => d.trim().toLowerCase()).filter(Boolean)
    .map(d => (d.startsWith('@') ? d : `@${d}`));
  if (domains.length === 0) return null;
  return domains.some(d => email.toLowerCase().endsWith(d))
    ? null
    : `Los usuarios con rol ${role} deben usar un correo de: ${domains.join(', ')}.`;
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const formSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().max(2_000).default(''),
  department: z.string().trim().min(2).max(180),
  definition: z.object({ fields: z.array(z.unknown()).default([]), design: z.record(z.string(), z.unknown()).default({}), settings: z.record(z.string(), z.unknown()).default({}) }),
  status: z.enum(['draft', 'published', 'closed']).optional(),
});
const formUpdateSchema = z.object({
  title: z.string().trim().min(3).max(180).optional(),
  description: z.string().max(2_000).optional(),
  department: z.string().trim().min(2).max(180).optional(),
  definition: z.object({ fields: z.array(z.unknown()), design: z.record(z.string(), z.unknown()), settings: z.record(z.string(), z.unknown()) }).optional(),
  status: z.enum(['draft', 'published', 'closed']).optional(),
});

/** At most 30 notification e-mails per form per hour, so a public form cannot be used to flood an inbox. */
const notificationUsage = new Map<string, { count: number; windowStart: number }>();
function notificationBudgetLeft(formId: string): boolean {
  const now = Date.now();
  const usage = notificationUsage.get(formId);
  if (!usage || now - usage.windowStart > 3_600_000) { notificationUsage.set(formId, { count: 1, windowStart: now }); return true; }
  usage.count += 1;
  return usage.count <= 30;
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const accountKey = email.toLowerCase();
    const accountIpKey = `${accountKey}|${req.ip}`;
    const wait = Math.max(loginFailuresByIp.blockedFor(req.ip ?? 'unknown'), loginFailuresByAccount.blockedFor(accountKey), loginFailuresByAccountAndIp.blockedFor(accountIpKey));
    if (wait) return loginFailuresByAccount.respond(res, wait);

    const result = await db.query('SELECT id, name, email, password_hash, role, department, status, mfa_enabled FROM users WHERE lower(email) = lower($1)', [email]);
    const user = result.rows[0];
    const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || user.status !== 'Activo' || !passwordOk) {
      loginFailuresByIp.fail(req.ip ?? 'unknown');
      loginFailuresByAccount.fail(accountKey);
      loginFailuresByAccountAndIp.fail(accountIpKey);
      await audit(user?.id, 'LOGIN_FAILED', 'user', user?.id ?? 'desconocido', { email });
      return res.status(401).json({ message: 'Correo o contraseña inválidos.' });
    }
    loginFailuresByAccount.succeed(accountKey);
    loginFailuresByAccountAndIp.succeed(accountIpKey);

    if (user.mfa_enabled) {
      const mfaToken = createMfaPendingToken(user.id, 'verify');
      return res.json({ mfaRequired: true, mfaToken });
    }

    const mfaEnforced = await getSetting('mfa_enforced', false);
    if (mfaEnforced) {
      const mfaToken = createMfaPendingToken(user.id, 'setup');
      return res.json({ mfaSetupRequired: true, mfaToken });
    }

    const token = startSession(res, user);
    await audit(user.id, 'LOGIN', 'user', user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

app.post('/api/auth/mfa/setup', requireMfaPendingToken, async (req, res, next) => {
  try {
    if (req.mfaPending!.mode !== 'setup') return res.status(403).json({ message: 'Flujo de verificación inválido.' });
    const userResult = await db.query('SELECT id, email, name, mfa_enabled FROM users WHERE id = $1', [req.mfaPending!.id]);
    if (!userResult.rowCount) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const user = userResult.rows[0];
    if (user.mfa_enabled) return res.status(409).json({ message: 'La verificación en dos pasos ya está habilitada.' });
    const secretValue = authenticator.generateSecret();
    await db.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [encryptSecret(secretValue), user.id]);
    const otpauth = authenticator.keyuri(user.email, 'Formularios Institucionales', secretValue);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    res.json({ secret: secretValue, qrDataUrl });
  } catch (error) { next(error); }
});

app.post('/api/auth/mfa/activate', requireMfaPendingToken, async (req, res, next) => {
  try {
    if (req.mfaPending!.mode !== 'setup') return res.status(403).json({ message: 'Flujo de verificación inválido.' });
    const { code } = z.object({ code: z.string().trim().length(6) }).parse(req.body);
    const userResult = await db.query('SELECT id, name, email, role, department, mfa_secret, mfa_enabled FROM users WHERE id = $1', [req.mfaPending!.id]);
    const user = userResult.rows[0];
    if (!user || user.mfa_enabled) return res.status(409).json({ message: 'La verificación en dos pasos ya está habilitada.' });
    if (!user.mfa_secret) return res.status(400).json({ message: 'No hay una configuración de MFA pendiente. Inicie el proceso nuevamente.' });
    const wait = mfaFailures.blockedFor(user.id);
    if (wait) return mfaFailures.respond(res, wait);
    if (!authenticator.check(code, readSecret(user.mfa_secret))) {
      mfaFailures.fail(user.id);
      return res.status(401).json({ message: 'Código inválido.' });
    }
    mfaFailures.succeed(user.id);
    await db.query('UPDATE users SET mfa_enabled = true, mfa_enabled_at = NOW() WHERE id = $1', [user.id]);
    const token = startSession(res, user);
    await audit(user.id, 'MFA_ENABLE', 'user', user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (error) { next(error); }
});

app.post('/api/auth/mfa/verify', requireMfaPendingToken, async (req, res, next) => {
  try {
    if (req.mfaPending!.mode !== 'verify') return res.status(403).json({ message: 'Flujo de verificación inválido.' });
    const { code } = z.object({ code: z.string().trim().length(6) }).parse(req.body);
    const userResult = await db.query('SELECT id, name, email, role, department, mfa_secret, mfa_enabled FROM users WHERE id = $1', [req.mfaPending!.id]);
    const user = userResult.rows[0];
    if (!user?.mfa_enabled || !user.mfa_secret) return res.status(400).json({ message: 'La verificación en dos pasos no está habilitada para este usuario.' });
    const wait = mfaFailures.blockedFor(user.id);
    if (wait) return mfaFailures.respond(res, wait);
    if (!authenticator.check(code, readSecret(user.mfa_secret))) {
      mfaFailures.fail(user.id);
      return res.status(401).json({ message: 'Código inválido.' });
    }
    mfaFailures.succeed(user.id);
    const token = startSession(res, user);
    await audit(user.id, 'LOGIN_MFA', 'user', user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, async (req, res) => res.json({ user: req.user }));

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.string().email(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

app.patch('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const result = await db.query('SELECT id, name, email, password_hash, role, department FROM users WHERE id = $1', [req.user!.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    const emailChanged = data.email.toLowerCase() !== user.email.toLowerCase();
    const wantsPasswordChange = !!data.newPassword;

    if (emailChanged || wantsPasswordChange) {
      if (!data.currentPassword) {
        return res.status(400).json({ message: 'Ingrese su contraseña actual para cambiar el correo o la contraseña.' });
      }
      if (!(await bcrypt.compare(data.currentPassword, user.password_hash))) {
        return res.status(401).json({ message: 'La contraseña actual no es correcta.' });
      }
    }

    if (emailChanged) {
      const domainError = await emailDomainError(data.email, user.role);
      if (domainError) return res.status(400).json({ message: domainError });
      const existing = await db.query('SELECT id FROM users WHERE lower(email) = lower($1) AND id != $2', [data.email, user.id]);
      if (existing.rowCount) return res.status(409).json({ message: 'Ese correo ya está en uso por otro usuario.' });
    }

    const newPasswordHash = wantsPasswordChange ? await bcrypt.hash(data.newPassword!, 12) : null;

    const updated = await db.query(
      `UPDATE users SET name = $1, email = $2, password_hash = COALESCE($3, password_hash), updated_at = NOW(),
         token_valid_after = CASE WHEN $3::text IS NOT NULL THEN NOW() ELSE token_valid_after END
       WHERE id = $4 RETURNING id, name, email, role, department`,
      [data.name, data.email, newPasswordHash, user.id],
    );

    const updatedUser = updated.rows[0];
    const token = startSession(res, updatedUser);
    await audit(user.id, 'UPDATE', 'user', user.id, { self: true, emailChanged, passwordChanged: wantsPasswordChange });
    res.json({ token, user: updatedUser });
  } catch (error) { next(error); }
});

app.get('/api/settings/mfa', requireAuth, requireRoles('Administrador'), async (_req, res, next) => {
  try {
    const enforced = await getSetting('mfa_enforced', false);
    res.json({ enforced });
  } catch (error) { next(error); }
});

app.patch('/api/settings/mfa', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const { enforced } = z.object({ enforced: z.boolean() }).parse(req.body);
    await setSetting('mfa_enforced', enforced);
    await audit(req.user!.id, 'UPDATE', 'settings', 'mfa_enforced', { enforced });
    res.json({ enforced });
  } catch (error) { next(error); }
});

const defaultInstitutionSettings = {
  name: 'Formularios Institucionales',
  allowedDomains: '',
  retentionPeriod: 'indefinite' as const,
  enableAuditLog: true,
  logoDataUrl: null as string | null,
  loginLogoDataUrl: null as string | null,
};

const logoDataUrlSchema = z.string().max(3_000_000).regex(/^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/).nullable();

const institutionSettingsSchema = z.object({
  name: z.string().trim().min(1).max(180),
  allowedDomains: z.string().max(500),
  retentionPeriod: z.enum(['1_year', '3_years', '5_years', 'indefinite']),
  enableAuditLog: z.boolean(),
  logoDataUrl: logoDataUrlSchema,
  loginLogoDataUrl: logoDataUrlSchema,
});

// Public: used by the login screen and the sidebar, no authentication required.
app.get('/api/settings/branding', async (_req, res, next) => {
  try {
    const settings = await getSetting('institution', defaultInstitutionSettings);
    res.json({
      name: settings.name,
      logoDataUrl: settings.logoDataUrl ?? null,
      loginLogoDataUrl: settings.loginLogoDataUrl ?? null,
    });
  } catch (error) { next(error); }
});

app.get('/api/settings/institution', requireAuth, requireRoles('Administrador'), async (_req, res, next) => {
  try {
    const settings = await getSetting('institution', defaultInstitutionSettings);
    res.json(settings);
  } catch (error) { next(error); }
});

app.patch('/api/settings/institution', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const data = institutionSettingsSchema.parse(req.body);
    await setSetting('institution', data);
    await audit(req.user!.id, 'UPDATE', 'settings', 'institution');
    res.json(data);
  } catch (error) { next(error); }
});

// ---- Shared form templates: structure and design only (never responses, notification e-mails or limits) ----
const templateFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).default(''),
  category: z.string().trim().min(2).max(60),
};

/** Keeps only what makes sense to reuse: the questions and the look, plus harmless settings. */
function templateDefinition(definition: { fields?: unknown[]; design?: Record<string, unknown>; settings?: Record<string, unknown> }) {
  const s = definition.settings ?? {};
  return {
    fields: definition.fields ?? [],
    design: definition.design ?? {},
    settings: {
      collectEmails: !!s.collectEmails,
      confirmationMessage: typeof s.confirmationMessage === 'string' ? s.confirmationMessage : '',
      emailLabel: s.emailLabel, emailHelp: s.emailHelp, emailPlaceholder: s.emailPlaceholder, emailPosition: s.emailPosition,
    },
  };
}

const TEMPLATE_SELECT = `SELECT t.id, t.title, t.description, t.category, t.department, t.definition, t.created_by, t.created_at,
  u.name AS creator_name FROM form_templates t JOIN users u ON u.id = t.created_by`;

app.get('/api/templates', requireAuth, requireRoles('Administrador', 'Creador', 'Analista'), async (_req, res, next) => {
  try { res.json((await db.query(`${TEMPLATE_SELECT} ORDER BY t.created_at DESC`)).rows); } catch (error) { next(error); }
});

// Limits against abuse: a few creations per minute, a cap per person and a cap on the size of one template
const MAX_TEMPLATES_PER_USER = 50;
const MAX_TEMPLATE_BYTES = 2_000_000;
const templateCreateLimit = rateLimit({ windowMs: 60_000, max: 10, key: req => `tpl:${req.user?.id ?? req.ip}` });

app.post('/api/templates', requireAuth, requireRoles('Administrador', 'Creador'), templateCreateLimit, async (req, res, next) => {
  try {
    const data = z.object({ formId: z.string().uuid(), ...templateFields }).parse(req.body);
    // A Creador can only turn their own forms into templates
    const form = await db.query('SELECT department, definition FROM forms WHERE id = $1 AND (created_by = $2 OR $3 = \'Administrador\')', [data.formId, req.user!.id, req.user!.role]);
    if (!form.rowCount) return res.status(404).json({ message: 'Formulario no encontrado.' });
    const definition = templateDefinition(form.rows[0].definition ?? {});
    if ((definition.fields as unknown[]).length === 0) return res.status(400).json({ message: 'El formulario no tiene campos para guardar como plantilla.' });
    if (JSON.stringify(definition).length > MAX_TEMPLATE_BYTES) return res.status(413).json({ message: 'El formulario es demasiado grande para guardarlo como plantilla (máximo 2 MB).' });
    const owned = await db.query('SELECT COUNT(*)::int AS n FROM form_templates WHERE created_by = $1', [req.user!.id]);
    if (owned.rows[0].n >= MAX_TEMPLATES_PER_USER) {
      return res.status(400).json({ message: `Ya tiene ${MAX_TEMPLATES_PER_USER} plantillas. Elimine alguna para guardar otra.` });
    }
    const result = await db.query(
      `INSERT INTO form_templates (title, description, category, department, definition, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [data.title, data.description, data.category, form.rows[0].department, definition, req.user!.id],
    );
    await audit(req.user!.id, 'CREATE', 'template', result.rows[0].id, { title: data.title });
    res.status(201).json((await db.query(`${TEMPLATE_SELECT} WHERE t.id = $1`, [result.rows[0].id])).rows[0]);
  } catch (error) { next(error); }
});

app.patch('/api/templates/:id', requireAuth, requireRoles('Administrador', 'Creador'), async (req, res, next) => {
  try {
    const data = z.object(templateFields).parse(req.body);
    const result = await db.query(
      `UPDATE form_templates SET title = $1, description = $2, category = $3, updated_at = NOW()
       WHERE id = $4 AND (created_by = $5 OR $6 = 'Administrador') RETURNING id`,
      [data.title, data.description, data.category, req.params.id, req.user!.id, req.user!.role],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Plantilla no encontrada.' });
    await audit(req.user!.id, 'UPDATE', 'template', req.params.id, { title: data.title });
    res.json((await db.query(`${TEMPLATE_SELECT} WHERE t.id = $1`, [req.params.id])).rows[0]);
  } catch (error) { next(error); }
});

app.delete('/api/templates/:id', requireAuth, requireRoles('Administrador', 'Creador'), async (req, res, next) => {
  try {
    const result = await db.query(
      "DELETE FROM form_templates WHERE id = $1 AND (created_by = $2 OR $3 = 'Administrador') RETURNING title",
      [req.params.id, req.user!.id, req.user!.role],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Plantilla no encontrada.' });
    await audit(req.user!.id, 'DELETE', 'template', req.params.id, { title: result.rows[0].title });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/forms', requireAuth, async (req, res, next) => {
  try {
    const { id, role } = req.user!;
    // Respondedores answer forms through public links and manage none; Creadores only see their own forms.
    if (role === 'Respondedor') return res.json([]);
    const result = await db.query(`SELECT f.*, u.name AS creator_name, u.email AS creator_email,
      COUNT(r.id)::int AS response_count FROM forms f JOIN users u ON u.id = f.created_by
      LEFT JOIN form_responses r ON r.form_id = f.id
      WHERE ($1 <> 'Creador' OR f.created_by = $2)
      GROUP BY f.id, u.id ORDER BY f.updated_at DESC`, [role, id]);
    // Notification addresses are internal: only the owner and administrators see them
    res.json(result.rows.map(row => (role === 'Administrador' || row.created_by === id
      ? row
      : { ...row, definition: { ...row.definition, settings: { ...row.definition?.settings, notificationEmails: [] } } })));
  } catch (error) { next(error); }
});

/** Notification recipients: valid addresses only, at most 10, limited to the allowed domains when those are configured. */
async function notificationEmailsError(definition: { settings?: Record<string, unknown> } | undefined): Promise<string | null> {
  const emails = definition?.settings?.notificationEmails;
  if (emails === undefined) return null;
  if (!Array.isArray(emails) || emails.length > 10) return 'Se permiten hasta 10 correos de notificación.';
  const institution = await getSetting<{ allowedDomains?: string }>('institution', {});
  const domains = (institution.allowedDomains ?? '').split(/[,;\s]+/).map(d => d.trim().toLowerCase()).filter(Boolean).map(d => (d.startsWith('@') ? d : `@${d}`));
  for (const email of emails) {
    if (typeof email !== 'string' || !z.string().email().safeParse(email).success) return `Correo de notificación inválido: ${String(email).slice(0, 60)}`;
    if (domains.length && !domains.some(d => email.toLowerCase().endsWith(d))) return `Los correos de notificación deben ser de: ${domains.join(', ')}.`;
  }
  return null;
}

app.post('/api/forms', requireAuth, requireRoles('Administrador', 'Creador'), async (req, res, next) => {
  try {
    const data = formSchema.parse(req.body);
    const notifyError = await notificationEmailsError(data.definition);
    if (notifyError) return res.status(400).json({ message: notifyError });
    const result = await db.query(
      `INSERT INTO forms (title, description, department, definition, status, created_by, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 = 'published' THEN NOW() END) RETURNING *`,
      [data.title, data.description, data.department, data.definition, data.status ?? 'draft', req.user!.id],
    );
    await audit(req.user!.id, 'CREATE', 'form', result.rows[0].id, { title: data.title });
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.patch('/api/forms/:id', requireAuth, requireRoles('Administrador', 'Creador'), async (req, res, next) => {
  try {
    const data = formUpdateSchema.parse(req.body);
    const notifyError = await notificationEmailsError(data.definition);
    if (notifyError) return res.status(400).json({ message: notifyError });
    const result = await db.query(
      `UPDATE forms SET title = COALESCE($1, title), description = COALESCE($2, description),
       department = COALESCE($3, department), definition = COALESCE($4, definition), status = COALESCE($5, status),
       published_at = CASE WHEN $5 = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END, updated_at = NOW()
       WHERE id = $6 AND (created_by = $7 OR $8 = 'Administrador') RETURNING *`,
      [data.title, data.description, data.department, data.definition, data.status, req.params.id, req.user!.id, req.user!.role],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Formulario no encontrado.' });
    // The builder autosaves constantly: only log status changes, and content edits at most once per 10 minutes.
    const recent = data.status ? null : await db.query(
      "SELECT 1 FROM audit_log WHERE entity_type = 'form' AND entity_id = $1 AND action = 'UPDATE' AND actor_id = $2 AND created_at > NOW() - INTERVAL '10 minutes' LIMIT 1",
      [req.params.id, req.user!.id],
    );
    if (!recent?.rowCount) {
      await audit(req.user!.id, 'UPDATE', 'form', req.params.id, { title: result.rows[0].title, ...(data.status ? { status: data.status } : {}) });
    }
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.delete('/api/forms/:id', requireAuth, requireRoles('Administrador', 'Creador'), async (req, res, next) => {
  try {
    const result = await db.query(
      "DELETE FROM forms WHERE id = $1 AND (created_by = $2 OR $3 = 'Administrador') RETURNING title",
      [req.params.id, req.user!.id, req.user!.role],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Formulario no encontrado.' });
    await audit(req.user!.id, 'DELETE', 'form', req.params.id, { title: result.rows[0].title });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/responses', requireAuth, requireRoles('Administrador', 'Creador', 'Analista'), async (req, res, next) => {
  try {
    const scoped = req.user!.role === 'Creador';
    const result = await db.query(
      `SELECT r.*, f.title AS form_title, f.department AS form_department
       FROM form_responses r JOIN forms f ON f.id = r.form_id
       WHERE (NOT $1) OR f.created_by = $2
       ORDER BY r.submitted_at DESC`,
      [scoped, req.user!.id],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.get('/api/forms/:id/responses', requireAuth, requireRoles('Administrador', 'Creador', 'Analista'), async (req, res, next) => {
  try {
    const form = await db.query('SELECT created_by FROM forms WHERE id = $1', [req.params.id]);
    if (!form.rowCount) return res.status(404).json({ message: 'Formulario no encontrado.' });
    if (req.user!.role === 'Creador' && form.rows[0].created_by !== req.user!.id) {
      return res.status(403).json({ message: 'No tiene permisos para esta acción.' });
    }
    const result = await db.query('SELECT * FROM form_responses WHERE form_id = $1 ORDER BY submitted_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.get('/api/settings/email', requireAuth, async (_req, res, next) => {
  try { res.json({ mode: await mailMode() }); } catch (error) { next(error); }
});

app.get('/api/settings/smtp', requireAuth, requireRoles('Administrador'), async (_req, res, next) => {
  try {
    const stored = await getStoredSmtp();
    res.json({
      source: await mailSource(),
      host: stored?.host ?? '', port: stored?.port ?? 587, secure: stored?.secure ?? false,
      user: stored?.user ?? '', from: stored?.from ?? '', hasPassword: !!stored?.passEnc,
    });
  } catch (error) { next(error); }
});

app.put('/api/settings/smtp', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const data = z.object({
      host: z.string().trim().max(255),
      port: z.number().int().min(1).max(65535),
      secure: z.boolean(),
      user: z.string().trim().max(255),
      from: z.string().trim().max(255),
      // undefined keeps the saved password, '' removes it
      password: z.string().max(500).optional(),
    }).parse(req.body);

    if (!data.host) {
      await saveStoredSmtp(null);
      await audit(req.user!.id, 'UPDATE', 'settings', 'smtp', { cleared: true });
      return res.json({ ok: true });
    }
    const previous = await getStoredSmtp();
    const passEnc = data.password === undefined ? previous?.passEnc : data.password ? encryptSecret(data.password) : undefined;
    await saveStoredSmtp({ host: data.host, port: data.port, secure: data.secure, user: data.user, from: data.from, passEnc });
    await audit(req.user!.id, 'UPDATE', 'settings', 'smtp', { host: data.host });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/settings/smtp/test', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const { to } = z.object({ to: z.string().email() }).parse(req.body);
    if ((await mailMode()) === 'off') return res.status(400).json({ message: 'Primero guarde la configuración del servidor de correo.' });
    try {
      await sendMail({ to: [to], subject: 'Prueba de correo · Formularios Institucionales', html: '<p>Si recibe este mensaje, el servidor de correo está bien configurado.</p>' });
    } catch (error) {
      return res.status(502).json({ message: `No fue posible enviar: ${error instanceof Error ? error.message : 'error desconocido'}` });
    }
    res.json({ ok: true });
  } catch (error) { next(error); }
});

const REPORT_ROLES = ['Administrador', 'Creador', 'Analista'] as const;
const visibleSchedules = (all: ReportSchedule[], user: { id: string; role: string }) =>
  user.role === 'Administrador' ? all : all.filter(s => s.ownerId === user.id);

app.get('/api/report-schedules', requireAuth, requireRoles(...REPORT_ROLES), async (req, res, next) => {
  try { res.json(visibleSchedules(await getSchedules(), req.user!)); } catch (error) { next(error); }
});

app.post('/api/report-schedules', requireAuth, requireRoles(...REPORT_ROLES), async (req, res, next) => {
  try {
    const data = z.object({
      frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
      recipients: z.array(z.string().email()).min(1).max(30),
      includeCsv: z.boolean(),
    }).parse(req.body);
    const recipientsError = await notificationEmailsError({ settings: { notificationEmails: data.recipients } });
    if (recipientsError) return res.status(400).json({ message: recipientsError.replace('correos de notificación', 'destinatarios').replace('de notificación', '') });
    const now = new Date().toISOString();
    const schedule: ReportSchedule = {
      id: crypto.randomUUID(), ...data, ownerId: req.user!.id, ownerName: req.user!.name, ownerRole: req.user!.role,
      createdAt: now, lastSentAt: now, // the first report covers from now on
    };
    await saveSchedules([...(await getSchedules()), schedule]);
    await audit(req.user!.id, 'CREATE', 'settings', 'report_schedules', { frequency: data.frequency, recipients: data.recipients.length });
    res.status(201).json(schedule);
  } catch (error) { next(error); }
});

app.delete('/api/report-schedules/:id', requireAuth, requireRoles(...REPORT_ROLES), async (req, res, next) => {
  try {
    const all = await getSchedules();
    const target = visibleSchedules(all, req.user!).find(s => s.id === req.params.id);
    if (!target) return res.status(404).json({ message: 'Programación no encontrada.' });
    await saveSchedules(all.filter(s => s.id !== target.id));
    await audit(req.user!.id, 'DELETE', 'settings', 'report_schedules', { frequency: target.frequency });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/report-schedules/:id/send', requireAuth, requireRoles(...REPORT_ROLES), async (req, res, next) => {
  try {
    const target = visibleSchedules(await getSchedules(), req.user!).find(s => s.id === req.params.id);
    if (!target) return res.status(404).json({ message: 'Programación no encontrada.' });
    if ((await mailMode()) === 'off') return res.status(503).json({ message: 'El servidor de correo (SMTP) no está configurado. Configúrelo en Configuración → Servidor de correo.' });
    await sendScheduleNow(target);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.get('/api/notifications', requireAuth, requireRoles('Administrador', 'Creador', 'Analista'), async (req, res, next) => {
  try {
    const scoped = req.user!.role === 'Creador';
    const result = await db.query(
      `SELECT r.id, r.folio, r.submitted_at, r.form_id, f.title AS form_title
       FROM form_responses r JOIN forms f ON f.id = r.form_id
       WHERE (NOT $1) OR f.created_by = $2
       ORDER BY r.submitted_at DESC LIMIT 20`,
      [scoped, req.user!.id],
    );
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.get('/api/audit-log', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const q = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().refine(n => [10, 20, 50, 75, 100].includes(n)).default(20),
      action: z.string().max(40).optional(),
      search: z.string().max(100).optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(req.query);

    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
    if (q.action) add('a.action = ?', q.action);
    if (q.from) add('a.created_at >= ?::date', q.from);
    if (q.to) add("a.created_at < (?::date + INTERVAL '1 day')", q.to);
    if (q.search) {
      params.push(`%${q.search}%`);
      const n = `$${params.length}`;
      where.push(`(u.name ILIKE ${n} OR u.email ILIKE ${n} OR a.metadata::text ILIKE ${n} OR a.entity_id ILIKE ${n})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const base = `FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${whereSql}`;
    const total = await db.query(`SELECT COUNT(*)::int AS n ${base}`, params);
    const rows = await db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
              u.name AS actor_name, u.email AS actor_email
       ${base} ORDER BY a.created_at DESC, a.id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      params,
    );
    res.json({ items: rows.rows, total: total.rows[0].n });
  } catch (error) { next(error); }
});

app.get('/api/users', requireAuth, requireRoles('Administrador'), async (_req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, email, role, department, status, mfa_enabled, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.post('/api/users/:id/mfa-reset', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_enabled_at = NULL, updated_at = NOW(), token_valid_after = NOW()
       WHERE id = $1 RETURNING id, name, email, role, department, status, mfa_enabled, created_at`,
      [req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Usuario no encontrado.' });
    await audit(req.user!.id, 'MFA_RESET', 'user', req.params.id);
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.post('/api/users', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().trim().min(2).max(180),
      email: z.string().email(),
      role: z.enum(['Administrador', 'Creador', 'Analista', 'Respondedor']),
      department: z.string().trim().min(2).max(180),
      password: z.string().min(8).max(200),
    }).parse(req.body);
    const existing = await db.query('SELECT id FROM users WHERE lower(email) = lower($1)', [data.email]);
    if (existing.rowCount) return res.status(409).json({ message: 'Ya existe un usuario con ese correo.' });
    const domainError = await emailDomainError(data.email, data.role);
    if (domainError) return res.status(400).json({ message: domainError });
    const passwordHash = await bcrypt.hash(data.password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, department, status)
       VALUES ($1, $2, $3, $4, $5, 'Activo') RETURNING id, name, email, role, department, status, mfa_enabled, created_at`,
      [data.name, data.email, passwordHash, data.role, data.department],
    );
    await audit(req.user!.id, 'CREATE', 'user', result.rows[0].id, { name: data.name, email: data.email, role: data.role });
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

const DEFAULT_DEPARTMENTS = ['Recursos Humanos', 'Finanzas y Presupuesto', 'Tecnología e Informática', 'Atención Ciudadana', 'Operaciones'];

app.get('/api/departments', requireAuth, async (_req, res, next) => {
  try { res.json(await getSetting<string[]>('departments', DEFAULT_DEPARTMENTS)); } catch (error) { next(error); }
});

app.put('/api/departments', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const { departments } = z.object({ departments: z.array(z.string().trim().min(2).max(180)).max(200) }).parse(req.body);
    const unique = [...new Set(departments)];
    await setSetting('departments', unique);
    await audit(req.user!.id, 'UPDATE', 'settings', 'departments');
    res.json(unique);
  } catch (error) { next(error); }
});

app.patch('/api/users/:id', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().trim().min(2).max(180).optional(),
      email: z.string().email().optional(),
      department: z.string().trim().min(2).max(180).optional(),
      role: z.enum(['Administrador', 'Creador', 'Analista', 'Respondedor']).optional(),
      status: z.enum(['Activo', 'Invitado', 'Inactivo']).optional(),
      password: z.string().min(8).max(200).optional(),
    }).parse(req.body);
    if (data.email || data.role) {
      const current = await db.query('SELECT email, role FROM users WHERE id = $1', [req.params.id]);
      if (!current.rowCount) return res.status(404).json({ message: 'Usuario no encontrado.' });
      const domainError = await emailDomainError(data.email ?? current.rows[0].email, data.role ?? current.rows[0].role);
      if (domainError) return res.status(400).json({ message: domainError });
    }
    if (data.email) {
      const dup = await db.query('SELECT id FROM users WHERE lower(email) = lower($1) AND id != $2', [data.email, req.params.id]);
      if (dup.rowCount) return res.status(409).json({ message: 'Ya existe un usuario con ese correo.' });
    }
    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null;
    const result = await db.query(
      `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status),
         password_hash = COALESCE($3, password_hash), name = COALESCE($5, name),
         email = COALESCE($6, email), department = COALESCE($7, department), updated_at = NOW(),
         token_valid_after = CASE WHEN $8 THEN NOW() ELSE token_valid_after END
       WHERE id = $4 RETURNING id, name, email, role, department, status, mfa_enabled, created_at`,
      // Changing role, status or password signs the user out everywhere
      [data.role, data.status, passwordHash, req.params.id, data.name, data.email, data.department, !!(data.role || data.status || data.password)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Usuario no encontrado.' });
    await audit(req.user!.id, 'UPDATE', 'user', req.params.id, {
      name: result.rows[0].name, email: result.rows[0].email,
      ...(data.role ? { role: data.role } : {}), ...(data.status ? { status: data.status } : {}),
      ...(data.department ? { department: data.department } : {}), ...(data.password ? { passwordChanged: true } : {}),
    });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

// ---- Captcha configuration (global provider + per-form override) ----
interface CaptchaConfig { provider: 'none' | CaptchaProvider; siteKey: string; secretEnc?: string; minScore?: number }
const DEFAULT_MIN_SCORE = 0.5;
const getCaptchaConfig = () => getSetting<CaptchaConfig>('captcha', { provider: 'none', siteKey: '' });

/**
 * Captcha that applies to a form: the configured provider for every form, unless the form opts out;
 * with no provider configured, a form can still turn on the built-in arithmetic question.
 */
async function captchaFor(settings: { captchaEnabled?: boolean }): Promise<{ provider: 'builtin' | CaptchaProvider; siteKey?: string } | null> {
  if (settings.captchaEnabled === false) return null;
  const config = await getCaptchaConfig();
  if (config.provider !== 'none' && config.secretEnc && config.siteKey) return { provider: config.provider, siteKey: config.siteKey };
  return settings.captchaEnabled === true ? { provider: 'builtin' } : null;
}

app.get('/api/settings/captcha', requireAuth, requireRoles('Administrador'), async (_req, res, next) => {
  try {
    const c = await getCaptchaConfig();
    res.json({ provider: c.provider, siteKey: c.siteKey, hasSecret: !!c.secretEnc, minScore: c.minScore ?? DEFAULT_MIN_SCORE });
  } catch (error) { next(error); }
});

// Any signed-in user may read which provider is active (the builder shows it); the secret never leaves the server
app.get('/api/settings/captcha-status', requireAuth, async (_req, res, next) => {
  try {
    const c = await getCaptchaConfig();
    const active = c.provider !== 'none' && !!c.secretEnc && !!c.siteKey;
    res.json({ provider: active ? c.provider : 'none', siteKey: active ? c.siteKey : '' });
  } catch (error) { next(error); }
});

app.put('/api/settings/captcha', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const data = z.object({
      provider: z.enum(['none', 'turnstile', 'hcaptcha', 'recaptcha', 'recaptcha3']),
      minScore: z.number().min(0.1).max(0.9).optional(), // reCAPTCHA v3 only
      siteKey: z.string().trim().max(300),
      secretKey: z.string().max(500).optional(), // undefined keeps the saved secret, '' removes it
    }).parse(req.body);
    const previous = await getCaptchaConfig();
    const secretEnc = data.secretKey === undefined ? previous.secretEnc : data.secretKey ? encryptSecret(data.secretKey) : undefined;
    if (data.provider !== 'none' && (!data.siteKey || !secretEnc)) {
      return res.status(400).json({ message: 'Indique la clave del sitio y la clave secreta del proveedor.' });
    }
    await setSetting('captcha', { provider: data.provider, siteKey: data.siteKey, secretEnc, minScore: data.minScore ?? previous.minScore ?? DEFAULT_MIN_SCORE });
    await audit(req.user!.id, 'UPDATE', 'settings', 'captcha', { provider: data.provider });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// Checks the secret key against the provider: a deliberately invalid token gets a different error when the secret is wrong
app.post('/api/settings/captcha/verify', requireAuth, requireRoles('Administrador'), async (_req, res, next) => {
  try {
    const c = await getCaptchaConfig();
    if (c.provider === 'none' || !c.secretEnc) return res.status(400).json({ message: 'Guarde primero el proveedor y las claves.' });
    const verdict = await verifyExternalCaptcha(c.provider, readSecret(c.secretEnc), c.siteKey, 'prueba-de-credenciales');
    if (verdict.unreachable) return res.status(502).json({ message: 'No fue posible comunicarse con el proveedor desde el servidor. Revise la conexión a internet.' });
    // Google validates the token before the secret, so a bad secret looks the same as a fake token: it cannot be
    // checked without a real submission. We only confirm that the server can reach Google.
    if (c.provider === 'recaptcha' || c.provider === 'recaptcha3') return res.json({ ok: true, checked: false });
    if (verdict.errors.some(e => ['invalid-input-secret', 'missing-input-secret', 'sitekey-secret-mismatch'].includes(e))) {
      return res.status(400).json({ message: 'La clave secreta no es válida para este proveedor.' });
    }
    res.json({ ok: true, checked: true });
  } catch (error) { next(error); }
});

type PublicFormSettings = { captchaEnabled?: boolean; notifyEmailOnSubmit?: boolean; notificationEmails?: string[]; closeDate?: string; maxTotalResponses?: number; limitOneResponsePerUser?: boolean; collectEmails?: boolean };

/** Why a published form is not accepting responses right now, or null when it is open. */
async function closedReason(formId: string, settings: PublicFormSettings): Promise<string | null> {
  if (settings.closeDate && new Date(`${settings.closeDate}T23:59:59`).getTime() < Date.now()) {
    return 'Este formulario ya cerró: venció su fecha límite de respuesta.';
  }
  if (settings.maxTotalResponses && settings.maxTotalResponses > 0) {
    const count = await db.query('SELECT COUNT(*)::int AS n FROM form_responses WHERE form_id = $1', [formId]);
    if (count.rows[0].n >= settings.maxTotalResponses) return 'Este formulario ya alcanzó el máximo de respuestas permitidas.';
  }
  return null;
}

app.get('/api/public/forms/:id', publicReadLimit, async (req, res, next) => {
  try {
    const result = await db.query("SELECT id, title, description, department, definition FROM forms WHERE id = $1 AND status = 'published'", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Formulario no disponible.' });
    const reason = await closedReason(req.params.id, result.rows[0].definition?.settings ?? {});
    if (reason) return res.status(410).json({ message: reason });
    // Never expose internal notification addresses on the public endpoint
    const row = result.rows[0];
    row.definition = { ...row.definition, settings: { ...row.definition?.settings, notificationEmails: [] } };
    res.json({ ...row, captcha: await captchaFor(row.definition?.settings ?? {}) });
  } catch (error) { next(error); }
});

app.get('/api/public/forms/:id/challenge', publicReadLimit, (_req, res) => res.json(createChallenge()));

app.post('/api/public/forms/:id/responses', publicSubmitLimit, async (req, res, next) => {
  try {
    const payload = z.object({ answers: z.record(z.string(), z.unknown()), respondentEmail: z.string().email().optional(), respondentName: z.string().max(180).optional(), respondentDepartment: z.string().max(180).optional(), completionTimeSeconds: z.number().int().nonnegative().optional(), captchaToken: z.string().max(4000).optional(), captchaAnswer: z.string().max(20).optional(), website: z.string().max(200).optional() }).parse(req.body);
    // Hidden "website" field: people never fill it in, simple bots do
    if (payload.website) return res.status(400).json({ message: 'No fue posible enviar su respuesta.' });
    const form = await db.query("SELECT id, title, definition FROM forms WHERE id = $1 AND status = 'published'", [req.params.id]);
    if (!form.rowCount) return res.status(404).json({ message: 'Formulario no disponible.' });
    const settings: PublicFormSettings = form.rows[0].definition?.settings ?? {};
    const reason = await closedReason(req.params.id, settings);
    if (reason) return res.status(410).json({ message: reason });
    const captcha = await captchaFor(settings);
    if (captcha?.provider === 'builtin') {
      if (!verifyChallenge(payload.captchaToken, payload.captchaAnswer)) {
        return res.status(400).json({ message: 'La verificación es incorrecta o venció. Inténtelo de nuevo.', captcha: true });
      }
    } else if (captcha) {
      const config = await getCaptchaConfig();
      const raw = payload.captchaToken
        ? await verifyExternalCaptcha(captcha.provider as CaptchaProvider, readSecret(config.secretEnc!), config.siteKey, payload.captchaToken, req.ip)
        : { ok: false, errors: ['missing-input-response'], unreachable: false };
      const verdict = captcha.provider === 'recaptcha3' ? evaluateRecaptchaV3(raw, config.minScore ?? DEFAULT_MIN_SCORE) : raw;
      if (!verdict.ok) {
        return res.status(verdict.unreachable ? 503 : 400).json({
          message: verdict.unreachable
            ? 'No fue posible validar la verificación anti-spam. Intente nuevamente en unos minutos.'
            : 'La verificación anti-spam no fue válida o venció. Complétela de nuevo.',
          captcha: true,
        });
      }
    }
    if ((settings.collectEmails || settings.limitOneResponsePerUser) && !payload.respondentEmail) {
      return res.status(400).json({ message: 'Este formulario requiere un correo electrónico.' });
    }
    if (settings.limitOneResponsePerUser && payload.respondentEmail) {
      const dup = await db.query('SELECT 1 FROM form_responses WHERE form_id = $1 AND lower(respondent_email) = lower($2) LIMIT 1', [req.params.id, payload.respondentEmail]);
      if (dup.rowCount) return res.status(409).json({ message: 'Ya existe una respuesta registrada con este correo electrónico.', code: 'duplicate_email' });
    }
    // Keep only answers to this form's real questions, with sane sizes (the endpoint is public)
    const questionIds = new Set<string>(((form.rows[0].definition?.fields ?? []) as { id?: string; type?: string }[])
      .filter(f => f.id && !['section', 'banner', 'image'].includes(String(f.type))).map(f => String(f.id)));
    const submitted = Object.entries(payload.answers);
    if (submitted.length > 300) return res.status(400).json({ message: 'Demasiadas respuestas en el envío.' });
    const answers: Record<string, unknown> = {};
    for (const [key, value] of submitted) {
      if (!questionIds.has(key)) continue;
      if (JSON.stringify(value ?? null).length > 20_000) return res.status(400).json({ message: 'Una de las respuestas es demasiado larga.' });
      answers[key] = value;
    }

    const folio = `FOR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await db.query(`INSERT INTO form_responses (form_id, folio, answers, respondent_email, respondent_name, respondent_department, completion_time_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, folio, submitted_at`, [req.params.id, folio, answers, payload.respondentEmail, payload.respondentName, payload.respondentDepartment, payload.completionTimeSeconds]);
    const notifyTo = settings.notifyEmailOnSubmit ? (settings.notificationEmails ?? []).filter(e => z.string().email().safeParse(e).success) : [];
    if (notifyTo.length && notificationBudgetLeft(req.params.id) && (await mailMode()) !== 'off') {
      const title = form.rows[0].title;
      sendMail({
        to: notifyTo,
        subject: `Nueva respuesta en «${title}»`,
        html: `<p>Se recibió una nueva respuesta en el formulario <strong>${escapeHtml(title)}</strong>.</p><p>Folio: <strong>${escapeHtml(folio)}</strong><br>Fecha: ${new Date().toLocaleString('es-GT')}</p>`,
      }).catch(err => console.error('No fue posible enviar la notificación de respuesta:', err));
    }
    await audit(undefined, 'SUBMIT', 'form_response', created.rows[0].id, { formId: req.params.id, formTitle: form.rows[0].title, folio });
    res.status(201).json(created.rows[0]);
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: 'Datos inválidos.', details: error.flatten() });
  // Body-parser failures: payload too large (413) or malformed JSON (400)
  const status = (error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ message: status === 413 ? 'La solicitud es demasiado grande.' : 'Solicitud no válida.' });
  }
  console.error(error);
  res.status(500).json({ message: 'Ocurrió un error inesperado.' });
});

initializeDatabase().then(() => app.listen(port, () => { console.log(`API disponible en http://localhost:${port}`); startBackgroundJobs(); })).catch((error) => {
  console.error('No fue posible inicializar la base de datos.', error);
  process.exit(1);
});
