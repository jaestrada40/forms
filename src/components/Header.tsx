import React, { useEffect, useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  CheckCheck,
  Plus,
  ExternalLink,
  Shield,
  FileText,
  Loader2,
  X,
  ScrollText,
  Eye,
  EyeOff
} from 'lucide-react';
import { ActiveScreen, Form } from '../types';
import { api, AuditLogRow, SessionUser } from '../services/api';
import { ModalWrapper } from './Modals';
import { formatDateSpanish } from '../utils/helpers';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  currentScreen: ActiveScreen;
  onOpenNewFormModal: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  forms: Form[];
  onSelectFormForBuilder: (formId: string) => void;
  currentUser: SessionUser | null;
  onLogout: () => void;
  onProfileUpdated: (user: SessionUser) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const PasswordField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}> = ({ label, value, onChange, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 pl-3 pr-10 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(prev => !prev)}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
          title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

const ProfileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  user: SessionUser | null;
  onProfileUpdated: (user: SessionUser) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ isOpen, onClose, user, onProfileUpdated, showToast }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setName(user.name);
      setEmail(user.email);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
    }
  }, [isOpen, user]);

  if (!user) return null;
  const initials = user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.updateProfile({
        name,
        email,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      onProfileUpdated(result.user);
      showToast('Perfil actualizado correctamente.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Perfil de usuario">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold shrink-0">
            {initials}
          </div>
          <dl className="text-xs">
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-500">Rol:</dt>
              <dd className="font-semibold text-slate-800">{user.role}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-500">Departamento:</dt>
              <dd className="font-semibold text-slate-800">{user.department || '—'}</dd>
            </div>
          </dl>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-3">
          <p className="text-[11px] text-slate-500">
            Para cambiar su correo o su contraseña, confirme su contraseña actual.
          </p>
          <PasswordField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="Nueva contraseña (opcional)" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          {newPassword && (
            <PasswordField label="Confirmar nueva contraseña" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          )}
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGIN_MFA: 'Inicio de sesión (MFA)',
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  SUBMIT: 'Respuesta recibida',
  INVITE: 'Invitación de usuario',
  MFA_ENABLE: 'MFA activado',
  MFA_RESET: 'MFA restablecido',
};

const AuditLogModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    api.getAuditLog()
      .then(setEntries)
      .catch(err => setError(err instanceof Error ? err.message : 'No fue posible cargar el registro de auditoría.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Registro de auditoría" maxWidth="max-w-2xl">
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">Aún no hay actividad registrada.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 -mx-2">
          {entries.map(entry => (
            <div key={entry.id} className="px-2 py-2.5 text-xs flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">
                  {AUDIT_ACTION_LABELS[entry.action] || entry.action}
                  <span className="text-slate-400 font-normal"> · {entry.entity_type}</span>
                </div>
                <div className="text-slate-500 truncate">
                  {entry.actor_name || 'Sistema'} {entry.actor_email ? `(${entry.actor_email})` : ''}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                {formatDateSpanish(entry.created_at, true)}
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalWrapper>
  );
};

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  currentScreen,
  onOpenNewFormModal,
  searchQuery,
  setSearchQuery,
  forms,
  onSelectFormForBuilder,
  currentUser,
  onLogout,
  onProfileUpdated,
  showToast
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: 'Nueva respuesta registrada',
      detail: 'Encuesta de Clima Laboral y Bienestar 2026 (Folio #FOR-2026-8946)',
      time: 'Hace 8 min',
      unread: true,
    },
    {
      id: 'n2',
      title: 'Solicitud de viático enviada',
      detail: 'Marcela Silva ingresó comisión de servicio a Valparaíso',
      time: 'Hace 45 min',
      unread: true,
    },
    {
      id: 'n3',
      title: 'Reporte programado enviado',
      detail: 'El informe semanal fue entregado a 4 destinatarios institucionales',
      time: 'Ayer',
      unread: false,
    },
  ]);

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const screenTitles: Record<ActiveScreen, string> = {
    home: 'Panel Institucional',
    forms: 'Mis Formularios',
    builder: 'Constructor de Formulario',
    responses: 'Panel de Respuestas',
    reports: 'Reportes y Analíticas',
    templates: 'Galería de Plantillas',
    users: 'Usuarios y Permisos',
    settings: 'Configuración del Sistema',
    public_view: 'Vista Pública',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
      {/* Left side: Hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <h1 className="text-base font-semibold text-slate-900 leading-tight">
            {screenTitles[currentScreen]}
          </h1>
        </div>
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar formularios, folios, unidades..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Right side: Notifications & User */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick New Form Button on tablet/desktop */}
        <button
          onClick={onOpenNewFormModal}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Crear</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors relative"
            title="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in duration-100">
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Notificaciones ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" /> Marcar leídas
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-3 text-xs transition-colors hover:bg-slate-50 ${
                      n.unread ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800 mb-0.5">
                      <span>{n.title}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{n.time}</span>
                    </div>
                    <div className="text-slate-600 leading-snug">{n.detail}</div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-slate-100 text-center bg-slate-50">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Pill */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold">
              {(currentUser?.name ?? 'US').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className="hidden xl:inline-block text-xs font-semibold text-slate-800">
              {currentUser?.name ?? 'Sesión'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden xl:inline-block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="font-semibold text-slate-900">{currentUser?.name ?? '—'}</div>
                <div className="text-slate-500 text-[11px] truncate">{currentUser?.email ?? ''}</div>
                <div className="mt-1 text-[10px] text-blue-700 font-medium">{currentUser?.role ?? ''}</div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setShowUserMenu(false); setShowProfileModal(true); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 text-slate-700"
                >
                  Perfil de usuario
                </button>
                {currentUser?.role === 'Administrador' && (
                  <button
                    onClick={() => { setShowUserMenu(false); setShowAuditModal(true); }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 text-slate-700"
                  >
                    Registro de auditoría
                  </button>
                )}
              </div>
              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => { setShowUserMenu(false); onLogout(); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-rose-50 text-rose-600 font-medium"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={currentUser}
        onProfileUpdated={onProfileUpdated}
        showToast={showToast}
      />
      <AuditLogModal isOpen={showAuditModal} onClose={() => setShowAuditModal(false)} />
    </header>
  );
};
