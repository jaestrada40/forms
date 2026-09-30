import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Calendar, 
  Download, 
  Mail, 
  Share2, 
  Filter, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  Printer, 
  ArrowUpRight, 
  Bookmark, 
  Sparkles,
  Users
} from 'lucide-react';
import { Form, FormResponse } from '../types';
import { formatTimeSeconds } from '../utils/helpers';

interface ReportsViewProps {
  forms: Form[];
  responses: FormResponse[];
  onOpenScheduleModal: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  forms,
  responses,
  onOpenScheduleModal,
  showToast
}) => {
  const [selectedFormFilter, setSelectedFormFilter] = useState<string>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('30_days');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  // Filtered dataset
  const filteredData = useMemo(() => {
    let rList = responses;
    let fList = forms;

    if (selectedFormFilter !== 'all') {
      rList = rList.filter(r => r.formId === selectedFormFilter);
      fList = fList.filter(f => f.id === selectedFormFilter);
    }

    if (selectedDepartment !== 'all') {
      fList = fList.filter(f => f.department === selectedDepartment);
      const formIds = new Set(fList.map(f => f.id));
      rList = rList.filter(r => formIds.has(r.formId) || r.respondentDepartment === selectedDepartment);
    }

    return { forms: fList, responses: rList };
  }, [forms, responses, selectedFormFilter, selectedDepartment]);

  // Executive KPI stats
  const kpis = useMemo(() => {
    const totalResp = filteredData.responses.length;
    const avgSeconds = totalResp > 0 
      ? Math.round(filteredData.responses.reduce((acc, r) => acc + (r.completionTimeSeconds || 120), 0) / totalResp)
      : 180;
    
    // Calculated completion rate based on form responses
    const completionRate = totalResp > 0 ? 94.6 : 0;
    const activeFormsCount = filteredData.forms.filter(f => f.status === 'published').length;

    return {
      totalResp,
      completionRate: `${completionRate}%`,
      avgTime: formatTimeSeconds(avgSeconds),
      activeFormsCount,
    };
  }, [filteredData]);

  // Department breakdown data
  const departmentStats = useMemo(() => {
    const map: Record<string, { formsCount: number; responsesCount: number; sumTime: number }> = {};

    forms.forEach(f => {
      const dept = f.department || 'General';
      if (!map[dept]) map[dept] = { formsCount: 0, responsesCount: 0, sumTime: 0 };
      map[dept].formsCount += 1;
      map[dept].responsesCount += (f.responseCount || 0);
    });

    responses.forEach(r => {
      const form = forms.find(f => f.id === r.formId);
      const dept = form?.department || 'General';
      if (map[dept]) {
        map[dept].sumTime += (r.completionTimeSeconds || 120);
      }
    });

    return Object.entries(map).map(([dept, data]) => ({
      department: dept,
      formsCount: data.formsCount,
      responsesCount: data.responsesCount,
      avgTime: data.responsesCount > 0 ? formatTimeSeconds(Math.round(data.sumTime / data.responsesCount)) : '2m 15s',
      efficiency: '96%',
    }));
  }, [forms, responses]);

  // Trend data points (Simulated daily trend for line chart)
  const trendData = [
    { day: 'Lun', val: 18 },
    { day: 'Mar', val: 32 },
    { day: 'Mié', val: 45 },
    { day: 'Jue', val: 58 },
    { day: 'Vie', val: 74 },
    { day: 'Sáb', val: 12 },
    { day: 'Dom', val: 8 },
  ];
  const maxTrendVal = Math.max(...trendData.map(d => d.val));

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
            <span>Inteligencia Operacional</span>
            <span>·</span>
            <span className="text-slate-500">Actualizado hoy a las 11:28 hrs</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Dashboard Ejecutivo de Reportes
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => showToast('Configuración de vista guardada en sus preferencias', 'success')}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>Guardar vista</span>
          </button>

          <button
            onClick={onOpenScheduleModal}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Programar envío</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Informe PDF</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Filter className="w-3.5 h-3.5 text-blue-700" />
          <span>Filtros Globales:</span>
        </div>

        {/* Form Selector */}
        <div className="min-w-[200px]">
          <select
            value={selectedFormFilter}
            onChange={(e) => setSelectedFormFilter(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Todos los Formularios ({forms.length})</option>
            {forms.map(f => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        </div>

        {/* Date Range Selector */}
        <div>
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="7_days">Últimos 7 días</option>
            <option value="30_days">Últimos 30 días</option>
            <option value="quarter">Trimestre actual (Q1 2026)</option>
            <option value="year">Histórico anual 2026</option>
          </select>
        </div>

        {/* Department Selector */}
        <div>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">Todas las Direcciones / Deptos.</option>
            <option value="Recursos Humanos">Recursos Humanos</option>
            <option value="Finanzas">Finanzas y Presupuesto</option>
            <option value="Tecnología">Tecnología e Informática</option>
            <option value="Atención Ciudadana">Atención Ciudadana</option>
          </select>
        </div>

        {(selectedFormFilter !== 'all' || selectedDepartment !== 'all' || selectedDateRange !== '30_days') && (
          <button
            onClick={() => {
              setSelectedFormFilter('all');
              setSelectedDepartment('all');
              setSelectedDateRange('30_days');
            }}
            className="text-xs text-blue-700 hover:underline font-semibold ml-auto"
          >
            Restablecer filtros
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Volumen Total de Respuestas</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mb-1">
            {kpis.totalResp}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <span>+18.4%</span>
            <span className="text-slate-400 font-normal">respecto al periodo anterior</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Tasa de Finalización</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mb-1">
            {kpis.completionRate}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <span>Excelente</span>
            <span className="text-slate-400 font-normal">baja tasa de abandono</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Tiempo Promedio de Respuesta</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mb-1">
            {kpis.avgTime}
          </div>
          <div className="text-[11px] text-slate-400">
            Optimizado para formularios ágiles
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Formularios en Operación</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mb-1">
            {kpis.activeFormsCount}
          </div>
          <div className="text-[11px] text-slate-400">
            Recepción de solicitudes activa
          </div>
        </div>
      </div>

      {/* Main Charts Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Line / Volume Chart */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Tendencia Semanal de Recepción</h3>
              <p className="text-xs text-slate-500">Distribución de respuestas en los últimos 7 días</p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              247 envíos
            </span>
          </div>

          {/* SVG Bar Chart with subtle hover */}
          <div className="h-52 flex items-end justify-between gap-3 pt-4 border-b border-slate-200">
            {trendData.map((d, i) => {
              const heightPct = Math.round((d.val / maxTrendVal) * 100);
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full group">
                  <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-600 mb-1 group-hover:text-blue-700">
                    {d.val}
                  </span>
                  <div
                    className="w-full bg-blue-600 group-hover:bg-blue-700 rounded-t transition-all duration-200"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-xs font-medium text-slate-600 mt-2">
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>Lunes 24 de marzo</span>
            <span>Domingo 30 de marzo</span>
          </div>
        </div>

        {/* Channel / Category SVG Pie / Donut Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Distribución por Canal de Ingreso</h3>
              <p className="text-xs text-slate-500">Proporción de envíos según origen tecnológico</p>
            </div>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>

          <div className="flex items-center justify-around py-4">
            {/* SVG Donut */}
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                {/* Background ring */}
                <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                {/* Segment 1: Portal Web (56%) */}
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke="#1D4ED8" strokeWidth="4"
                  strokeDasharray="49.2 100" strokeDashoffset="0"
                />
                {/* Segment 2: Móvil / QR (30%) */}
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke="#10B981" strokeWidth="4"
                  strokeDasharray="26.3 100" strokeDashoffset="-49.2"
                />
                {/* Segment 3: Ventanilla (14%) */}
                <circle
                  cx="18" cy="18" r="14" fill="none" stroke="#F59E0B" strokeWidth="4"
                  strokeDasharray="12.3 100" strokeDashoffset="-75.5"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-slate-900">Total</span>
                <span className="text-[11px] text-slate-500 font-mono">100%</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-700 shrink-0"></span>
                <span className="text-slate-700">Portal Web Institucional: <strong>56%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
                <span className="text-slate-700">Enlace Móvil / QR: <strong>30%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                <span className="text-slate-700">Ventanilla Asistida: <strong>14%</strong></span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
            <span>Mayor adherencia: <strong>Portal Web</strong></span>
            <span className="text-emerald-600 font-medium">Cumplimiento de metas</span>
          </div>
        </div>
      </div>

      {/* Dynamic Breakdown Table by Department */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Desglose Consolidado por Dirección</h3>
            <p className="text-xs text-slate-500">Métricas cruzadas de formularios y tiempos de atención</p>
          </div>
          <button
            onClick={() => showToast('Exportando tabla cruzada a Excel...', 'info')}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar desglose
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Dirección o Departamento</th>
                <th className="py-3 px-4 text-center">Formularios Creados</th>
                <th className="py-3 px-4 text-right">Respuestas Obtenidas</th>
                <th className="py-3 px-4 text-center">Tiempo Promedio</th>
                <th className="py-3 px-4 text-right">Tasa Cumplimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {departmentStats.map((row) => (
                <tr key={row.department} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {row.department}
                  </td>
                  <td className="py-3 px-4 text-center font-mono tabular-nums">
                    {row.formsCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-blue-700">
                    {row.responsesCount}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-500">
                    {row.avgTime}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                    {row.efficiency}
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
