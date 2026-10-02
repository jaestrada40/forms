import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Form, FormField, FormResponse } from '../types';
import { isQuestionField, formatAnswerForExport, formatDateSpanish, formatTimeSeconds } from './helpers';

const BLUE: [number, number, number] = [29, 78, 216];
const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_50: [number, number, number] = [248, 250, 252];
const MARGIN = 40;

const today = () => new Date().toISOString().slice(0, 10);
const slug = (text: string) => text.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').toLowerCase().slice(0, 50) || 'informe';

function newDoc() {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  return { doc, width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
}

function header(doc: jsPDF, width: number, institution: string, title: string, subtitle?: string): number {
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, width, 6, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BLUE);
  doc.text(institution.toUpperCase(), MARGIN, 36);
  doc.setFont('helvetica', 'normal').setTextColor(...SLATE_500);
  doc.text(`Generado el ${formatDateSpanish(new Date().toISOString(), true)}`, width - MARGIN, 36, { align: 'right' });
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...SLATE_900);
  const titleLines = doc.splitTextToSize(title, width - MARGIN * 2) as string[];
  doc.text(titleLines, MARGIN, 62);
  let y = 62 + titleLines.length * 20;
  if (subtitle) {
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...SLATE_500);
    const subLines = doc.splitTextToSize(subtitle, width - MARGIN * 2) as string[];
    doc.text(subLines, MARGIN, y);
    y += subLines.length * 13;
  }
  doc.setDrawColor(226, 232, 240).line(MARGIN, y + 6, width - MARGIN, y + 6);
  return y + 22;
}

function footers(doc: jsPDF, width: number, height: number, institution: string) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...SLATE_500);
    doc.text(institution, MARGIN, height - 20);
    doc.text(`Página ${i} de ${pages}`, width - MARGIN, height - 20, { align: 'right' });
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number, width: number, height: number): number {
  if (y > height - 90) { doc.addPage(); y = MARGIN; }
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BLUE);
  doc.text(text.toUpperCase(), MARGIN, y);
  return y + 10;
}

const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

const tableStyles = {
  theme: 'striped' as const,
  styles: { font: 'helvetica', fontSize: 9, cellPadding: 5, textColor: SLATE_900, overflow: 'linebreak' as const },
  headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' as const },
  alternateRowStyles: { fillColor: SLATE_50 },
  margin: { left: MARGIN, right: MARGIN, bottom: 40 },
};

function kpiRow(doc: jsPDF, width: number, y: number, items: { label: string; value: string }[]): number {
  const gap = 10;
  const boxW = (width - MARGIN * 2 - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = MARGIN + i * (boxW + gap);
    doc.setFillColor(...SLATE_50).setDrawColor(226, 232, 240).roundedRect(x, y, boxW, 52, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...SLATE_900).text(item.value, x + 10, y + 26);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...SLATE_500).text(item.label.toUpperCase(), x + 10, y + 42);
  });
  return y + 52 + 22;
}

// ---------- Executive report ----------

export interface ReportPdfData {
  institution: string;
  filters: string[];
  kpis: { label: string; value: string }[];
  departments: { department: string; formsCount: number; responsesCount: number; avgTime: string }[];
  trend: { date: string; day: string; val: number }[];
}

export function exportReportPDF(data: ReportPdfData) {
  const { doc, width, height } = newDoc();
  let y = header(doc, width, data.institution, 'Informe Ejecutivo de Reportes', data.filters.join('  ·  '));
  y = kpiRow(doc, width, y, data.kpis);

  y = sectionTitle(doc, 'Desglose por dirección o departamento', y, width, height);
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [['Dirección o departamento', 'Formularios', 'Respuestas', 'Tiempo promedio']],
    body: data.departments.length
      ? data.departments.map(d => [d.department, d.formsCount, d.responsesCount, d.avgTime])
      : [['Sin datos para los filtros seleccionados', '', '', '']],
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  y = sectionTitle(doc, 'Respuestas de los últimos 7 días', lastY(doc) + 28, width, height);
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [['Día', 'Fecha', 'Respuestas']],
    body: data.trend.map(t => [t.day, t.date, t.val]),
    columnStyles: { 2: { halign: 'right' } },
  });

  footers(doc, width, height, data.institution);
  doc.save(`informe_ejecutivo_${today()}.pdf`);
}

// ---------- Responses summary ----------

