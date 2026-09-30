import React, { useState } from 'react';
import { 
  Menu, 
  Search, 
  Bell, 
  ChevronDown, 
  CheckCheck, 
  Plus, 
  ExternalLink,
  Shield,
  FileText
} from 'lucide-react';
import { ActiveScreen, Form } from '../types';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  currentScreen: ActiveScreen;
  onOpenNewFormModal: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  forms: Form[];
  onSelectFormForBuilder: (formId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  currentScreen,
  onOpenNewFormModal,
  searchQuery,
  setSearchQuery,
  forms,
  onSelectFormForBuilder
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
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
              RM
            </div>
            <span className="hidden xl:inline-block text-xs font-semibold text-slate-800">
              R. Morales
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 hidden xl:inline-block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="font-semibold text-slate-900">Lic. Roberto Morales</div>
                <div className="text-slate-500 text-[11px] truncate">roberto.morales@gobierno.cl</div>
                <div className="mt-1 text-[10px] text-blue-700 font-medium">Administrador Institucional</div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 text-slate-700"
                >
                  Perfil de usuario
                </button>
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-50 text-slate-700"
                >
                  Registro de auditoría
                </button>
              </div>
              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-rose-50 text-rose-600 font-medium"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
