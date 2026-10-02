import React, { useState, useMemo } from 'react';
import { 
  LayoutTemplate, 
  Users, 
  ShoppingCart, 
  Award, 
  MessageSquareHeart, 
  Calendar, 
  ShieldAlert, 
  Plus, 
  ArrowRight, 
  Sparkles, 
  Search,
  Check,
  Pencil,
  Trash2
} from 'lucide-react';
import { Template, Form } from '../types';
import { Pagination, usePagination } from '../components/Pagination';
import { isQuestionField } from '../utils/helpers';
import { TEMPLATES_CATALOG } from '../data/mockData';

interface TemplatesViewProps {
  onUseTemplate: (template: Template) => void;
  /** Templates saved by users (shared with everyone) */
  customTemplates: Template[];
  currentUser: { id: string; role: string } | null;
  onEditTemplate: (template: Template) => void;
  onDeleteTemplate: (template: Template) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const BASE_CATEGORIES = ['Encuestas', 'Solicitudes', 'Recursos Humanos', 'Eventos', 'Evaluaciones', 'Registro'];

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  onUseTemplate,
  customTemplates,
  currentUser,
  onEditTemplate,
  onDeleteTemplate,
  showToast
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const allTemplates = useMemo(() => [...customTemplates, ...TEMPLATES_CATALOG], [customTemplates]);
  // Built-in categories first, then any category created along with a custom template
  const categories = useMemo(
    () => ['Todas', ...BASE_CATEGORIES, ...[...new Set(customTemplates.map(t => t.category))].filter(c => !BASE_CATEGORIES.includes(c)).sort()],
    [customTemplates],
  );
  const canManage = (t: Template) => !!t.custom && !!currentUser && (currentUser.role === 'Administrador' || t.createdById === currentUser.id);

  const filteredTemplates = useMemo(() => {
    return allTemplates.filter(t => {
      const matchesCat = selectedCategory === 'Todas' || t.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [allTemplates, selectedCategory, searchQuery]);
  const pg = usePagination(filteredTemplates, `${selectedCategory}|${searchQuery}`, 10);

  const getTemplateIcon = (name: string) => {
    switch (name) {
      case 'Users': return Users;
      case 'ShoppingCart': return ShoppingCart;
      case 'Award': return Award;
      case 'MessageSquareHeart': return MessageSquareHeart;
      case 'Calendar': return Calendar;
      case 'ShieldAlert': return ShieldAlert;
      default: return LayoutTemplate;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
            Biblioteca Institucional
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Galería de Plantillas Estandarizadas
          </h2>
          <p className="text-xs text-slate-500">
            Modelos preconfigurados y plantillas compartidas por su equipo. Guarde cualquier formulario como plantilla desde el constructor o desde su lista.
          </p>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar plantillas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800"
          />
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pg.pageItems.map(tpl => {
          const Icon = getTemplateIcon(tpl.iconName);

          return (
            <div
              key={tpl.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-2xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {tpl.custom && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md" title={`Creada por ${tpl.creatorName}`}>
                        Compartida
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {tpl.category}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors mb-1.5">
                  {tpl.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {tpl.description}
                </p>
              </div>

              <div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 mb-4">
                  <span className="truncate pr-2">{tpl.custom ? `Por ${tpl.creatorName}` : tpl.department}</span>
                  <span className="font-mono tabular-nums">
                    {(() => { const n = (tpl.form.fields || []).filter(isQuestionField).length; return `${n} ${n === 1 ? 'pregunta' : 'preguntas'}`; })()}
                  </span>
                </div>

                <button
                  onClick={() => {
                    onUseTemplate(tpl);
                    showToast(`Plantilla "${tpl.title}" cargada en el constructor`, 'success');
                  }}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  <span>Usar esta plantilla</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                {canManage(tpl) && (
                  confirmDeleteId === tpl.id ? (
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="text-rose-700 font-medium">¿Eliminar para todos?</span>
                      <span className="flex gap-1.5">
                        <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                        <button onClick={() => { setConfirmDeleteId(null); onDeleteTemplate(tpl); }} className="px-2 py-1 text-white bg-rose-600 hover:bg-rose-700 rounded font-semibold">Eliminar</button>
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-end gap-1 text-xs">
                      <button onClick={() => onEditTemplate(tpl)} className="px-2 py-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      <button onClick={() => setConfirmDeleteId(tpl.id)} className="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Eliminar
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredTemplates.length > 0 && (
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