function describeField(field: FormField, responses: FormResponse[]): { head: string[]; body: (string | number)[][]; note?: string } {
  const answers = responses.map(r => r.answers[field.id]).filter(v => v !== undefined && v !== null && v !== '');
  const total = answers.length;
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '0%');

  if (field.type === 'single_choice' || field.type === 'dropdown' || field.type === 'multiple_choice') {
    const counts: Record<string, number> = {};
    (field.options || []).forEach(o => (counts[o] = 0));
    answers.forEach(a => (Array.isArray(a) ? a : [a]).forEach(v => { counts[String(v)] = (counts[String(v)] || 0) + 1; }));
    const base = field.type === 'multiple_choice' ? Object.values(counts).reduce((a, b) => a + b, 0) : total;
    return { head: ['Opción', 'Respuestas', '%'], body: Object.entries(counts).map(([k, v]) => [k, v, pct(v, base)]) };
  }

  if (field.type === 'linear_scale') {
    const min = field.scaleMin || 1;
    const max = field.scaleMax || 5;
    const counts: Record<number, number> = {};
    for (let i = min; i <= max; i++) counts[i] = 0;
    let sum = 0;
    answers.forEach(a => { const n = Number(a); if (!isNaN(n)) { counts[n] = (counts[n] || 0) + 1; sum += n; } });
    return {
      head: ['Puntaje', 'Respuestas', '%'],
      body: Object.entries(counts).map(([k, v]) => [k, v, pct(v, total)]),
      note: `Promedio: ${total ? (sum / total).toFixed(2) : '—'}`,
    };
  }

  return {
    head: ['Respuestas de ejemplo'],
    body: answers.slice(0, 5).map(a => [formatAnswerForExport(field, a)]),
    note: total === 0 ? 'Sin respuestas' : total > 5 ? `Mostrando 5 de ${total} respuestas` : undefined,
  };
}

export function exportResponsesPDF(form: Form, responses: FormResponse[], institution: string) {
  const { doc, width, height } = newDoc();
  let y = header(doc, width, institution, form.title, `${form.department}${form.description ? ' · ' + form.description : ''}`);

  const avg = responses.length
    ? formatTimeSeconds(Math.round(responses.reduce((a, r) => a + (r.completionTimeSeconds || 0), 0) / responses.length))
    : '—';
  y = kpiRow(doc, width, y, [
    { label: 'Respuestas', value: String(responses.length) },
    { label: 'Tiempo promedio', value: avg },
    { label: 'Estado', value: form.status === 'published' ? 'Publicado' : form.status === 'closed' ? 'Cerrado' : 'Borrador' },
  ]);

  y = sectionTitle(doc, 'Resumen por pregunta', y, width, height);
  y += 6;
  form.fields.filter(isQuestionField).forEach((field, i) => {
    const { head, body, note } = describeField(field, responses);
    if (y > height - 120) { doc.addPage(); y = MARGIN; }
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...SLATE_900);
    const lines = doc.splitTextToSize(`${i + 1}. ${field.title}`, width - MARGIN * 2) as string[];
    doc.text(lines, MARGIN, y);
    y += lines.length * 12;
    if (note) {
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...SLATE_500).text(note, MARGIN, y);
      y += 4;
    }
    autoTable(doc, {
      ...tableStyles,
      startY: y + 4,
      head: [head],
      body: body.length ? body : [['Sin respuestas']],
      columnStyles: head.length === 3 ? { 1: { halign: 'right', cellWidth: 80 }, 2: { halign: 'right', cellWidth: 60 } } : {},
      didParseCell: (d) => { if (d.section === 'head') d.cell.styles.fillColor = [71, 85, 105]; },
    });
    y = lastY(doc) + 20;
  });

  if (responses.length) {
    doc.addPage();
    y = sectionTitle(doc, 'Listado de respuestas', MARGIN + 6, width, height);
    autoTable(doc, {
      ...tableStyles,
      startY: y,
      head: [['Folio', 'Fecha de envío', 'Correo', 'Departamento', 'Tiempo']],
      body: responses.map(r => [
        r.folio,
        formatDateSpanish(r.submittedAt, true),
        r.respondentEmail || 'Anónimo',
        r.respondentDepartment || '—',
        formatTimeSeconds(r.completionTimeSeconds),
      ]),
    });
  }

  footers(doc, width, height, institution);
  doc.save(`respuestas_${slug(form.title)}_${today()}.pdf`);
}

// ---------- Individual response ----------

export function exportIndividualResponsePDF(form: Form, response: FormResponse, institution: string) {
  const { doc, width, height } = newDoc();
  let y = header(doc, width, institution, form.title, `${form.department} · Folio ${response.folio}`);

  autoTable(doc, {
    ...tableStyles,
    theme: 'plain',
    startY: y,
    body: [
      ['Folio', response.folio],
      ['Enviado', formatDateSpanish(response.submittedAt, true)],
      ['Tiempo de llenado', formatTimeSeconds(response.completionTimeSeconds)],
      ['Correo', response.respondentEmail || 'Anónimo'],
      ...(response.respondentName ? [['Nombre', response.respondentName]] : []),
      ...(response.respondentDepartment ? [['Departamento', response.respondentDepartment]] : []),
    ],
    columnStyles: { 0: { fontStyle: 'bold', textColor: SLATE_500, cellWidth: 110 } },
  });
  y = sectionTitle(doc, 'Respuestas', lastY(doc) + 24, width, height);

  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [['Pregunta', 'Respuesta']],
    body: form.fields
      .filter(isQuestionField)
      .map(f => [f.title, formatAnswerForExport(f, response.answers[f.id]) || '—']),
    columnStyles: { 0: { cellWidth: 190, fontStyle: 'bold' } },
  });

  footers(doc, width, height, institution);
  doc.save(`ficha_${response.folio}_${today()}.pdf`);
}
