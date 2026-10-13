import { db } from './db.js';

interface LimitSettings { maxTotalResponses?: number; limitOneResponsePerUser?: boolean }

interface NewResponse {
  respondentEmail?: string;
  respondentName?: string;
  respondentDepartment?: string;
  completionTimeSeconds?: number;
}

export type InsertOutcome =
  | { row: { id: string; folio: string; submitted_at: string }; error?: undefined }
  | { row?: undefined; error: { status: number; body: { message: string; code?: string } } };

/**
 * Stores a public response. The response cap and the "one response per e-mail" rule are checked again inside a
 * transaction that holds a per-form lock, so concurrent submissions cannot slip past them (the checks done
 * before are only a fast path).
 */
export async function insertResponseLocked(formId: string, settings: LimitSettings, payload: NewResponse, folio: string, answers: Record<string, unknown>): Promise<InsertOutcome> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [formId]);

    if (settings.maxTotalResponses && settings.maxTotalResponses > 0) {
      const count = await client.query('SELECT COUNT(*)::int AS n FROM form_responses WHERE form_id = $1', [formId]);
      if (count.rows[0].n >= settings.maxTotalResponses) {
        await client.query('ROLLBACK');
        return { error: { status: 410, body: { message: 'Este formulario ya alcanzó el máximo de respuestas permitidas.' } } };
      }
    }
    if (settings.limitOneResponsePerUser && payload.respondentEmail) {
      // Same "+tag"-insensitive comparison as the early check in the route
      const dup = await client.query(
        "SELECT 1 FROM form_responses WHERE form_id = $1 AND regexp_replace(lower(respondent_email), '\\+[^@]*@', '@') = regexp_replace(lower($2), '\\+[^@]*@', '@') LIMIT 1",
        [formId, payload.respondentEmail],
      );
      if (dup.rowCount) {
        await client.query('ROLLBACK');
        return { error: { status: 409, body: { message: 'Ya existe una respuesta registrada con este correo electrónico.', code: 'duplicate_email' } } };
      }
    }

    const created = await client.query(
      `INSERT INTO form_responses (form_id, folio, answers, respondent_email, respondent_name, respondent_department, completion_time_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, folio, submitted_at`,
      [formId, folio, answers, payload.respondentEmail, payload.respondentName, payload.respondentDepartment, payload.completionTimeSeconds],
    );
    await client.query('COMMIT');
    return { row: created.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
