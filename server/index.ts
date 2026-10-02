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
import { getSchedules, saveSchedules, sendScheduleNow, startBackgroundJobs, ReportSchedule } from './jobs.js';

authenticator.options = { window: 1 };

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const allowedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '15mb' }));

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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await db.query('SELECT id, name, email, password_hash, role, department, status, mfa_enabled FROM users WHERE lower(email) = lower($1)', [email]);
    const user = result.rows[0];
    if (!user || user.status !== 'Activo' || !(await bcrypt.compare(password, user.password_hash))) {
      await audit(user?.id, 'LOGIN_FAILED', 'user', user?.id ?? 'desconocido', { email });
      return res.status(401).json({ message: 'Correo o contraseña inválidos.' });
    }

    if (user.mfa_enabled) {
      const mfaToken = createMfaPendingToken(user.id, 'verify');
      return res.json({ mfaRequired: true, mfaToken });
    }

    const mfaEnforced = await getSetting('mfa_enforced', false);
    if (mfaEnforced) {
      const mfaToken = createMfaPendingToken(user.id, 'setup');
      return res.json({ mfaSetupRequired: true, mfaToken });
    }

    const token = createToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    await audit(user.id, 'LOGIN', 'user', user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (error) { next(error); }
});

app.post('/api/auth/mfa/setup', requireMfaPendingToken, async (req, res, next) => {
  try {
    if (req.mfaPending!.mode !== 'setup') return res.status(403).json({ message: 'Flujo de verificación inválido.' });
    const userResult = await db.query('SELECT id, email, name, mfa_enabled FROM users WHERE id = $1', [req.mfaPending!.id]);
    if (!userResult.rowCount) return res.status(404).json({ message: 'Usuario no encontrado.' });
    const user = userResult.rows[0];
    if (user.mfa_enabled) return res.status(409).json({ message: 'La verificación en dos pasos ya está habilitada.' });
    const secretValue = authenticator.generateSecret();
    await db.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secretValue, user.id]);
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
    if (!authenticator.check(code, user.mfa_secret)) return res.status(401).json({ message: 'Código inválido.' });
    await db.query('UPDATE users SET mfa_enabled = true, mfa_enabled_at = NOW() WHERE id = $1', [user.id]);
    const token = createToken({ id: user.id, name: user.name, email: user.email, role: user.role });
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
    if (!authenticator.check(code, user.mfa_secret)) return res.status(401).json({ message: 'Código inválido.' });
    const token = createToken({ id: user.id, name: user.name, email: user.email, role: user.role });
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
      `UPDATE users SET name = $1, email = $2, password_hash = COALESCE($3, password_hash), updated_at = NOW()
       WHERE id = $4 RETURNING id, name, email, role, department`,
      [data.name, data.email, newPasswordHash, user.id],
    );

    const updatedUser = updated.rows[0];
    const token = createToken({ id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role });
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

app.get('/api/forms', requireAuth, async (_req, res, next) => {
  try {
    const result = await db.query(`SELECT f.*, u.name AS creator_name, u.email AS creator_email,
      COUNT(r.id)::int AS response_count FROM forms f JOIN users u ON u.id = f.created_by
      LEFT JOIN form_responses r ON r.form_id = f.id GROUP BY f.id, u.id ORDER BY f.updated_at DESC`);
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.post('/api/forms', requireAuth, requireRoles('Administrador', 'Creador'), async (req, res, next) => {
  try {
    const data = formSchema.parse(req.body);
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
      `UPDATE users SET mfa_enabled = false, mfa_secret = NULL, mfa_enabled_at = NULL, updated_at = NOW()
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
         email = COALESCE($6, email), department = COALESCE($7, department), updated_at = NOW()
       WHERE id = $4 RETURNING id, name, email, role, department, status, mfa_enabled, created_at`,
      [data.role, data.status, passwordHash, req.params.id, data.name, data.email, data.department],
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

type PublicFormSettings = { notifyEmailOnSubmit?: boolean; notificationEmails?: string[]; closeDate?: string; maxTotalResponses?: number; limitOneResponsePerUser?: boolean; collectEmails?: boolean };

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

app.get('/api/public/forms/:id', async (req, res, next) => {
  try {
    const result = await db.query("SELECT id, title, description, department, definition FROM forms WHERE id = $1 AND status = 'published'", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Formulario no disponible.' });
    const reason = await closedReason(req.params.id, result.rows[0].definition?.settings ?? {});
    if (reason) return res.status(410).json({ message: reason });
    // Never expose internal notification addresses on the public endpoint
    const row = result.rows[0];
    row.definition = { ...row.definition, settings: { ...row.definition?.settings, notificationEmails: [] } };
    res.json(row);
  } catch (error) { next(error); }
});

app.post('/api/public/forms/:id/responses', async (req, res, next) => {
  try {
    const payload = z.object({ answers: z.record(z.string(), z.unknown()), respondentEmail: z.string().email().optional(), respondentName: z.string().max(180).optional(), respondentDepartment: z.string().max(180).optional(), completionTimeSeconds: z.number().int().nonnegative().optional() }).parse(req.body);
    const form = await db.query("SELECT id, title, definition FROM forms WHERE id = $1 AND status = 'published'", [req.params.id]);
    if (!form.rowCount) return res.status(404).json({ message: 'Formulario no disponible.' });
    const settings: PublicFormSettings = form.rows[0].definition?.settings ?? {};
    const reason = await closedReason(req.params.id, settings);
    if (reason) return res.status(410).json({ message: reason });
    if ((settings.collectEmails || settings.limitOneResponsePerUser) && !payload.respondentEmail) {
      return res.status(400).json({ message: 'Este formulario requiere un correo electrónico.' });
    }
    if (settings.limitOneResponsePerUser && payload.respondentEmail) {
      const dup = await db.query('SELECT 1 FROM form_responses WHERE form_id = $1 AND lower(respondent_email) = lower($2) LIMIT 1', [req.params.id, payload.respondentEmail]);
      if (dup.rowCount) return res.status(409).json({ message: 'Ya existe una respuesta registrada con este correo electrónico.' });
    }
    const folio = `FOR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await db.query(`INSERT INTO form_responses (form_id, folio, answers, respondent_email, respondent_name, respondent_department, completion_time_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, folio, submitted_at`, [req.params.id, folio, payload.answers, payload.respondentEmail, payload.respondentName, payload.respondentDepartment, payload.completionTimeSeconds]);
    const notifyTo = settings.notifyEmailOnSubmit ? (settings.notificationEmails ?? []).filter(e => z.string().email().safeParse(e).success) : [];
    if (notifyTo.length && (await mailMode()) !== 'off') {
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
  console.error(error);
  res.status(500).json({ message: 'Ocurrió un error inesperado.' });
});

initializeDatabase().then(() => app.listen(port, () => { console.log(`API disponible en http://localhost:${port}`); startBackgroundJobs(); })).catch((error) => {
  console.error('No fue posible inicializar la base de datos.', error);
  process.exit(1);
});
