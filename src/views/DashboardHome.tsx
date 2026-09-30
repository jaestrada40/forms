import React from 'react';
import { 
  Plus, 
  LayoutTemplate, 
  BarChart3, 
  Inbox, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ExternalLink, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { Form, FormResponse, ActiveScreen } from '../types';
import { formatDateSpanish } from '../utils/helpers';

interface DashboardHomeProps {
  forms: Form[];
  responses: FormResponse[];
  onNavigate: (screen: ActiveScreen) => void;
  onOpenNewFormModal: () => void;
  onSelectFormForBuilder: (formId: string) => void;
  onViewResponses: (formId: string) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  forms,
  responses,
  onNavigate,
  onOpenNewFormModal,
  onSelectFormForBuilder,
  onViewResponses
}) => {
  const publishedForms = forms.filter(f => f.status === 'published');
  const recentResponses = responses.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-xs mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
            <span>Sistema Institucional de Formularios Digitales</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Bienvenido al Centro de Gestión
          </h2>

          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed mb-6 opacity-90">
            Diseñe formularios normativos, gestione la captura de información ciudadana y administrativa en tiempo real y consulte analíticas ejecutivas de desempeño institucional.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenNewFormModal}
              className="px-4 py-2.5 bg-white text-blue-900 hover:bg-blue-50 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-98"
            >
              <Plus className="w-4 h-4 text-blue-700" />
              <span>Crear nuevo formulario</span>
            </button>

            <button
              onClick={() => onNavigate('templates')}
              className="px-4 py-2.5 bg-blue-800/80 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors border border-blue-700"
            >
              <LayoutTemplate className="w-4 h-4" />
              <span>Explorar catálogo de plantillas</span>
            </button>
          </div>
        </div>

        {/* Decorative background watermark seal */}
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
          <ShieldCheck className="w-72 h-72 text-white" />
        </div>
      </div>

      {/* Fast Shortcuts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('forms')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">Mis Formularios</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Consulte el estado de los {forms.length} formularios registrados y sus ciclos de publicación.
            </p>
          </div>
          <span className="text-xs font-semibold text-blue-700 flex items-center gap-1 mt-4">
            Ir a formularios →
          </span>
        </div>

        <div
          onClick={() => onNavigate('responses')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Inbox className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">Recepción de Respuestas</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Examine {responses.length} respuestas recibidas, folios correlativos y exportaciones Excel/CSV.
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mt-4">
            Ver respuestas →
          </span>
        </div>

        <div
          onClick={() => onNavigate('reports')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">Reportes y Analíticas</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Dashboard gerencial con tasas de cumplimiento, tiempos de respuesta e histogramas.
            </p>
          </div>
          <span className="text-xs font-semibold text-indigo-700 flex items-center gap-1 mt-4">
            Ver dashboard analítico →
          </span>
        </div>
      </div>

      {/* Active Forms & Recent Activity Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Forms Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Formularios en Operación Activa</h3>
                <p className="text-xs text-slate-500">Recibiendo respuestas en este momento</p>
              </div>
              <button
                onClick={() => onNavigate('forms')}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Ver todos
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {publishedForms.slice(0, 4).map(form => (
                <div
                  key={form.id}
                  onClick={() => onSelectFormForBuilder(form.id)}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-semibold text-xs text-slate-900 truncate">{form.title}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{form.department}</span>
                      <span>·</span>
                      <span className="font-mono tabular-nums">{form.responseCount} respuestas</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewResponses(form.id);
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors shrink-0"
                  >
                    Respuestas
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Responses List */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Últimos Folios Registrados</h3>
                <p className="text-xs text-slate-500">Envíos validados por funcionarios y usuarios</p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-500">
                {responses.length} total
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {recentResponses.map(r => (
                <div key={r.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono font-bold text-slate-900">{r.folio}</div>
                    <div className="text-[11px] text-slate-500">{r.respondentName || r.respondentEmail}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">{formatDateSpanish(r.submittedAt, false)}</div>
                    <div className="text-[11px] font-semibold text-emerald-600">Recepción conforme</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
