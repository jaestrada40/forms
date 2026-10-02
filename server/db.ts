import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL es obligatorio para iniciar la API.');
}

export const db = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export async function initializeDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Administrador', 'Creador', 'Analista', 'Respondedor')),
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Activo' CHECK (status IN ('Activo', 'Invitado', 'Inactivo')),
      mfa_secret TEXT,
      mfa_enabled BOOLEAN NOT NULL DEFAULT false,
      mfa_enabled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
      definition JSONB NOT NULL DEFAULT '{"fields":[],"design":{},"settings":{}}'::jsonb,
      department TEXT NOT NULL,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS form_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      folio TEXT NOT NULL UNIQUE,
      answers JSONB NOT NULL,
      respondent_email TEXT,
      respondent_name TEXT,
      respondent_department TEXT,
      completion_time_seconds INTEGER,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_id UUID REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_forms_created_by ON forms(created_by);
    CREATE INDEX IF NOT EXISTS idx_responses_form_submitted ON form_responses(form_id, submitted_at DESC);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;
  `);

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (!existing.rowCount) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.query(
        `INSERT INTO users (name, email, password_hash, role, department)
         VALUES ($1, $2, $3, 'Administrador', $4)`,
        [process.env.ADMIN_NAME?.trim() || 'Administrador', email, passwordHash, process.env.ADMIN_DEPARTMENT?.trim() || 'Administración'],
      );
      console.log(`Usuario administrador inicial creado: ${email}`);
    }
  }
}

export async function audit(actorId: string | undefined, action: string, entityType: string, entityId: string, metadata = {}) {
  const institution = await getSetting<{ enableAuditLog?: boolean }>('institution', {});
  if (institution.enableAuditLog === false) return;
  await db.query(
    'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)',
    [actorId ?? null, action, entityType, entityId, metadata],
  );
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const result = await db.query('SELECT value FROM app_settings WHERE key = $1', [key]);
  return result.rowCount ? (result.rows[0].value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.query(
    'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, JSON.stringify(value)],
  );
}
