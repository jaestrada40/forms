import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  BarChart2, 
  User, 
  Table, 
  ToggleLeft, 
  ToggleRight, 
  Inbox, 
  Clock, 
  Calendar, 
  ArrowUpDown, 
  Check, 
  Sliders, 
  MessageSquare 
} from 'lucide-react';
import { Form, FormResponse } from '../types';
import { formatDateSpanish, formatTimeSeconds, exportResponsesToCSV, exportResponsesToExcel } from '../utils/helpers';

interface ResponsesViewProps {
  forms: Form[];
  selectedFormId: string;
  onSelectForm: (formId: string) => void;
  responses: FormResponse[];
  onToggleAcceptingResponses: (formId: string, currentStatus: string) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const ResponsesView: React.FC<ResponsesViewProps> = ({
  forms,
  selectedFormId,
  onSelectForm,
  responses,
  onToggleAcceptingResponses,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'table' | 'individual'>('summary');
  const [individualIndex, setIndividualIndex] = useState(0);
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [sortField, setSortField] = useState<'folio' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const currentForm = forms.find(f => f.id === selectedFormId) || forms[0];

  // Filter responses belonging to current form
  const formResponses = useMemo(() => {
    return responses.filter(r => r.formId === currentForm.id);
  }, [responses, currentForm]);

  const isAccepting = currentForm.status === 'published';

  // Table filtering and sorting
  const filteredResponses = useMemo(() => {
    return formResponses
      .filter(r => {
        if (!searchTableQuery) return true;
        const q = searchTableQuery.toLowerCase();
        return (
          r.folio.toLowerCase().includes(q) ||
          (r.respondentEmail && r.respondentEmail.toLowerCase().includes(q)) ||
          (r.respondentName && r.respondentName.toLowerCase().includes(q)) ||
          (r.respondentDepartment && r.respondentDepartment.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortField === 'folio') {
          return sortDirection === 'asc' 
            ? a.folio.localeCompare(b.folio) 
            : b.folio.localeCompare(a.folio);
        }
        return sortDirection === 'asc'
          ? new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
          : new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });
  }, [formResponses, searchTableQuery, sortField, sortDirection]);

  const currentIndividual = formResponses[individualIndex] || null;

  // Compute analytics for questions
  const questionsAnalytics = useMemo(() => {
    if (!currentForm) return [];

    return currentForm.fields
      .filter(f => f.type !== 'section')
      .map(field => {
        // Collect all answers
        const rawAnswers = formResponses.map(r => r.answers[field.id]).filter(v => v !== undefined && v !== null && v !== '');

        if (field.type === 'single_choice' || field.type === 'dropdown') {
          const counts: Record<string, number> = {};
          (field.options || []).forEach(opt => counts[opt] = 0);
          rawAnswers.forEach(ans => {
            const strAns = String(ans);
            counts[strAns] = (counts[strAns] || 0) + 1;
          });
          const totalAnswered = rawAnswers.length;
          return {
            field,
            type: 'choice',
            totalAnswered,
            data: Object.entries(counts).map(([label, count]) => ({
              label,
              count,
              percent: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0,
            })),
          };
        }

        if (field.type === 'linear_scale') {
          const min = field.scaleMin || 1;
          const max = field.scaleMax || 5;
          const scoreCounts: Record<number, number> = {};
          for (let i = min; i <= max; i++) scoreCounts[i] = 0;
          let sum = 0;

          rawAnswers.forEach(ans => {
            const num = Number(ans);
            if (!isNaN(num)) {
              scoreCounts[num] = (scoreCounts[num] || 0) + 1;
              sum += num;
            }
          });

          const totalAnswered = rawAnswers.length;
          const average = totalAnswered > 0 ? (sum / totalAnswered).toFixed(2) : '0';

          return {
            field,
            type: 'scale',
            totalAnswered,
            average,
            data: Object.entries(scoreCounts).map(([score, count]) => ({
              score: Number(score),
              count,
              percent: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0,
            })),
          };
        }

        if (field.type === 'multiple_choice') {
          const counts: Record<string, number> = {};
          (field.options || []).forEach(opt => counts[opt] = 0);
          rawAnswers.forEach(ans => {
            if (Array.isArray(ans)) {
              ans.forEach(item => {
                counts[item] = (counts[item] || 0) + 1;
              });
            }
          });
          const totalMentions = Object.values(counts).reduce((a, b) => a + b, 0);
          return {
            field,
            type: 'choice',
            totalAnswered: rawAnswers.length,
            data: Object.entries(counts).map(([label, count]) => ({
              label,
              count,
              percent: totalMentions > 0 ? Math.round((count / totalMentions) * 100) : 0,
            })),
          };
        }

        // Textual or other answers
        return {
          field,
          type: 'text',
          totalAnswered: rawAnswers.length,
          samples: rawAnswers.slice(0, 5),
        };
      });
  }, [currentForm, formResponses]);

  const handleExportCSV = () => {
    exportResponsesToCSV(currentForm, formResponses);
    showToast('Archivo CSV descargado con éxito', 'success');
  };

  const handleExportExcel = () => {
    exportResponsesToExcel(currentForm, formResponses);
    showToast('Planilla Excel descargada con éxito', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>Panel de Respuestas</span>
              <span>·</span>
              <span className="text-blue-700">{currentForm.department}</span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={currentForm.id}
                onChange={(e) => {
                  onSelectForm(e.target.value);
                  setIndividualIndex(0);
                }}
                className="font-bold text-base sm:text-lg text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              >
                {forms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.title} ({responses.filter(r => r.formId === f.id).length} respuestas)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-emerald-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-blue-200"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Generar PDF</span>
            </button>
          </div>
        </div>

        {/* Status Bar & Acceptance Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {formResponses.length}
              </span>
              <span className="text-xs text-slate-500">respuestas totales registradas</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-700">
              {isAccepting ? 'Aceptando respuestas' : 'Respuestas cerradas'}
            </span>
            <button
              onClick={() => {
                onToggleAcceptingResponses(currentForm.id, currentForm.status);
                showToast(
                  isAccepting ? 'Formulario cerrado para nuevas respuestas' : 'Formulario abierto para recibir respuestas',
                  'info'
                );
              }}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                isAccepting ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
              title="Alternar recepción de respuestas"
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Switcher: Resumen / Individuales / Tabla */}
      <div className="flex border-b border-slate-200 text-sm">
        <button
          onClick={() => setActiveTab('summary')}
          className={`pb-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Resumen Gráfico</span>
        </button>

        <button
          onClick={() => setActiveTab('table')}
          className={`pb-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'table'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Tabla de Respuestas ({formResponses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('individual')}
          className={`pb-3 px-4 font-semibold text-xs flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'individual'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Individuales</span>
        </button>
      </div>

      {/* Content based on tab */}
      {formResponses.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">Aún no hay respuestas</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Comparta el enlace del formulario o complete una prueba desde la vista pública para generar reportes analíticos.
          </p>
        </div>
      ) : activeTab === 'summary' ? (
        /* SUMMARY TAB WITH HIGH-FIDELITY CLEAN CHARTS */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionsAnalytics.map((qa, index) => {
              const field = qa.field;

              return (
                <div key={field.id} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-sm text-slate-900 leading-snug">
                      {field.title}
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums shrink-0">
                      {qa.totalAnswered} respuestas
                    </span>
                  </div>

                  {/* Choice breakdown bars */}
                  {qa.type === 'choice' && qa.data && (
                    <div className="space-y-3 pt-2">
                      {(qa.data as { label: string; count: number; percent: number }[]).map((item, idx) => (
                        <div key={idx}>
                          <div className="flex items-center justify-between text-xs text-slate-700 mb-1">
                            <span className="truncate max-w-[200px]">{item.label}</span>
                            <span className="font-mono tabular-nums font-semibold text-slate-900">
                              {item.count} ({item.percent}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Linear scale average and histogram */}
                  {qa.type === 'scale' && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between p-3 bg-blue-50/60 border border-blue-100 rounded-lg mb-4">
                        <span className="text-xs text-blue-900 font-medium">Promedio ponderado</span>
                        <span className="text-xl font-bold font-mono text-blue-700 tabular-nums">
                          {qa.average} / {field.scaleMax || 5}
                        </span>
                      </div>

                      <div className="flex items-end justify-between gap-2 h-28 pt-4 border-b border-slate-200">
                        {(qa.data || []).map((col: any) => (
                          <div key={col.score} className="flex-1 flex flex-col items-center justify-end h-full">
                            <span className="text-[10px] font-mono tabular-nums text-slate-500 mb-1">
                              {col.count}
                            </span>
                            <div
                              className="w-full bg-blue-600 rounded-t transition-all duration-300 min-h-[4px]"
                              style={{ height: `${Math.max(4, col.percent)}%` }}
                            />
                            <span className="text-xs font-semibold text-slate-700 mt-2">
                              {col.score}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                        <span>{field.scaleMinLabel || 'Bajo'}</span>
                        <span>{field.scaleMaxLabel || 'Alto'}</span>
                      </div>
                    </div>
                  )}

                  {/* Text samples */}
                  {qa.type === 'text' && (
                    <div className="space-y-2 pt-2">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Últimas respuestas recibidas
                      </div>
                      {(qa.samples || []).map((sample: any, sIdx: number) => (
                        <div key={sIdx} className="p-2.5 bg-slate-50 rounded-lg text-xs text-slate-700 italic border border-slate-100">
                          "{String(sample)}"
                        </div>
                      ))}
                      {(qa.samples || []).length === 0 && (
                        <p className="text-xs text-slate-400">Sin comentarios ingresados.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Table Search & Controls */}
          <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por folio, correo o funcionario..."
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Ordenar por:</span>
              <button
                onClick={() => {
                  if (sortField === 'date') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('date');
                    setSortDirection('desc');
                  }
                }}
                className={`px-2.5 py-1 rounded-md font-medium border flex items-center gap-1 ${
                  sortField === 'date' ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold' : 'border-slate-200'
                }`}
              >
                Fecha <ArrowUpDown className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  if (sortField === 'folio') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('folio');
                    setSortDirection('asc');
                  }
                }}
                className={`px-2.5 py-1 rounded-md font-medium border flex items-center gap-1 ${
                  sortField === 'folio' ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold' : 'border-slate-200'
                }`}
              >
                Folio <ArrowUpDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Tiempo</th>
                  <th className="py-3 px-4">Remitente</th>
                  {currentForm.fields.filter(f => f.type !== 'section').slice(0, 3).map(f => (
                    <th key={f.id} className="py-3 px-4 truncate max-w-[200px]">{f.title}</th>
                  ))}
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredResponses.map((r, index) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {r.folio}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {formatDateSpanish(r.submittedAt, true)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                      {formatTimeSeconds(r.completionTimeSeconds)}
                    </td>
                    <td className="py-3 px-4 truncate max-w-[180px]">
                      <div className="font-medium text-slate-800">{r.respondentName || 'Anónimo'}</div>
                      <div className="text-[11px] text-slate-400 truncate">{r.respondentEmail}</div>
                    </td>
                    {currentForm.fields.filter(f => f.type !== 'section').slice(0, 3).map(f => {
                      const val = r.answers[f.id];
                      return (
                        <td key={f.id} className="py-3 px-4 truncate max-w-[200px] text-slate-600">
                          {val === undefined || val === null ? '-' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          const idx = formResponses.findIndex(item => item.id === r.id);
                          if (idx !== -1) setIndividualIndex(idx);
                          setActiveTab('individual');
                        }}
                        className="text-blue-700 hover:text-blue-900 font-semibold"
                      >
                        Ver ficha →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* INDIVIDUAL INSPECTOR VIEW */
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Navigator Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIndividualIndex(Math.max(0, individualIndex - 1))}
                disabled={individualIndex === 0}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-600 font-medium">
                Respuesta <span className="font-bold text-slate-900 font-mono">{individualIndex + 1}</span> de <span className="font-mono">{formResponses.length}</span>
              </span>
              <button
                onClick={() => setIndividualIndex(Math.min(formResponses.length - 1, individualIndex + 1))}
                disabled={individualIndex === formResponses.length - 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ficha Individual</span>
            </button>
          </div>

          {currentIndividual ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              {/* Receipt Header */}
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-blue-700">{currentForm.department}</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {currentIndividual.folio}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">{currentForm.title}</h3>
                <div className="text-xs text-slate-500 flex flex-wrap gap-4 mt-2">
                  <span>Enviado: <strong className="text-slate-700">{formatDateSpanish(currentIndividual.submittedAt, true)}</strong></span>
                  <span>Tiempo de llenado: <strong className="text-slate-700 font-mono">{formatTimeSeconds(currentIndividual.completionTimeSeconds)}</strong></span>
                  {currentIndividual.respondentEmail && (
                    <span>Correo: <strong className="text-slate-700">{currentIndividual.respondentEmail}</strong></span>
                  )}
                </div>
              </div>

              {/* Answers Breakdown */}
              <div className="space-y-5">
                {currentForm.fields.filter(f => f.type !== 'section').map(field => {
                  const answer = currentIndividual.answers[field.id];

                  return (
                    <div key={field.id} className="pt-2">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        {field.title}
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-900 border border-slate-100 font-medium">
                        {answer === undefined || answer === null || answer === '' ? (
                          <span className="text-slate-400 italic font-normal">Sin respuesta</span>
                        ) : Array.isArray(answer) ? (
                          <ul className="list-disc list-inside space-y-1">
                            {answer.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : typeof answer === 'object' ? (
                          <div className="space-y-1 text-xs">
                            {Object.entries(answer).map(([k, v]) => (
                              <div key={k} className="flex justify-between border-b border-slate-200 py-1">
                                <span className="text-slate-600">{k}:</span>
                                <span className="font-bold text-slate-900">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          String(answer)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
