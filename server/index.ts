import './env.js';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createMfaPendingToken, createToken, requireAuth, requireMfaPendingToken, requireRoles } from './auth.js';
import { audit, db, getSetting, initializeDatabase, setSetting } from './db.js';

authenticator.options = { window: 1 };

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const allowedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '15mb' }));

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
    await audit(req.user!.id, 'CREATE', 'form', result.rows[0].id);
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
    await audit(req.user!.id, 'UPDATE', 'form', req.params.id);
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.delete('/api/forms/:id', requireAuth, requireRoles('Administrador', 'Creador'), async (req, res, next) => {
  try {
    const result = await db.query(
      "DELETE FROM forms WHERE id = $1 AND (created_by = $2 OR $3 = 'Administrador')",
      [req.params.id, req.user!.id, req.user!.role],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Formulario no encontrado.' });
    await audit(req.user!.id, 'DELETE', 'form', req.params.id);
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

app.get('/api/audit-log', requireAuth, requireRoles('Administrador'), async (_req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
              u.name AS actor_name, u.email AS actor_email
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
       ORDER BY a.created_at DESC LIMIT 100`,
    );
    res.json(result.rows);
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
    }).parse(req.body);
    const tempPassword = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, department, status)
       VALUES ($1, $2, $3, $4, $5, 'Invitado') RETURNING id, name, email, role, department, status, mfa_enabled, created_at`,
      [data.name, data.email, passwordHash, data.role, data.department],
    );
    await audit(req.user!.id, 'INVITE', 'user', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) { next(error); }
});

app.patch('/api/users/:id', requireAuth, requireRoles('Administrador'), async (req, res, next) => {
  try {
    const data = z.object({
      role: z.enum(['Administrador', 'Creador', 'Analista', 'Respondedor']).optional(),
      status: z.enum(['Activo', 'Invitado', 'Inactivo']).optional(),
    }).parse(req.body);
    const result = await db.query(
      `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status), updated_at = NOW()
       WHERE id = $3 RETURNING id, name, email, role, department, status, mfa_enabled, created_at`,
      [data.role, data.status, req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Usuario no encontrado.' });
    await audit(req.user!.id, 'UPDATE', 'user', req.params.id);
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.get('/api/public/forms/:id', async (req, res, next) => {
  try {
    const result = await db.query("SELECT id, title, description, department, definition FROM forms WHERE id = $1 AND status = 'published'", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ message: 'Formulario no disponible.' });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.post('/api/public/forms/:id/responses', async (req, res, next) => {
  try {
    const payload = z.object({ answers: z.record(z.string(), z.unknown()), respondentEmail: z.string().email().optional(), respondentName: z.string().max(180).optional(), respondentDepartment: z.string().max(180).optional(), completionTimeSeconds: z.number().int().nonnegative().optional() }).parse(req.body);
    const form = await db.query("SELECT id FROM forms WHERE id = $1 AND status = 'published'", [req.params.id]);
    if (!form.rowCount) return res.status(404).json({ message: 'Formulario no disponible.' });
    const folio = `FOR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await db.query(`INSERT INTO form_responses (form_id, folio, answers, respondent_email, respondent_name, respondent_department, completion_time_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, folio, submitted_at`, [req.params.id, folio, payload.answers, payload.respondentEmail, payload.respondentName, payload.respondentDepartment, payload.completionTimeSeconds]);
    await audit(undefined, 'SUBMIT', 'form_response', created.rows[0].id, { formId: req.params.id });
    res.status(201).json(created.rows[0]);
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ message: 'Datos inválidos.', details: error.flatten() });
  console.error(error);
  res.status(500).json({ message: 'Ocurrió un error inesperado.' });
});

initializeDatabase().then(() => app.listen(port, () => console.log(`API disponible en http://localhost:${port}`))).catch((error) => {
  console.error('No fue posible inicializar la base de datos.', error);
  process.exit(1);
});
