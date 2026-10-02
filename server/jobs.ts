import { audit, db, getSetting, setSetting } from './db.js';
import { escapeHtml, mailMode, sendMail } from './mailer.js';

// ---------------------------------------------------------------------------
// Scheduled report e-mails
// ---------------------------------------------------------------------------

export type ReportFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface ReportSchedule {
  id: string;
  frequency: ReportFrequency;
  recipients: string[];
  includeCsv: boolean;
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  createdAt: string;
  lastSentAt: string;
}

export const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  daily: 'Diario (08:00)',
  weekly: 'Semanal (lunes 08:00)',
  biweekly: 'Quincenal (días 1 y 15, 08:00)',
  monthly: 'Mensual (primer día hábil, 08:00)',
};

const SEND_HOUR = 8;

export async function getSchedules(): Promise<ReportSchedule[]> {
  return getSetting<ReportSchedule[]>('report_schedules', []);
}

export async function saveSchedules(schedules: ReportSchedule[]) {
  await setSetting('report_schedules', schedules);
}

/** Start (local time) of the most recent reporting period that has already begun. */
export function latestPeriodStart(frequency: ReportFrequency, now: Date): Date {
  const at = (y: number, m: number, d: number) => new Date(y, m, d, SEND_HOUR, 0, 0, 0);
  const firstWeekday = (y: number, m: number) => {
    let day = 1;
    while ([0, 6].includes(new Date(y, m, day).getDay())) day++;
    return at(y, m, day);
  };

  switch (frequency) {
    case 'daily': {
      const today = at(now.getFullYear(), now.getMonth(), now.getDate());
      return today <= now ? today : at(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    }
    case 'weekly': {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const monday = at(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
      return monday <= now ? monday : at(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday - 7);
    }
    case 'biweekly': {
      const candidates = [
        at(now.getFullYear(), now.getMonth(), 1),
        at(now.getFullYear(), now.getMonth(), 15),
        at(now.getFullYear(), now.getMonth() - 1, 15),
      ];
      return candidates.filter(c => c <= now).sort((a, b) => b.getTime() - a.getTime())[0];
    }
    case 'monthly': {
      const thisMonth = firstWeekday(now.getFullYear(), now.getMonth());
      return thisMonth <= now ? thisMonth : firstWeekday(now.getFullYear(), now.getMonth() - 1);
    }
  }
}

export const isDue = (schedule: ReportSchedule, now = new Date()) =>
  new Date(schedule.lastSentAt).getTime() < latestPeriodStart(schedule.frequency, now).getTime();

// Cells that start with = + - @ (or tab/CR) would be run as formulas by Excel; prefix them with a quote.
const csvCell = (v: unknown) => {
  const text = String(v ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

async function buildReport(schedule: ReportSchedule, since: Date) {
  const scoped = schedule.ownerRole === 'Creador';
  const params = [since.toISOString(), scoped, schedule.ownerId];

  const perForm = await db.query(
    `SELECT f.title, f.department,
            COUNT(r.id) FILTER (WHERE r.submitted_at >= $1)::int AS period_count,
            COUNT(r.id)::int AS total_count
     FROM forms f LEFT JOIN form_responses r ON r.form_id = f.id
     WHERE (NOT $2) OR f.created_by = $3
     GROUP BY f.id ORDER BY period_count DESC, f.title`,
    params,
  );
  const responses = schedule.includeCsv
    ? await db.query(
        `SELECT r.folio, r.submitted_at, r.respondent_email, r.respondent_department, r.completion_time_seconds, f.title, f.department
         FROM form_responses r JOIN forms f ON f.id = r.form_id
         WHERE r.submitted_at >= $1 AND ((NOT $2) OR f.created_by = $3) ORDER BY r.submitted_at`,
        params,
      )
    : null;

  const periodTotal = perForm.rows.reduce((a, r) => a + r.period_count, 0);
  const allTotal = perForm.rows.reduce((a, r) => a + r.total_count, 0);
  const fmt = (d: Date) => d.toLocaleDateString('es-GT', { dateStyle: 'long' });
  const rows = perForm.rows.map(r =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(r.title)}</td>`
    + `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapeHtml(r.department)}</td>`
    + `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${r.period_count}</td>`
    + `<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${r.total_count}</td></tr>`).join('');

  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:640px">
    <h2 style="color:#1d4ed8;margin-bottom:4px">Reporte ${escapeHtml(FREQUENCY_LABELS[schedule.frequency].split(' (')[0].toLowerCase())} de formularios</h2>
    <p style="color:#64748b;margin-top:0">Del ${fmt(since)} al ${fmt(new Date())}</p>
    <p><strong style="font-size:22px">${periodTotal}</strong> respuestas nuevas en el período · ${allTotal} en total · ${perForm.rowCount} formularios</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr style="background:#1d4ed8;color:#fff"><th style="padding:6px 10px;text-align:left">Formulario</th><th style="padding:6px 10px;text-align:left">Departamento</th><th style="padding:6px 10px;text-align:right">Período</th><th style="padding:6px 10px;text-align:right">Total</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="padding:10px;color:#94a3b8">Sin formularios.</td></tr>'}</tbody>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">Programado por ${escapeHtml(schedule.ownerName)}.</p></div>`;

  const attachments = responses
    ? [{
        filename: `respuestas_${new Date().toISOString().slice(0, 10)}.csv`,
        contentType: 'text/csv; charset=utf-8',
        content: '﻿' + [
          ['Folio', 'Formulario', 'Departamento', 'Fecha de envío', 'Correo', 'Tiempo (s)'].map(csvCell).join(';'),
          ...responses.rows.map(r => [r.folio, r.title, r.respondent_department || r.department, new Date(r.submitted_at).toLocaleString('es-GT'), r.respondent_email || 'Anónimo', r.completion_time_seconds ?? ''].map(csvCell).join(';')),
        ].join('\r\n'),
      }]
    : undefined;

  return { html, attachments, periodTotal };
}

/** Sends one schedule's report now and records it as sent. */
export async function sendScheduleNow(schedule: ReportSchedule) {
  const since = new Date(schedule.lastSentAt);
  const { html, attachments, periodTotal } = await buildReport(schedule, since);
  await sendMail({ to: schedule.recipients, subject: `Reporte de formularios · ${periodTotal} respuestas nuevas`, html, attachments });

  const all = await getSchedules();
  await saveSchedules(all.map(s => (s.id === schedule.id ? { ...s, lastSentAt: new Date().toISOString() } : s)));
  await audit(schedule.ownerId, 'REPORT_SENT', 'settings', 'report_schedules', { recipients: schedule.recipients.length, responses: periodTotal });
}

async function runDueSchedules() {
  if ((await mailMode()) === 'off') return;
  for (const schedule of await getSchedules()) {
    if (!isDue(schedule)) continue;
    try { await sendScheduleNow(schedule); } catch (error) { console.error('No fue posible enviar el reporte programado:', error); }
  }
}

// ---------------------------------------------------------------------------
// Retention policy
// ---------------------------------------------------------------------------

const RETENTION_DAYS: Record<string, number> = { '1_year': 365, '3_years': 365 * 3, '5_years': 365 * 5 };

/** Permanently deletes responses older than the institution's retention period. Runs at most once per day. */
export async function applyRetentionPolicy() {
  const institution = await getSetting<{ retentionPeriod?: string }>('institution', {});
  const days = RETENTION_DAYS[institution.retentionPeriod ?? 'indefinite'];
  if (!days) return;

  const today = new Date().toISOString().slice(0, 10);
  if ((await getSetting<string>('retention_last_run', '')) === today) return;

  const result = await db.query(`DELETE FROM form_responses WHERE submitted_at < NOW() - ($1 || ' days')::interval`, [String(days)]);
  await setSetting('retention_last_run', today);
  if (result.rowCount) {
    await audit(undefined, 'PURGE', 'form_response', 'retention', { deleted: result.rowCount, retention: institution.retentionPeriod });
  }
}

export function startBackgroundJobs() {
  const tick = () => {
    runDueSchedules().catch(err => console.error('Error en reportes programados:', err));
    applyRetentionPolicy().catch(err => console.error('Error al aplicar la política de retención:', err));
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 15 * 60_000);
}
