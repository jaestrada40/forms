import { Form, FormResponse } from '../types';

export function formatDateSpanish(dateString: string, includeTime = false): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const months = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    
    if (includeTime) {
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day} de ${month} ${year}, ${hours}:${mins} hrs`;
    }
    return `${day} de ${month} ${year}`;
  } catch {
    return dateString;
  }
}

export function formatTimeSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function generateFolio(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `FOR-${year}-${randomNum}`;
}

export function exportResponsesToCSV(form: Form, responses: FormResponse[]) {
  // UTF-8 BOM so Excel recognizes accents correctly
  const BOM = '\uFEFF';
  
  const headers = ['Folio', 'Fecha de Envío', 'Tiempo (s)', 'Correo', 'Departamento'];
  const fieldHeaders = form.fields
    .filter(f => f.type !== 'section')
    .map(f => `"${f.title.replace(/"/g, '""')}"`);
  
  const allHeaders = [...headers, ...fieldHeaders].join(';');
  
  const rows = responses.map(resp => {
    const baseCols = [
      `"${resp.folio}"`,
      `"${formatDateSpanish(resp.submittedAt, true)}"`,
      resp.completionTimeSeconds,
      `"${resp.respondentEmail || 'Anónimo'}"`,
      `"${resp.respondentDepartment || 'No especificado'}"`
    ];
    
    const fieldCols = form.fields
      .filter(f => f.type !== 'section')
      .map(f => {
        const val = resp.answers[f.id];
        if (val === undefined || val === null) return '""';
        if (typeof val === 'object') {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      });
    
    return [...baseCols, ...fieldCols].join(';');
  });

  const csvContent = BOM + [allHeaders, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `respuestas_${form.id}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportResponsesToExcel(form: Form, responses: FormResponse[]) {
  // Generate valid HTML Excel file that Excel opens cleanly as a native table
  const fields = form.fields.filter(f => f.type !== 'section');
  
  let tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Respuestas</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
    <body>
      <h2 style="font-family: Arial; color: #1D4ED8;">${form.title}</h2>
      <p style="font-family: Arial; color: #64748B;">Total de Respuestas: ${responses.length} | Exportado el: ${formatDateSpanish(new Date().toISOString(), true)}</p>
      <table border="1" cellpadding="6" cellspacing="0" style="font-family: Arial; font-size: 12px; border-collapse: collapse;">
        <tr style="background-color: #1D4ED8; color: #ffffff; font-weight: bold;">
          <th>Folio</th>
          <th>Fecha de Envío</th>
          <th>Tiempo (segundos)</th>
          <th>Correo</th>
          <th>Departamento</th>
          ${fields.map(f => `<th>${f.title}</th>`).join('')}
        </tr>
  `;

  responses.forEach(resp => {
    tableHtml += `<tr>
      <td>${resp.folio}</td>
      <td>${formatDateSpanish(resp.submittedAt, true)}</td>
      <td>${resp.completionTimeSeconds}</td>
      <td>${resp.respondentEmail || 'Anónimo'}</td>
      <td>${resp.respondentDepartment || 'No especificado'}</td>
      ${fields.map(f => {
        const val = resp.answers[f.id];
        if (val === undefined || val === null) return '<td>-</td>';
        if (typeof val === 'object') {
          return `<td>${JSON.stringify(val)}</td>`;
        }
        return `<td>${String(val)}</td>`;
      }).join('')}
    </tr>`;
  });

  tableHtml += `</table></body></html>`;

  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `respuestas_${form.id}_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
