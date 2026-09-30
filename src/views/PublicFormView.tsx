import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  CheckCircle2, 
  Printer, 
  RotateCcw, 
  AlertCircle, 
  Calendar, 
  Upload, 
  Lock 
} from 'lucide-react';
import { Form, FormField, FormResponse } from '../types';
import { generateFolio, formatDateSpanish } from '../utils/helpers';

interface PublicFormViewProps {
  form: Form;
  onSubmitResponse: (newResponse: FormResponse) => void;
  onExitToAdmin: () => void;
}

export const PublicFormView: React.FC<PublicFormViewProps> = ({
  form,
  onSubmitResponse,
  onExitToAdmin
}) => {
  // Answers state: fieldId -> value
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [startTime] = useState<number>(Date.now());
  const [submittedFolio, setSubmittedFolio] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Group fields into sections
  const sections = useMemo(() => {
    const list: { title: string; description?: string; fields: FormField[] }[] = [];
    let current = {
      title: 'Información y Preguntas',
      description: '',
      fields: [] as FormField[]
    };

    form.fields.forEach((f) => {
      if (f.type === 'section') {
        if (current.fields.length > 0) {
          list.push(current);
        }
        current = {
          title: f.title,
          description: f.description || '',
          fields: []
        };
      } else {
        current.fields.push(f);
      }
    });

    if (current.fields.length > 0 || list.length === 0) {
      list.push(current);
    }

    return list;
  }, [form.fields]);

  const currentSection = sections[currentSectionIndex] || sections[0];
  const totalSections = sections.length;
  const progressPercent = Math.round(((currentSectionIndex + 1) / totalSections) * 100);

  // Field change
  const handleFieldChange = (fieldId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
  };

  // Validation
  const validateSection = (secIdx: number): boolean => {
    const sec = sections[secIdx];
    const newErrors: Record<string, string> = {};

    sec.fields.forEach(f => {
      const val = answers[f.id];

      // Check conditional visibility
      if (f.conditionalLogic && f.conditionalLogic.dependsOnFieldId) {
        const parentVal = answers[f.conditionalLogic.dependsOnFieldId];
        if (parentVal !== f.conditionalLogic.value) {
          return; // skipped
        }
      }

      if (f.required) {
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[f.id] = 'Este campo es obligatorio.';
          return;
        }
      }

      // Email validation
      if (f.type === 'email' && val) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(val))) {
          newErrors[f.id] = 'Ingrese un correo electrónico válido.';
          return;
        }
      }

      // Min/Max characters
      if (f.validation?.minLength && val && String(val).length < f.validation.minLength) {
        newErrors[f.id] = `Debe contener al menos ${f.validation.minLength} caracteres.`;
        return;
      }
      if (f.validation?.maxLength && val && String(val).length > f.validation.maxLength) {
        newErrors[f.id] = `No debe exceder los ${f.validation.maxLength} caracteres.`;
        return;
      }

      // Min/Max numbers
      if (f.type === 'number' && val !== undefined && val !== '') {
        const numVal = Number(val);
        if (f.validation?.minValue !== undefined && numVal < f.validation.minValue) {
          newErrors[f.id] = `El valor no puede ser menor a ${f.validation.minValue}.`;
          return;
        }
        if (f.validation?.maxValue !== undefined && numVal > f.validation.maxValue) {
          newErrors[f.id] = `El valor no puede ser superior a ${f.validation.maxValue}.`;
          return;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateSection(currentSectionIndex)) {
      setCurrentSectionIndex(prev => Math.min(prev + 1, totalSections - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setCurrentSectionIndex(prev => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSection(currentSectionIndex)) return;

    const folio = generateFolio();
    const nowIso = new Date().toISOString();
    const timeSpent = Math.max(15, Math.round((Date.now() - startTime) / 1000));

    // Try finding email/name in answers
    let emailFound = '';
    let nameFound = '';
    for (const f of form.fields) {
      if (f.type === 'email' && answers[f.id]) emailFound = answers[f.id];
      if ((f.type === 'short_text' && f.title.toLowerCase().includes('nombre')) && answers[f.id]) {
        nameFound = answers[f.id];
      }
    }

    const newResponse: FormResponse = {
      id: `resp_${Date.now()}`,
      formId: form.id,
      folio,
      submittedAt: nowIso,
      completionTimeSeconds: timeSpent,
      respondentEmail: emailFound || 'funcionario.anonimo@gobierno.cl',
      respondentName: nameFound || 'Funcionario Registrado',
      respondentDepartment: answers['f_depto'] || form.department,
      answers: { ...answers },
    };

    onSubmitResponse(newResponse);
    setSubmittedFolio(folio);
    setSubmittedAt(nowIso);
  };

  // IF ALREADY SUBMITTED: SHOW CONFIRMATION SCREEN
  if (submittedFolio) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-center p-8 sm:p-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            ¡Respuesta Registrada con Éxito!
          </h2>

          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            {form.settings.confirmationMessage || 'Su envío ha sido recibido conforme en los servidores institucionales.'}
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Folio Oficial de Recepción:</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{submittedFolio}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Fecha y Hora de Ingreso:</span>
              <span className="font-medium text-slate-700">{formatDateSpanish(submittedAt || '', true)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Formulario:</span>
              <span className="font-medium text-slate-700 truncate max-w-[200px]">{form.title}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => window.print()}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir comprobante oficial</span>
            </button>

            {!form.settings.limitOneResponsePerUser && (
              <button
                onClick={() => {
                  setAnswers({});
                  setErrors({});
                  setCurrentSectionIndex(0);
                  setSubmittedFolio(null);
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Enviar otra respuesta</span>
              </button>
            )}

            <button
              onClick={onExitToAdmin}
              className="w-full py-2 px-4 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors mt-2"
            >
              Volver al panel administrativo de Formularios →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-6 px-4 sm:px-6">
      {/* Return to admin top floating pill (for test navigation) */}
      <div className="w-full max-w-2xl mb-4 flex items-center justify-between text-xs text-slate-500">
        <button
          onClick={onExitToAdmin}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors shadow-2xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al panel</span>
        </button>

        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Conexión institucional segura</span>
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-4 pb-16">
        {/* Form Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div 
            className="h-2.5 w-full"
            style={{ backgroundColor: form.design.primaryColor || '#1D4ED8' }}
          />
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{form.department}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 leading-snug">
              {form.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
              {form.description}
            </p>

            {/* Progress Bar (if multiple sections) */}
            {totalSections > 1 && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                  <span className="font-semibold text-slate-700">
                    Sección {currentSectionIndex + 1} de {totalSections}
                  </span>
                  <span className="font-mono tabular-nums font-semibold">{progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section Header (if titled) */}
        {currentSection.title && currentSection.title !== 'Información y Preguntas' && (
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm mb-0.5">{currentSection.title}</h3>
            {currentSection.description && (
              <p className="text-slate-600 leading-relaxed">{currentSection.description}</p>
            )}
          </div>
        )}

        {/* Question Cards */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {currentSection.fields.map((field) => {
            const hasError = !!errors[field.id];
            const val = answers[field.id];

            return (
              <div
                key={field.id}
                className={`bg-white rounded-xl border p-5 sm:p-6 shadow-2xs transition-all ${
                  hasError ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'
                }`}
              >
                <div className="mb-3">
                  <label className="block text-sm font-semibold text-slate-900 mb-1 leading-snug">
                    {field.title} {field.required && <span className="text-rose-500 font-bold">*</span>}
                  </label>
                  {field.description && (
                    <p className="text-xs text-slate-500 leading-relaxed">{field.description}</p>
                  )}
                </div>

                {/* Render by input type */}
                <div className="mt-2">
                  {field.type === 'short_text' && (
                    <input
                      type="text"
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'Escriba su respuesta...'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all text-slate-800"
                    />
                  )}

                  {field.type === 'paragraph' && (
                    <textarea
                      rows={4}
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'Escriba su respuesta en detalle...'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all text-slate-800 resize-y"
                    />
                  )}

                  {field.type === 'number' && (
                    <input
                      type="number"
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || '0'}
                      className="w-full sm:w-64 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 font-mono text-slate-800"
                    />
                  )}

                  {field.type === 'email' && (
                    <input
                      type="email"
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || 'nombre@gobierno.cl'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 text-slate-800"
                    />
                  )}

                  {field.type === 'phone' && (
                    <input
                      type="tel"
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      placeholder={field.placeholder || '+56 9 1234 5678'}
                      className="w-full sm:w-64 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 text-slate-800"
                    />
                  )}

                  {field.type === 'date' && (
                    <input
                      type="date"
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full sm:w-64 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 text-slate-800"
                    />
                  )}

                  {field.type === 'time' && (
                    <input
                      type="time"
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full sm:w-48 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 text-slate-800"
                    />
                  )}

                  {field.type === 'single_choice' && (
                    <div className="space-y-2">
                      {(field.options || []).map((opt, i) => (
                        <label
                          key={i}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                            val === opt
                              ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-medium'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`radio_${field.id}`}
                            value={opt}
                            checked={val === opt}
                            onChange={() => handleFieldChange(field.id, opt)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {field.type === 'multiple_choice' && (
                    <div className="space-y-2">
                      {(field.options || []).map((opt, i) => {
                        const selectedList: string[] = Array.isArray(val) ? val : [];
                        const isChecked = selectedList.includes(opt);
                        return (
                          <label
                            key={i}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                              isChecked
                                ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-medium'
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleFieldChange(field.id, [...selectedList, opt]);
                                } else {
                                  handleFieldChange(field.id, selectedList.filter(item => item !== opt));
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      value={val || ''}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 text-slate-800"
                    >
                      <option value="">Seleccione una opción...</option>
                      {(field.options || []).map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'linear_scale' && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>{field.scaleMinLabel || 'Mínimo'}</span>
                        <span>{field.scaleMaxLabel || 'Máximo'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                        {Array.from({ length: (field.scaleMax || 5) - (field.scaleMin || 1) + 1 }).map((_, i) => {
                          const scaleVal = (field.scaleMin || 1) + i;
                          const isSelected = val === scaleVal;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleFieldChange(field.id, scaleVal)}
                              className={`flex-1 py-3 rounded-lg border text-xs font-semibold tabular-nums transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs scale-102'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                              }`}
                            >
                              {scaleVal}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {field.type === 'matrix' && (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="p-3">Aspecto</th>
                            {(field.matrixColumns || []).map((col, i) => (
                              <th key={i} className="p-3 text-center">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {(field.matrixRows || []).map((row, rIdx) => {
                            const matrixMap = val || {};
                            const rowVal = matrixMap[row];
                            return (
                              <tr key={rIdx} className="hover:bg-slate-50/50">
                                <td className="p-3 font-medium">{row}</td>
                                {(field.matrixColumns || []).map((col, cIdx) => (
                                  <td key={cIdx} className="p-3 text-center">
                                    <input
                                      type="radio"
                                      name={`matrix_${field.id}_${rIdx}`}
                                      checked={rowVal === col}
                                      onChange={() => {
                                        handleFieldChange(field.id, {
                                          ...matrixMap,
                                          [row]: col,
                                        });
                                      }}
                                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {field.type === 'file_upload' && (
                    <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl p-5 text-center bg-slate-50/50 transition-colors">
                      <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <div className="text-xs font-semibold text-slate-700">
                        {val ? `Archivo seleccionado: ${val.name || 'documento_respaldo.pdf'}` : 'Haga clic para subir o arrastre sus archivos aquí'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Formatos PDF, PNG o JPG hasta 10 MB
                      </div>
                      <input
                        type="file"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFieldChange(field.id, { name: e.target.files[0].name, size: e.target.files[0].size });
                          }
                        }}
                        className="hidden"
                        id={`file_${field.id}`}
                      />
                      <label
                        htmlFor={`file_${field.id}`}
                        className="inline-block mt-3 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-50"
                      >
                        Seleccionar archivo
                      </label>
                    </div>
                  )}
                </div>

                {/* Error message */}
                {hasError && (
                  <div className="flex items-center gap-1.5 mt-2.5 text-xs text-rose-600 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors[field.id]}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4">
            {currentSectionIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            ) : <div />}

            {currentSectionIndex < totalSections - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>Siguiente sección</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="px-7 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>Enviar respuestas</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
