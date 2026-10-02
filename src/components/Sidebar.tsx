import React from 'react';
import { 
  Home, 
  FileText, 
  Inbox, 
  BarChart3, 
  LayoutTemplate, 
  Users2, 
  Settings, 
  ShieldCheck, 
  ScrollText,
  LogOut,
  ChevronRight,
  Plus
} from 'lucide-react';
import { ActiveScreen } from '../types';

interface SidebarProps {
  currentScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  formsCount: number;
  openNewFormModal: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  currentUser: { name: string; role: string } | null;
  onLogout: () => void;
  branding?: { name: string; logoDataUrl: string | null } | null;
  brandingLoaded?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentScreen,
  onNavigate,
  formsCount,
  openNewFormModal,
  isMobileOpen,
  setIsMobileOpen,
  currentUser,
  onLogout,
  branding,
  brandingLoaded
}) => {
  interface NavItem {
    id: ActiveScreen;
    label: string;
    icon: any;
    badge?: number;
  }

  const navItems: NavItem[] = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'forms', label: 'Formularios', icon: FileText, badge: formsCount },
    { id: 'responses', label: 'Respuestas', icon: Inbox },
    { id: 'reports', label: 'Reportes', icon: BarChart3 },
    { id: 'templates', label: 'Plantillas', icon: LayoutTemplate },
    { id: 'users', label: 'Usuarios', icon: Users2 },
    ...(currentUser?.role === 'Administrador' ? [{ id: 'audit' as ActiveScreen, label: 'Auditoría', icon: ScrollText }] : []),
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  const handleNav = (screen: ActiveScreen) => {
    onNavigate(screen);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-40 w-64 bg-gradient-to-b from-[#0a2847] via-[#0d3a63] to-[#0a2847] text-slate-300 flex flex-col border-r border-white/10 transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Area */}
        <div className="h-28 px-4 flex items-center justify-center border-b border-white/10 shrink-0">
          {!brandingLoaded ? (
            <div className="w-4/5 h-16 rounded-md bg-white/10 animate-pulse" />
          ) : branding?.logoDataUrl ? (
            <img src={branding.logoDataUrl} alt={branding.name} className="max-h-24 w-4/5 object-contain" />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold text-white tracking-tight leading-none">Formularios</div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">Gestión Digital</div>
              </div>
            </div>
          )}
        </div>

        {/* Primary CTA */}
        <div className="p-4">
          <button
            onClick={openNewFormModal}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Crear formulario</span>
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id as ActiveScreen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-300' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded-md font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Institutional User Profile Footer */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 transition-colors">
            <div className="w-9 h-9 rounded-full bg-blue-700 text-white flex items-center justify-center font-semibold text-xs shrink-0">
              {(currentUser?.name ?? 'US').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{currentUser?.name ?? 'Sesión'}</div>
              <div className="text-[11px] text-slate-400 truncate">{currentUser?.role ?? ''}</div>
            </div>
            <button
              title="Cerrar sesión"
              onClick={onLogout}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-md"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
