import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { createToken, requireAuth, requireRoles } from './auth.js';
import { audit, db, initializeDatabase } from './db.js';

const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const allowedOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '2mb' }));

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const formSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().max(2_000).default(''),
  department: z.string().trim().min(2).max(180),
  definition: z.object({ fields: z.array(z.unknown()).default([]), design: z.record(z.string(), z.unknown()).default({}), settings: z.record(z.string(), z.unknown()).default({}) }),
  status: z.enum(['draft', 'published', 'closed']).optional(),
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await db.query('SELECT id, name, email, password_hash, role, department, status FROM users WHERE lower(email) = lower($1)', [email]);
    const user = result.rows[0];
    if (!user || user.status !== 'Activo' || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Correo o contraseña inválidos.' });
    }
    const token = createToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    await audit(user.id, 'LOGIN', 'user', user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, async (req, res) => res.json({ user: req.user }));

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
    const data = formSchema.partial().parse(req.body);
    const result = await db.query(
      `UPDATE forms SET title = COALESCE($1, title), description = COALESCE($2, description),
       department = COALESCE($3, department), definition = COALESCE($4, definition), status = COALESCE($5, status),
       published_at = CASE WHEN $5 = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [data.title, data.description, data.department, data.definition, data.status, req.params.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Formulario no encontrado.' });
    await audit(req.user!.id, 'UPDATE', 'form', req.params.id);
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
