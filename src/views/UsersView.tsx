import React, { useState } from 'react';
import { 
  Users2, 
  UserPlus, 
  Shield, 
  Check, 
  Clock, 
  MoreVertical, 
  Mail, 
  Search, 
  AlertCircle,
  FileCheck2,
  Lock
} from 'lucide-react';
import { UserAccount, UserRole, UserStatus } from '../types';

interface UsersViewProps {
  users: UserAccount[];
  onOpenInviteModal: () => void;
  onUpdateUserRole: (userId: string, newRole: UserRole) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  onOpenInviteModal,
  onUpdateUserRole,
  showToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'Administrador':
        return <span className="font-semibold text-blue-700">Administrador</span>;
      case 'Creador':
        return <span className="font-semibold text-emerald-700">Creador de Formularios</span>;
      case 'Analista':
        return <span className="font-semibold text-indigo-700">Analista de Reportes</span>;
      case 'Respondedor':
        return <span className="font-semibold text-slate-600">Respondedor Asignado</span>;
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'Activo':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Activo
          </span>
        );
      case 'Invitado':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Invitación enviada
          </span>
        );
      case 'Inactivo':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Suspendido
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
            Gobernanza y Accesos
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Usuarios y Asignación de Permisos
          </h2>
          <p className="text-xs text-slate-500">
            Controle los niveles de acceso para la creación de formularios y visualización de respuestas protegidas.
          </p>
        </div>

        <button
          onClick={onOpenInviteModal}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invitar Usuario Institucional</span>
        </button>
      </div>

      {/* Role Matrix Explanation Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-700" />
          <span>Matriz de Perfiles y Atribuciones</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="font-bold text-slate-900 mb-1">Administrador</div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Control total del sistema: gestión de usuarios, auditoría, eliminación y configuración global.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="font-bold text-slate-900 mb-1">Creador</div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Diseño, publicación y edición de formularios propios o de su dirección adscrita.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="font-bold text-slate-900 mb-1">Analista</div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Acceso a métricas ejecutivas, visualización de respuestas y exportación a Excel / CSV.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="font-bold text-slate-900 mb-1">Respondedor</div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Acceso exclusivo para el llenado y seguimiento de folios asignados a su correo.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o departamento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-2.5 rounded-lg"
          >
            <option value="all">Todos los roles</option>
            <option value="Administrador">Administrador</option>
            <option value="Creador">Creador</option>
            <option value="Analista">Analista</option>
            <option value="Respondedor">Respondedor</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Departamento</th>
                <th className="py-3 px-4">Rol Asignado</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Última Actividad</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {user.initials}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.name}</div>
                        <div className="text-[11px] text-slate-400">{user.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-slate-600">
                    {user.department}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getStatusBadge(user.status)}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                    {user.lastActive}
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap relative">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {activeMenuId === user.id && (
                      <div className="absolute right-4 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1 text-left">
                        <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Cambiar Rol:
                        </div>
                        {(['Administrador', 'Creador', 'Analista', 'Respondedor'] as const).map(role => (
                          <button
                            key={role}
                            onClick={() => {
                              onUpdateUserRole(user.id, role);
                              setActiveMenuId(null);
                              showToast(`Rol de ${user.name} actualizado a ${role}`, 'success');
                            }}
                            className="w-full px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 rounded flex items-center justify-between"
                          >
                            <span>{role}</span>
                            {user.role === role && <Check className="w-3 h-3 text-blue-700" />}
                          </button>
                        ))}
                        <div className="border-t border-slate-100 my-1"></div>
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            showToast(`Invitación reenviada a ${user.email}`, 'info');
                          }}
                          className="w-full px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50 rounded"
                        >
                          Reenviar credenciales
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
