import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X, Copy, Check, QrCode, Code2, Globe, Send, UserPlus,
  Trash2, CopyPlus, Calendar, Mail, FileSpreadsheet, ArrowRight, PlusCircle, Download, Loader2
} from 'lucide-react';
import { Form, UserRole } from '../types';
import { api, ReportScheduleRow } from '../services/api';

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  maxWidth = 'max-w-lg'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
      <div 
        className={`relative w-full ${maxWidth} bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in duration-150`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// 1. Share Modal
export const ShareModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  form: Form | null;
  onShowPublicView: (formId: string) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ isOpen, onClose, form, onShowPublicView, showToast }) => {
  const [tab, setTab] = useState<'link' | 'qr' | 'embed'>('link');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const publicUrl = form ? `${window.location.origin}/responder/${form.id}` : '';
  const embedCode = form ? `<iframe src="${publicUrl}" width="100%" height="800" frameborder="0" marginheight="0" marginwidth="0">Cargando formulario...</iframe>` : '';

  useEffect(() => {
    if (!isOpen || !form || tab !== 'qr') return;
    let cancelled = false;
    setQrLoading(true);
    QRCode.toDataURL(publicUrl, { width: 320, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) showToast('No fue posible generar el código QR.', 'error'); })
      .finally(() => { if (!cancelled) setQrLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, form, tab, publicUrl]);

  if (!form) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Enlace copiado al portapapeles', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Compartir Formulario">
      <div className="space-y-5">
        <div className="flex border-b border-slate-200 text-sm">
          <button
            onClick={() => setTab('link')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              tab === 'link' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" /> Enlace directo
          </button>
          <button
            onClick={() => setTab('qr')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              tab === 'qr' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" /> Código QR
          </button>
          <button
            onClick={() => setTab('embed')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-2 ${
              tab === 'embed' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-4 h-4" /> Incrustar web
          </button>
        </div>

        {tab === 'link' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Cualquier funcionario o ciudadano con este enlace podrá completar y enviar respuestas en línea.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicUrl}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 select-all"
              />
              <button
                onClick={() => copyToClipboard(publicUrl)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onShowPublicView(form.id);
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowRight className="w-4 h-4 text-blue-600" /> Abrir vista pública de respuesta ahora
              </button>
            </div>
          </div>
        )}

        {tab === 'qr' && (
          <div className="text-center space-y-4 py-2">
            <p className="text-sm text-slate-600">
              Ideal para imprimir afiches institucionales, credenciales o exhibir en ventanillas de atención.
            </p>
            <div className="inline-flex items-center justify-center w-52 h-52 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              {qrLoading || !qrDataUrl ? (
                <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
              ) : (
                <img src={qrDataUrl} alt={`Código QR para ${form.title}`} className="w-full h-full" />
              )}
            </div>
            <div>
              <button
                disabled={!qrDataUrl}
                onClick={() => {
                  if (!qrDataUrl) return;
                  const link = document.createElement('a');
                  link.href = qrDataUrl;
                  link.download = `qr-formulario-${form.id.slice(0, 8)}.png`;
                  link.click();
                  showToast('Código QR descargado', 'success');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar imagen QR (PNG)
              </button>
            </div>
          </div>
        )}

        {tab === 'embed' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Copie y pegue este código HTML en su portal institucional o intranet para integrar el formulario.
            </p>
            <textarea
              readOnly
              rows={4}
              value={embedCode}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 select-all"
            />
            <button
              onClick={() => copyToClipboard(embedCode)}
              className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copiar código de integración
            </button>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// 2. Publish / Change Status Modal
export const PublishModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  form: Form | null;
  onConfirmStatus: (status: 'draft' | 'published' | 'closed') => void;
}> = ({ isOpen, onClose, form, onConfirmStatus }) => {
  const [targetStatus, setTargetStatus] = useState<'published' | 'draft' | 'closed'>(
    form?.status === 'published' ? 'closed' : 'published'
  );

  if (!form) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Gestionar Estado del Formulario">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Modifique el ciclo de vida de <span className="font-semibold text-slate-900">"{form.title}"</span>.
        </p>

        <div className="space-y-2.5">
          <label className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
            targetStatus === 'published' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <input
              type="radio"
              name="statusRadio"
              checked={targetStatus === 'published'}
              onChange={() => setTargetStatus('published')}
              className="mt-1 text-blue-600"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Publicado (Activo)</div>
              <div className="text-xs text-slate-500">El formulario estará disponible de inmediato para recibir respuestas del público o personal.</div>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
            targetStatus === 'draft' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <input
              type="radio"
              name="statusRadio"
              checked={targetStatus === 'draft'}
              onChange={() => setTargetStatus('draft')}
              className="mt-1 text-blue-600"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Borrador</div>
              <div className="text-xs text-slate-500">Solo visible para administradores y editores autorizados. No admite envíos públicos.</div>
            </div>
          </label>

          <label className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${
            targetStatus === 'closed' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <input
              type="radio"
              name="statusRadio"
              checked={targetStatus === 'closed'}
              onChange={() => setTargetStatus('closed')}
              className="mt-1 text-blue-600"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900">Cerrado</div>
              <div className="text-xs text-slate-500">Ya no acepta nuevas respuestas. Conserva todos los datos históricos y reportes.</div>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmStatus(targetStatus);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-xs"
          >
            Actualizar estado
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

// 3. Delete Confirmation Modal
export const DeleteModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  form: Form | null;
  onConfirmDelete: (formId: string) => void;
}> = ({ isOpen, onClose, form, onConfirmDelete }) => {
  if (!form) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Confirmar Eliminación">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
          <Trash2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Atención:</span> Esta acción archivará de manera irreversible el formulario <span className="font-semibold">"{form.title}"</span> junto con sus <span className="font-semibold tabular-nums">{form.responseCount}</span> respuestas asociadas.
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Recomendamos descargar un respaldo en formato Excel o CSV desde la pestaña de Respuestas antes de proceder.
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Conservar formulario
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDelete(form.id);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
          >
            Sí, eliminar formulario
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

// 4. Duplicate Form Modal
export const DuplicateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  form: Form | null;
  onConfirmDuplicate: (form: Form, newTitle: string) => void;
}> = ({ isOpen, onClose, form, onConfirmDuplicate }) => {
  const [newTitle, setNewTitle] = useState(form ? `Copia de ${form.title}` : '');

  React.useEffect(() => {
    if (form) {
      setNewTitle(`Copia de ${form.title}`);
    }
  }, [form]);

  if (!form) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Duplicar Formulario">
      <form onSubmit={(e) => {
        e.preventDefault();
        if (newTitle.trim()) {
          onConfirmDuplicate(form, newTitle.trim());
          onClose();
        }
      }} className="space-y-4">
        <p className="text-sm text-slate-600">
          Se creará una réplica idéntica con todas las preguntas, validaciones y diseño, en estado <span className="font-semibold">Borrador</span> y con 0 respuestas.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Nombre para el nuevo formulario
          </label>
          <input
            type="text"
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <CopyPlus className="w-4 h-4" /> Duplicar formulario
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

// 5. Invite User Modal
export const InviteUserModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onInvite: (user: { name: string; email: string; role: UserRole; department: string; password: string }) => void;
  departments: string[];
}> = ({ isOpen, onClose, onInvite, departments }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('Creador');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8 || !(department || departments[0])) return;
    onInvite({ name, email, role, department: department || departments[0] || '', password });
    setName('');
    setEmail('');
    setPassword('');
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Crear usuario">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Nombre Completo
          </label>
          <input
            type="text"
            required
            placeholder="Ej: Lic. Mauricio Sanhueza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Correo Institucional (@minfin.gob.gt)
          </label>
          <input
            type="email"
            required
            placeholder="nombre.apellido@minfin.gob.gt"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Rol Asignado
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            >
              <option value="Administrador">Administrador</option>
              <option value="Creador">Creador</option>
              <option value="Analista">Analista</option>
              <option value="Respondedor">Respondedor</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Departamento
            </label>
            <select
              value={department || departments[0] || ''}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            >
              {departments.length === 0 && <option value="">Cree departamentos en Configuración</option>}
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Contraseña inicial
          </label>
          <input
            type="text"
            required
            minLength={8}
            autoComplete="off"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Comparta esta contraseña con el usuario; podrá cambiarla desde su perfil.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-4 h-4" /> Crear usuario
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

// 6. Schedule Report Modal
const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diario (cada mañana 08:00)' },
  { value: 'weekly', label: 'Semanal (cada lunes 08:00)' },
  { value: 'biweekly', label: 'Quincenal (días 1 y 15, 08:00)' },
  { value: 'monthly', label: 'Mensual (primer día hábil, 08:00)' },
] as const;

export const ScheduleReportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ isOpen, onClose, showToast }) => {
  const [schedules, setSchedules] = useState<ReportScheduleRow[]>([]);
  const [mailMode, setMailMode] = useState<'smtp' | 'console' | 'off' | null>(null);
  const [frequency, setFrequency] = useState<string>('weekly');
  const [recipients, setRecipients] = useState('');
  const [includeCsv, setIncludeCsv] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.getReportSchedules().then(setSchedules).catch(() => {});

  useEffect(() => {
    if (!isOpen) return;
    load();
    api.getEmailStatus().then(r => setMailMode(r.mode)).catch(() => setMailMode(null));
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = recipients.split(/[,;\s]+/).map(r => r.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy('create');
    try {
      await api.createReportSchedule({ frequency, recipients: list, includeCsv });
      setRecipients('');
      await load();
      showToast('Reporte programado correctamente', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible programar el reporte.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleSendNow = async (id: string) => {
    setBusy(id);
    try {
      await api.sendReportScheduleNow(id);
      await load();
      showToast('Reporte enviado', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible enviar el reporte.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(id);
    try {
      await api.deleteReportSchedule(id);
      await load();
      showToast('Programación eliminada', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible eliminar la programación.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Programar Envío Periódico de Reportes">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Envíe automáticamente por correo un resumen de respuestas por formulario a jefaturas y comités.
        </p>

        {mailMode === 'off' && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
            El servidor de correo no está configurado: las programaciones se guardan, pero no se enviarán hasta que un Administrador lo configure en
            <strong className="mx-1">Configuración → Servidor de correo (SMTP)</strong>.
          </div>
        )}
        {mailMode === 'console' && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg">
            Modo de pruebas: los correos no se envían, se muestran en el registro del servidor.
          </div>
        )}

        {schedules.length > 0 && (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {schedules.map(s => (
              <div key={s.id} className="p-3 text-xs flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">{FREQUENCY_OPTIONS.find(f => f.value === s.frequency)?.label}</div>
                  <div className="text-slate-500 truncate" title={s.recipients.join(', ')}>{s.recipients.join(', ')}</div>
                  <div className="text-[11px] text-slate-400">
                    {s.includeCsv ? 'Resumen + CSV' : 'Solo resumen'} · último envío: {new Date(s.lastSentAt).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => handleSendNow(s.id)}
                    className="px-2 py-1 text-blue-700 hover:bg-blue-50 rounded font-semibold disabled:opacity-50"
                  >
                    Enviar ahora
                  </button>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => handleDelete(s.id)}
                    className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded font-semibold disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Nueva programación</div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Frecuencia de Envío</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            >
              {FREQUENCY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Destinatarios (separados por coma)
            </label>
            <input
              type="text"
              required
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="jefatura@minfin.gob.gt, director@minfin.gob.gt"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={includeCsv} onChange={(e) => setIncludeCsv(e.target.checked)} className="accent-blue-700" />
            Adjuntar CSV con las respuestas del período
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={busy === 'create'}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Mail className="w-4 h-4" /> Programar
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
};

// 7. New Form Choice Modal
export const NewFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreateBlank: () => void;
  onGoToTemplates: () => void;
}> = ({ isOpen, onClose, onCreateBlank, onGoToTemplates }) => {
  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Crear Nuevo Formulario">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Elija cómo desea comenzar a construir su formulario digital institucional:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          <button
            onClick={() => {
              onClose();
              onCreateBlank();
            }}
            className="p-4 text-left border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 rounded-xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-slate-900 text-sm mb-1">Formulario en Blanco</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Diseñe desde cero agregando campos, preguntas y secciones según sus requerimientos.
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 mt-4 flex items-center gap-1">
              Comenzar en blanco →
            </span>
          </button>

          <button
            onClick={() => {
              onClose();
              onGoToTemplates();
            }}
            className="p-4 text-left border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 rounded-xl transition-all group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-slate-900 text-sm mb-1">Desde Plantilla</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Seleccione un modelo prediseñado de Clima Laboral, Solicitud de Viáticos, Evaluaciones o Encuestas.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-600 mt-4 flex items-center gap-1">
              Ver catálogo de plantillas →
            </span>
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};
