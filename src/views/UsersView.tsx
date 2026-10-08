import React, { useState } from 'react';
import {
  Users2,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldOff,
  Clock,
  Mail,
  Search,
  AlertCircle,
  FileCheck2,
  RotateCcw,
  Pencil,
  Eye,
  EyeOff
} from 'lucide-react';
import { Pagination, usePagination } from '../components/Pagination';
import { ModalWrapper } from '../components/Modals';
import { UserAccount, UserRole, UserStatus } from '../types';

interface UsersViewProps {
  users: UserAccount[];
  onOpenInviteModal: () => void;
  onUpdateUserRole: (userId: string, newRole: UserRole) => void;
  onResetUserMfa: (userId: string) => void;
  onChangeUserPassword: (userId: string, password: string) => Promise<void> | void;
  onEditUser: (userId: string, data: { name: string; email: string; department: string }) => Promise<void> | void;
  departments: string[];
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const roleOptions: Array<{ role: UserRole; description: string }> = [
  { role: 'Administrador', description: 'Gestiona usuarios, configuración, auditoría y todos los formularios.' },
  { role: 'Creador', description: 'Crea, edita y publica sus propios formularios.' },
  { role: 'Analista', description: 'Consulta respuestas, métricas y exporta reportes.' },
  { role: 'Respondedor', description: 'Completa formularios y consulta los folios que le correspondan.' },
];

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  onOpenInviteModal,
  onUpdateUserRole,
  onResetUserMfa,
  onChangeUserPassword,
  onEditUser,
  departments,
  showToast
}) => {
  const [actionUser, setActionUser] = useState<UserAccount | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [actionForm, setActionForm] = useState({ name: '', email: '', department: '', password: '' });
  const [showActionPassword, setShowActionPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });
  const pg = usePagination(filteredUsers, `${searchQuery}|${roleFilter}`);

  const closeActionModal = () => {
    setActionUser(null);
    setPendingRole(null);
    setActionForm({ name: '', email: '', department: '', password: '' });
    setShowActionPassword(false);
  };

  const openActionModal = (user: UserAccount) => {
    setActionUser(user);
    setPendingRole(user.role);
    setActionForm({ name: user.name, email: user.email, department: user.department, password: '' });
    setShowActionPassword(false);
  };

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
      <ModalWrapper
        isOpen={!!actionUser}
        onClose={closeActionModal}
        title={`Gestionar usuario${actionUser ? ` · ${actionUser.name}` : ''}`}
      >
        {actionUser && (
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const detailsChanged = actionForm.name !== actionUser.name || actionForm.email !== actionUser.email || actionForm.department !== actionUser.department;
              if (detailsChanged) await onEditUser(actionUser.id, { name: actionForm.name, email: actionForm.email, department: actionForm.department });
              if (pendingRole && pendingRole !== actionUser.role) onUpdateUserRole(actionUser.id, pendingRole);
              if (actionForm.password) await onChangeUserPassword(actionUser.id, actionForm.password);
              showToast('Cambios del usuario guardados correctamente.', 'success');
              closeActionModal();
            }}
          >
            <section className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Datos del usuario</h4>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="managed-user-name">Nombre</label>
                <input id="managed-user-name" required value={actionForm.name} onChange={(event) => setActionForm(current => ({ ...current, name: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="managed-user-email">Correo</label>
                <input id="managed-user-email" type="email" required value={actionForm.email} onChange={(event) => setActionForm(current => ({ ...current, email: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="managed-user-department">Departamento</label>
                <select id="managed-user-department" value={actionForm.department} onChange={(event) => setActionForm(current => ({ ...current, department: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600">
                  {[...new Set([actionForm.department, ...departments])].filter(Boolean).map(department => <option key={department} value={department}>{department}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="managed-user-password">Nueva contraseña <span className="font-normal text-slate-400">(opcional)</span></label>
                <div className="relative">
                  <input id="managed-user-password" type={showActionPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" placeholder="Deje vacío para conservar la actual" value={actionForm.password} onChange={(event) => setActionForm(current => ({ ...current, password: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
                  <button type="button" onClick={() => setShowActionPassword(current => !current)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700" aria-label={showActionPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {showActionPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Rol y permisos</h4>
              <label className="sr-only" htmlFor="managed-user-role">Rol asignado</label>
              <select id="managed-user-role" value={pendingRole ?? ''} onChange={(event) => setPendingRole(event.target.value as UserRole)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600">
                {roleOptions.map(({ role }) => <option key={role} value={role}>{role}</option>)}
              </select>
              <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                {roleOptions.find(({ role }) => role === pendingRole)?.description}
              </p>
            </section>

            {actionUser.mfaEnabled && <button type="button" onClick={() => { onResetUserMfa(actionUser.id); closeActionModal(); }} className="w-full flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100"><RotateCcw className="w-4 h-4" />Restablecer MFA</button>}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={closeActionModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg">Guardar cambios</button>
            </div>
          </form>
        )}
      </ModalWrapper>

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
          <span>Crear usuario</span>
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
                <th className="py-3 px-4">MFA</th>
                <th className="py-3 px-4">Última Actividad</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {pg.pageItems.map(user => (
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

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {user.mfaEnabled ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <ShieldOff className="w-3.5 h-3.5" />
                        Sin configurar
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                    {user.lastActive}
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap relative">
                    <button
                      type="button"
                      onClick={() => openActionModal(user)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                      aria-haspopup="dialog"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pg.page}
          pageSize={pg.pageSize}
          total={pg.total}
          onPageChange={pg.setPage}
          onPageSizeChange={pg.setPageSize}
        />
      </div>
    </div>
  );
};
