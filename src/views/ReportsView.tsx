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
import { Pagination, usePagination } from '../components/Pagination';
import { exportReportPDF } from '../utils/pdf';
import { formatTimeSeconds, formatDateSpanish, exportTableToCSV } from '../utils/helpers';

interface ReportsViewProps {
  forms: Form[];
  responses: FormResponse[];
  onOpenScheduleModal: () => void;
  institutionName: string;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  forms,
  responses,
  onOpenScheduleModal,
  institutionName,
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

    if (selectedDateRange !== 'all_time') {
      const days = selectedDateRange === '7_days' ? 7 : selectedDateRange === '30_days' ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      rList = rList.filter(r => new Date(r.submittedAt).getTime() >= cutoff);
    }

    return { forms: fList, responses: rList };
  }, [forms, responses, selectedFormFilter, selectedDepartment, selectedDateRange]);

  // Executive KPI stats — derived only from real submitted data (every stored response is, by
  // definition, a completed submission, so completion rate reflects forms that received at least one).
  const kpis = useMemo(() => {
    const totalResp = filteredData.responses.length;
    const avgSeconds = totalResp > 0
      ? Math.round(filteredData.responses.reduce((acc, r) => acc + (r.completionTimeSeconds || 0), 0) / totalResp)
      : 0;
    const formsWithResponses = new Set(filteredData.responses.map(r => r.formId)).size;
    const activeFormsCount = filteredData.forms.filter(f => f.status === 'published').length;
    const responseCoverage = activeFormsCount > 0 ? Math.round((formsWithResponses / activeFormsCount) * 100) : 0;

    return {
      totalResp,
      responseCoverage: `${responseCoverage}%`,
      avgTime: formatTimeSeconds(avgSeconds),
      activeFormsCount,
    };
  }, [filteredData]);

  // Department breakdown data — all real, computed from the filtered dataset.
  const departmentStats = useMemo(() => {
    const map: Record<string, { formsCount: number; responsesCount: number; sumTime: number }> = {};

    filteredData.forms.forEach(f => {
      const dept = f.department || 'General';
      if (!map[dept]) map[dept] = { formsCount: 0, responsesCount: 0, sumTime: 0 };
      map[dept].formsCount += 1;
    });

    filteredData.responses.forEach(r => {
      const form = filteredData.forms.find(f => f.id === r.formId);
      const dept = form?.department || r.respondentDepartment || 'General';
      if (!map[dept]) map[dept] = { formsCount: 0, responsesCount: 0, sumTime: 0 };
      map[dept].responsesCount += 1;
      map[dept].sumTime += (r.completionTimeSeconds || 0);
    });

    return Object.entries(map)
      .map(([dept, data]) => ({
        department: dept,
        formsCount: data.formsCount,
        responsesCount: data.responsesCount,
        avgTime: data.responsesCount > 0 ? formatTimeSeconds(Math.round(data.sumTime / data.responsesCount)) : '—',
      }))
      .sort((a, b) => b.responsesCount - a.responsesCount);
  }, [filteredData]);

  // Donut chart geometry for the department distribution (r=14 circle, circumference ≈ 87.96).
  const DONUT_PALETTE = ['#1D4ED8', '#10B981', '#F59E0B', '#6366F1', '#F43F5E', '#64748B'];
  const totalDeptResponses = departmentStats.reduce((acc, d) => acc + d.responsesCount, 0);
  const donutSegments = useMemo(() => {
    let cumulativePct = 0;
    return departmentStats
      .filter(d => d.responsesCount > 0)
      .slice(0, 6)
      .map((d, i) => {
        const pct = totalDeptResponses > 0 ? (d.responsesCount / totalDeptResponses) * 100 : 0;
        const segment = {
          department: d.department,
          pct,
          color: DONUT_PALETTE[i % DONUT_PALETTE.length],
          arcLength: (pct / 100) * 87.96,
          dashOffset: -(cumulativePct / 100) * 87.96,
        };
        cumulativePct += pct;
        return segment;
      });
  }, [departmentStats, totalDeptResponses]);

  const deptPg = usePagination(departmentStats, `${selectedFormFilter}|${selectedDateRange}|${selectedDepartment}`);

  const handleExportBreakdown = () => {
    if (departmentStats.length === 0) {
      showToast('No hay datos para exportar con los filtros actuales.', 'info');
      return;
    }
    exportTableToCSV(
      'desglose_por_direccion',
      ['Dirección o Departamento', 'Formularios Creados', 'Respuestas Obtenidas', 'Tiempo Promedio'],
      departmentStats.map(r => [r.department, r.formsCount, r.responsesCount, r.avgTime]),
    );
    showToast('Desglose exportado a CSV', 'success');
  };

  // Real weekly trend: count of responses submitted on each of the last 7 days.
  const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const trendData = useMemo(() => {
    const days: { day: string; date: string; val: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const count = filteredData.responses.filter(r => r.submittedAt?.slice(0, 10) === dateKey).length;
      days.push({ day: WEEKDAY_LABELS[d.getDay()], date: dateKey, val: count });
    }
    return days;
  }, [filteredData]);
  const totalTrendResponses = trendData.reduce((acc, d) => acc + d.val, 0);
  const maxTrendVal = Math.max(1, ...trendData.map(d => d.val));

  const handleExportPDF = () => {
    const rangeLabels: Record<string, string> = { '7_days': 'Últimos 7 días', '30_days': 'Últimos 30 días', '90_days': 'Últimos 90 días', all_time: 'Histórico completo' };
    exportReportPDF({
      institution: institutionName,
      filters: [
        `Formulario: ${selectedFormFilter === 'all' ? 'Todos' : forms.find(f => f.id === selectedFormFilter)?.title || '—'}`,
        `Período: ${rangeLabels[selectedDateRange] || selectedDateRange}`,
        `Departamento: ${selectedDepartment === 'all' ? 'Todos' : selectedDepartment}`,
      ],
      kpis: [
        { label: 'Respuestas', value: String(kpis.totalResp) },
        { label: 'Formularios con respuestas', value: kpis.responseCoverage },
        { label: 'Tiempo promedio', value: kpis.avgTime },
        { label: 'Formularios activos', value: String(kpis.activeFormsCount) },
      ],
      departments: departmentStats,
      trend: trendData,
    });
    showToast('PDF generado con éxito', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
            <span>Inteligencia Operacional</span>
            <span>·</span>
            <span className="text-slate-500">Actualizado al {new Date().toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Dashboard Ejecutivo de Reportes
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenScheduleModal}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Programar envío</span>
          </button>

          <button
            onClick={handleExportPDF}
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
            <option value="90_days">Últimos 90 días</option>
            <option value="all_time">Histórico completo</option>
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
            {Array.from(new Set(forms.map(f => f.department).filter(Boolean))).map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
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
          <div className="text-[11px] text-slate-400 font-normal">
            Respuestas dentro del período filtrado
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Cobertura de Formularios</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mb-1">
            {kpis.responseCoverage}
          </div>
          <div className="text-[11px] text-slate-400 font-normal">
            Formularios publicados con al menos una respuesta
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
              <p className="text-xs text-slate-500">Respuestas recibidas por día, últimos 7 días</p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {totalTrendResponses} envíos
            </span>
          </div>

          {/* SVG Bar Chart with subtle hover */}
          <div className="h-52 flex items-end justify-between gap-3 pt-4 border-b border-slate-200">
            {trendData.map((d) => {
              const heightPct = Math.round((d.val / maxTrendVal) * 100);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group">
                  <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-600 mb-1 group-hover:text-blue-700">
                    {d.val}
                  </span>
                  <div
                    className="w-full bg-blue-600 group-hover:bg-blue-700 rounded-t transition-all duration-200"
                    style={{ height: d.val > 0 ? `${heightPct}%` : '2px' }}
                  />
                  <span className="text-xs font-medium text-slate-600 mt-2">
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>{trendData[0] && formatDateSpanish(trendData[0].date)}</span>
            <span>{trendData[6] && formatDateSpanish(trendData[6].date)}</span>
          </div>
        </div>

        {/* Department distribution donut — built from real response counts per department */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Distribución por Dirección</h3>
              <p className="text-xs text-slate-500">Proporción de respuestas recibidas por departamento</p>
            </div>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>

          {donutSegments.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">Aún no hay respuestas para graficar.</div>
          ) : (
            <div className="flex items-center justify-around py-4">
              <div className="relative w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                  {donutSegments.map(seg => (
                    <circle
                      key={seg.department}
                      cx="18" cy="18" r="14" fill="none" stroke={seg.color} strokeWidth="4"
                      strokeDasharray={`${seg.arcLength} 100`} strokeDashoffset={seg.dashOffset}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-slate-900">Total</span>
                  <span className="text-[11px] text-slate-500 font-mono">{totalDeptResponses}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {donutSegments.map(seg => (
                  <div key={seg.department} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }}></span>
                    <span className="text-slate-700 truncate max-w-[160px]">{seg.department}: <strong>{Math.round(seg.pct)}%</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            onClick={handleExportBreakdown}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {departmentStats.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400">No hay datos con los filtros actuales.</td></tr>
              )}
              {deptPg.pageItems.map((row) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={deptPg.page}
          pageSize={deptPg.pageSize}
          total={deptPg.total}
          onPageChange={deptPg.setPage}
          onPageSizeChange={deptPg.setPageSize}
        />
      </div>
    </div>
  );
};
