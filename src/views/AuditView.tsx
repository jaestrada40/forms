import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, ScrollText, Search } from 'lucide-react';
import { api, AuditLogRow } from '../services/api';
import { Pagination } from '../components/Pagination';
import { formatDateSpanish } from '../utils/helpers';

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGIN_MFA: 'Inicio de sesión (MFA)',
  LOGIN_FAILED: 'Intento de acceso fallido',
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  SUBMIT: 'Respuesta recibida',
  INVITE: 'Invitación de usuario',
  MFA_ENABLE: 'MFA activado',
  MFA_RESET: 'MFA restablecido',
  PURGE: 'Depuración por retención',
  REPORT_SENT: 'Reporte enviado',
};

const ACTION_TONE: Record<string, string> = {
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  LOGIN_FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  PURGE: 'bg-rose-50 text-rose-700 border-rose-200',
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SUBMIT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-50 text-blue-700 border-blue-200',
  MFA_ENABLE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MFA_RESET: 'bg-amber-50 text-amber-700 border-amber-200',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'Usuario',
  form: 'Formulario',
  form_response: 'Respuesta',
  template: 'Plantilla',
  settings: 'Configuración',
};

const SETTINGS_LABELS: Record<string, string> = {
  institution: 'Datos institucionales',
  mfa_enforced: 'MFA obligatorio',
  departments: 'Departamentos',
  report_schedules: 'Reportes programados',
};

/** Human-readable one-liner describing what the entry touched. */
function describe(entry: AuditLogRow): string {
  const m = entry.metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (entry.entity_type === 'settings') parts.push(SETTINGS_LABELS[entry.entity_id] || entry.entity_id);
  if (m.title) parts.push(`«${m.title}»`);
  if (m.formTitle) parts.push(`«${m.formTitle}»`);
  if (m.folio) parts.push(`folio ${m.folio}`);
  if (entry.entity_type === 'user' && m.name) parts.push(`${m.name}${m.email ? ` (${m.email})` : ''}`);
  else if (entry.action === 'LOGIN_FAILED' && m.email) parts.push(String(m.email));
  if (m.role) parts.push(`rol ${m.role}`);
  if (m.status) parts.push(`estado ${m.status}`);
  if (m.department) parts.push(`depto. ${m.department}`);
  if (m.passwordChanged) parts.push('contraseña cambiada');
  if (m.self) parts.push('perfil propio');
  if (typeof m.enforced === 'boolean') parts.push(m.enforced ? 'activado' : 'desactivado');
  if (typeof m.deleted === 'number') parts.push(`${m.deleted} respuestas eliminadas`);
  return parts.join(' · ');
}

export const AuditView: React.FC = () => {
  const [items, setItems] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [action, setAction] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce the text search and go back to page 1 whenever a filter changes
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => { setPage(1); }, [action, search, from, to, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.getAuditLog({ page, pageSize, action, search, from, to })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'No fue posible cargar el registro de auditoría.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, action, search, from, to, reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Gobernanza y Accesos</div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Registro de Auditoría</h2>
          <p className="text-xs text-slate-500">Quién hizo qué y cuándo: accesos, cambios de formularios, usuarios y configuración.</p>
        </div>
        <button
          onClick={() => setReloadKey(k => k + 1)}
          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por usuario, correo, formulario o folio..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
          />
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-2.5 rounded-lg"
        >
          <option value="">Todas las acciones</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-2 rounded-lg" aria-label="Desde" />
          <span className="text-slate-400 text-xs">a</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-2 rounded-lg" aria-label="Hasta" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {error ? (
          <p className="p-6 text-sm text-rose-600">{error}</p>
        ) : loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No hay actividad registrada con estos filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4">Elemento</th>
                  <th className="py-3 px-4">Detalle</th>
                  <th className="py-3 px-4">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">{formatDateSpanish(entry.created_at, true)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-md border font-semibold ${ACTION_TONE[entry.action] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                        {AUDIT_ACTION_LABELS[entry.action] || entry.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{ENTITY_LABELS[entry.entity_type] || entry.entity_type}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-md">{describe(entry) || <span className="text-slate-300">—</span>}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{entry.actor_name || (entry.action === 'SUBMIT' ? 'Respondiente público' : 'Sistema')}</div>
                      {entry.actor_email && <div className="text-[11px] text-slate-400">{entry.actor_email}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  );
};
