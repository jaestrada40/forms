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
  Check
} from 'lucide-react';
import { Template, Form } from '../types';
import { TEMPLATES_CATALOG } from '../data/mockData';

interface TemplatesViewProps {
  onUseTemplate: (template: Template) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const CATEGORIES = [
  'Todas',
  'Encuestas',
  'Solicitudes',
  'Recursos Humanos',
  'Eventos',
  'Evaluaciones',
  'Registro',
] as const;

export const TemplatesView: React.FC<TemplatesViewProps> = ({
  onUseTemplate,
  showToast
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    return TEMPLATES_CATALOG.filter(t => {
      const matchesCat = selectedCategory === 'Todas' || t.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

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
            Modelos preconfigurados con preguntas normativas y flujo validado para el sector público.
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
        {CATEGORIES.map(cat => (
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
        {filteredTemplates.map(tpl => {
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
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {tpl.category}
                  </span>
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
                  <span>{tpl.department}</span>
                  <span className="font-mono tabular-nums">{tpl.fieldsCount} preguntas</span>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
