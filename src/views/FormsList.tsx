import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Archive, 
  MoreVertical, 
  ExternalLink, 
  Copy, 
  Trash2, 
  Edit3, 
  Inbox, 
  Filter, 
  ArrowUpDown, 
  Share2, 
  LayoutGrid, 
  List, 
  Eye, 
  TrendingUp,
  FileCheck2,
  Calendar,
  UserCheck
} from 'lucide-react';
import { Form, FormStatus } from '../types';
import { Pagination, usePagination } from '../components/Pagination';
import { isQuestionField, formatDateSpanish } from '../utils/helpers';

interface FormsListProps {
  forms: Form[];
  onOpenNewFormModal: () => void;
  onEditForm: (formId: string) => void;
  onViewResponses: (formId: string) => void;
  onShowPublicView: (formId: string) => void;
  onOpenShareModal: (form: Form) => void;
  onOpenPublishModal: (form: Form) => void;
  onOpenDeleteModal: (form: Form) => void;
  onOpenDuplicateModal: (form: Form) => void;
  searchQuery: string;
}

export const FormsList: React.FC<FormsListProps> = ({
  forms,
  onOpenNewFormModal,
  onEditForm,
  onViewResponses,
  onShowPublicView,
  onOpenShareModal,
  onOpenPublishModal,
  onOpenDeleteModal,
  onOpenDuplicateModal,
  searchQuery
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [statusFilter, setStatusFilter] = useState<'all' | FormStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  const openDropdown = (formId: string, anchor: HTMLElement) => {
    if (activeDropdownId === formId) {
      setActiveDropdownId(null);
      setDropdownPosition(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const MENU_WIDTH = 176;
    setDropdownPosition({
      top: rect.bottom + 4,
      left: Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
    });
    setActiveDropdownId(formId);
  };

  const closeDropdown = () => {
    setActiveDropdownId(null);
    setDropdownPosition(null);
  };

  // Compute metrics
  const metrics = useMemo(() => {
    const activeCount = forms.filter(f => f.status === 'published').length;
    const totalResponses = forms.reduce((acc, f) => acc + (f.responseCount || 0), 0);
    const closedCount = forms.filter(f => f.status === 'closed').length;
    const draftsCount = forms.filter(f => f.status === 'draft').length;
    return { activeCount, totalResponses, closedCount, draftsCount };
  }, [forms]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set<string>();
    forms.forEach(f => {
      if (f.department) depts.add(f.department);
    });
    return Array.from(depts);
  }, [forms]);

  // Filtered forms
  const filteredForms = useMemo(() => {
    return forms.filter(f => {
      const matchesSearch = 
        !searchQuery ||
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.department.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
      const matchesDept = departmentFilter === 'all' || f.department === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [forms, searchQuery, statusFilter, departmentFilter]);
  const pg = usePagination(filteredForms, `${searchQuery}|${statusFilter}|${departmentFilter}`);

  const getStatusBadge = (status: FormStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Publicado
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Borrador
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Cerrado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Stat Cards */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Mis Formularios</h2>
            <p className="text-xs text-slate-500">
              Administre la publicación, captura de datos y ciclo de vida de los formularios institucionales.
            </p>
          </div>
          <button
            onClick={onOpenNewFormModal}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>Crear formulario</span>
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Formularios Activos</span>
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.activeCount}
              </span>
              <span className="text-[11px] text-emerald-600 font-medium">En recepción</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Respuestas Totales</span>
              <Inbox className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.totalResponses}
              </span>
              <span className="text-[11px] text-blue-600 font-medium">+24 hoy</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Borradores en Edición</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.draftsCount}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Por publicar</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Formularios Cerrados</span>
              <Archive className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {metrics.closedCount}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Históricos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control bar: Filters & View Switcher */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Filters - interactive segmented control */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos ({forms.length})
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'published'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Publicados ({metrics.activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'draft'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Borradores ({metrics.draftsCount})
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'closed'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cerrados ({metrics.closedCount})
          </button>
        </div>

        {/* Right side: Department filter & View layout toggle */}
        <div className="flex items-center gap-2">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-2.5 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Todas las unidades</option>
            {departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en tabla"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Forms Content Area */}
      {filteredForms.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No se encontraron formularios
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            {searchQuery || statusFilter !== 'all' || departmentFilter !== 'all'
              ? 'No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.'
              : 'Aún no ha creado formularios digitales en su cuenta institucional. ¡Comience creando el primero!'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {(searchQuery || statusFilter !== 'all' || departmentFilter !== 'all') && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setDepartmentFilter('all');
                }}
                className="px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200"
              >
                Limpiar filtros
              </button>
            )}
            <button
              onClick={onOpenNewFormModal}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Crear nuevo formulario</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Formulario</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-center">Preguntas</th>
                  <th className="py-3 px-4 text-right">Respuestas</th>
                  <th className="py-3 px-4">Última Actualización</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pg.pageItems.map((form) => (
                  <tr 
                    key={form.id} 
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => onEditForm(form.id)}
                  >
                    {/* Form title & department */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-700 mt-0.5 shrink-0 group-hover:bg-blue-100 transition-colors">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-sm line-clamp-1">
                            {form.title}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span>{form.department}</span>
                            <span aria-hidden="true">·</span>
                            <span>{form.creator.name}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(form.status)}
                    </td>

                    {/* Field count */}
                    <td className="py-3.5 px-4 text-center tabular-nums text-slate-600 font-mono">
                      {form.fields.filter(isQuestionField).length}
                    </td>

                    {/* Responses */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewResponses(form.id);
                        }}
                        className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                        title="Ver respuestas"
                      >
                        <Inbox className="w-3.5 h-3.5" />
                        {form.responseCount}
                      </button>
                    </td>

                    {/* Updated at */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                      {formatDateSpanish(form.updatedAt)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditForm(form.id)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Editar en constructor"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onViewResponses(form.id)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Ver respuestas y reportes"
                        >
                          <Inbox className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onShowPublicView(form.id)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Abrir vista pública de respuesta"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => openDropdown(form.id, e.currentTarget)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeDropdownId === form.id && dropdownPosition && createPortal(
                            <>
                              <div className="fixed inset-0 z-40" onClick={closeDropdown} />
                              <div
                                className="fixed w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-1 text-left"
                                style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                              >
                                <button
                                  onClick={() => {
                                    closeDropdown();
                                    onOpenShareModal(form);
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                                >
                                  <Share2 className="w-3.5 h-3.5 text-blue-600" />
                                  Compartir enlace
                                </button>
                                <button
                                  onClick={() => {
                                    closeDropdown();
                                    onOpenPublishModal(form);
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                                >
                                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                                  Cambiar estado
                                </button>
                                <button
                                  onClick={() => {
                                    closeDropdown();
                                    onOpenDuplicateModal(form);
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  Duplicar
                                </button>
                                <div className="border-t border-slate-100 my-1"></div>
                                <button
                                  onClick={() => {
                                    closeDropdown();
                                    onOpenDeleteModal(form);
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Eliminar formulario
                                </button>
                              </div>
                            </>,
                            document.body
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid / Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pg.pageItems.map((form) => (
            <div
              key={form.id}
              onClick={() => onEditForm(form.id)}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    {form.department}
                  </span>
                  {getStatusBadge(form.status)}
                </div>

                <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-base line-clamp-2 mb-1.5">
                  {form.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                  {form.description}
                </p>
              </div>

              <div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 mb-3">
                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                    <Inbox className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-semibold text-slate-900">{form.responseCount}</span> respuestas
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {formatDateSpanish(form.updatedAt)}
                  </div>
                </div>

                <div 
                  className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onViewResponses(form.id)}
                    className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1"
                  >
                    Ver respuestas →
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onShowPublicView(form.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-700 rounded-md"
                      title="Vista pública"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenShareModal(form)}
                      className="p-1.5 text-slate-400 hover:text-blue-700 rounded-md"
                      title="Compartir"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onOpenDeleteModal(form)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredForms.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs">
          <Pagination
            page={pg.page}
            pageSize={pg.pageSize}
            total={pg.total}
            onPageChange={pg.setPage}
            onPageSizeChange={pg.setPageSize}
            className="border-t-0"
          />
        </div>
      )}
    </div>
  );
};
