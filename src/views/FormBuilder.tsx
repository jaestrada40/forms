import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Share2, 
  Globe, 
  Check, 
  Plus, 
  Trash2, 
  Copy, 
  ChevronUp, 
  ChevronDown, 
  GripVertical, 
  Type, 
  AlignLeft, 
  Hash, 
  Mail, 
  Phone, 
  Calendar, 
  Clock, 
  CheckSquare, 
  CircleDot, 
  ListOrdered, 
  Sliders, 
  Grid, 
  Upload, 
  Divide, 
  Settings2, 
  Palette, 
  FileText, 
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Form, FormField, FormFieldType, FormDesign, FormSettings } from '../types';

interface FormBuilderProps {
  form: Form;
  onUpdateForm: (updated: Form) => void;
  onBack: () => void;
  onShowPublicView: (formId: string) => void;
  onOpenShareModal: (form: Form) => void;
  onOpenPublishModal: (form: Form) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const FIELD_CATALOG: { type: FormFieldType; label: string; icon: any; category: 'Texto' | 'Opciones' | 'Avanzados' }[] = [
  { type: 'short_text', label: 'Texto corto', icon: Type, category: 'Texto' },
  { type: 'paragraph', label: 'Párrafo', icon: AlignLeft, category: 'Texto' },
  { type: 'number', label: 'Número', icon: Hash, category: 'Texto' },
  { type: 'email', label: 'Correo institucional', icon: Mail, category: 'Texto' },
  { type: 'phone', label: 'Teléfono', icon: Phone, category: 'Texto' },
  { type: 'date', label: 'Fecha', icon: Calendar, category: 'Texto' },
  { type: 'time', label: 'Hora', icon: Clock, category: 'Texto' },
  { type: 'single_choice', label: 'Selección única', icon: CircleDot, category: 'Opciones' },
  { type: 'multiple_choice', label: 'Selección múltiple', icon: CheckSquare, category: 'Opciones' },
  { type: 'dropdown', label: 'Lista desplegable', icon: ListOrdered, category: 'Opciones' },
  { type: 'linear_scale', label: 'Escala lineal', icon: Sliders, category: 'Avanzados' },
  { type: 'matrix', label: 'Matriz de cuadrícula', icon: Grid, category: 'Avanzados' },
  { type: 'file_upload', label: 'Carga de archivo', icon: Upload, category: 'Avanzados' },
  { type: 'section', label: 'Nueva sección', icon: Divide, category: 'Avanzados' },
];

export const FormBuilder: React.FC<FormBuilderProps> = ({
  form,
  onUpdateForm,
  onBack,
  onShowPublicView,
  onOpenShareModal,
  onOpenPublishModal,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'design' | 'settings' | 'preview'>('questions');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    form.fields.length > 0 ? form.fields[0].id : null
  );
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('Guardado en la nube');

  const selectedField = form.fields.find(f => f.id === selectedFieldId) || null;

  // Mutator helper
  const updateFormState = (newForm: Form) => {
    onUpdateForm({
      ...newForm,
      updatedAt: new Date().toISOString()
    });
    setAutoSaveStatus('Guardando cambios...');
    setTimeout(() => {
      setAutoSaveStatus('Guardado en la nube');
    }, 600);
  };

  // Add field
  const handleAddField = (type: FormFieldType) => {
    const id = `field_${Date.now()}`;
    const newField: FormField = {
      id,
      type,
      title: type === 'section' ? 'Nueva Sección' : 'Pregunta sin título',
      required: type !== 'section',
      description: '',
      placeholder: '',
    };

    if (type === 'single_choice' || type === 'multiple_choice' || type === 'dropdown') {
      newField.options = ['Opción 1', 'Opción 2', 'Opción 3'];
    } else if (type === 'linear_scale') {
      newField.scaleMin = 1;
      newField.scaleMax = 5;
      newField.scaleMinLabel = 'Muy bajo';
      newField.scaleMaxLabel = 'Muy alto';
    } else if (type === 'matrix') {
      newField.matrixRows = ['Fila 1: Aspecto general', 'Fila 2: Calidad técnica'];
      newField.matrixColumns = ['Deficiente', 'Aceptable', 'Excelente'];
    }

    const updatedFields = [...form.fields, newField];
    updateFormState({ ...form, fields: updatedFields });
    setSelectedFieldId(id);
    showToast(`Campo "${newField.title}" agregado`, 'info');
  };

  // Duplicate field
  const handleDuplicateField = (fieldId: string) => {
    const idx = form.fields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;
    const original = form.fields[idx];
    const clone: FormField = {
      ...JSON.parse(JSON.stringify(original)),
      id: `field_${Date.now()}`,
      title: `${original.title} (Copia)`,
    };
    const updated = [...form.fields];
    updated.splice(idx + 1, 0, clone);
    updateFormState({ ...form, fields: updated });
    setSelectedFieldId(clone.id);
    showToast('Pregunta duplicada', 'info');
  };

  // Delete field
  const handleDeleteField = (fieldId: string) => {
    if (form.fields.length <= 1) {
      showToast('El formulario debe contener al menos un campo', 'error');
      return;
    }
    const updated = form.fields.filter(f => f.id !== fieldId);
    updateFormState({ ...form, fields: updated });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(updated[0]?.id || null);
    }
    showToast('Campo eliminado', 'info');
  };

  // Move field order
  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= form.fields.length) return;
    const updated = [...form.fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateFormState({ ...form, fields: updated });
  };

  // Update selected field property
  const handleUpdateSelectedField = (patch: Partial<FormField>) => {
    if (!selectedFieldId) return;
    const updated = form.fields.map(f => {
      if (f.id === selectedFieldId) {
        return { ...f, ...patch };
      }
      return f;
    });
    updateFormState({ ...form, fields: updated });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 sm:-m-6 bg-slate-100 overflow-hidden">
      {/* Top Builder Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Volver a Mis Formularios"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="min-w-0">
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateFormState({ ...form, title: e.target.value })}
              className="font-bold text-slate-900 text-sm sm:text-base bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white rounded px-2 py-0.5 truncate max-w-xs sm:max-w-md focus:outline-hidden"
              placeholder="Nombre del formulario"
            />
            <div className="flex items-center gap-2 px-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <Check className="w-3 h-3" /> {autoSaveStatus}
              </span>
              <span>·</span>
              <span className="capitalize">{form.status === 'published' ? 'Publicado' : form.status === 'draft' ? 'Borrador' : 'Cerrado'}</span>
            </div>
          </div>
        </div>

        {/* Center Tabs */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'questions' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Preguntas ({form.fields.filter(f => f.type !== 'section').length})
          </button>
          <button
            onClick={() => setActiveTab('design')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'design' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Diseño
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'settings' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Configuración
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'preview' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Vista previa
          </button>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShowPublicView(form.id)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            title="Previsualizar en modo respondedor"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Previsualizar</span>
          </button>

          <button
            onClick={() => onOpenShareModal(form)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartir</span>
          </button>

          <button
            onClick={() => onOpenPublishModal(form)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{form.status === 'published' ? 'Gestionar' : 'Publicar'}</span>
          </button>
        </div>
      </div>

      {/* Main Builder Body */}
      {activeTab === 'questions' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT COLUMN: Field Catalog (300px) */}
          <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/70">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Catálogo de Campos
              </h3>
              <p className="text-[11px] text-slate-500">
                Haga clic para agregar campos al formulario.
              </p>
            </div>

            <div className="p-3 space-y-4">
              {['Texto', 'Opciones', 'Avanzados'].map((category) => (
                <div key={category}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                    {category}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {FIELD_CATALOG.filter(f => f.category === category).map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.type}
                          onClick={() => handleAddField(item.type)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-800 border border-transparent hover:border-blue-200 transition-all text-left group"
                        >
                          <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-700 shrink-0" />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* CENTER COLUMN: Interactive Editable Canvas (Flex-1) */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 flex justify-center">
            <div className="w-full max-w-2xl space-y-4 pb-16">
              {/* Form Title & Description Card */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 right-0 h-2 bg-blue-700" 
                  style={{ backgroundColor: form.design.primaryColor || '#1D4ED8' }}
                />
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormState({ ...form, title: e.target.value })}
                  className="w-full font-bold text-xl text-slate-900 border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-hidden pb-1"
                  placeholder="Título principal del formulario"
                />
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => updateFormState({ ...form, description: e.target.value })}
                  className="w-full mt-2 text-xs text-slate-600 border border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-hidden rounded p-1 resize-none"
                  placeholder="Descripción institucional o instrucciones para los encuestados..."
                />
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-3">
                  <span>Unidad responsable: <span className="font-semibold text-slate-700">{form.department}</span></span>
                  <span>Creado por: {form.creator.name}</span>
                </div>
              </div>

              {/* Questions List */}
              {form.fields.map((field, index) => {
                const isSelected = field.id === selectedFieldId;
                const isSection = field.type === 'section';

                if (isSection) {
                  return (
                    <div
                      key={field.id}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`rounded-xl border p-5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-600/20 shadow-xs'
                          : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Divide className="w-3.5 h-3.5" /> Separador de Sección
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveField(index, 'up'); }}
                            disabled={index === 0}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Subir"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveField(index, 'down'); }}
                            disabled={index === form.fields.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            title="Bajar"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id); }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={field.title}
                        onChange={(e) => handleUpdateSelectedField({ title: e.target.value })}
                        className="w-full font-bold text-base text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-hidden"
                      />
                      <input
                        type="text"
                        value={field.description || ''}
                        onChange={(e) => handleUpdateSelectedField({ description: e.target.value })}
                        placeholder="Descripción opcional de esta sección..."
                        className="w-full text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-hidden mt-1"
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={field.id}
                    onClick={() => setSelectedFieldId(field.id)}
                    className={`bg-white rounded-xl border p-5 transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    {/* Header: Title + Type badge */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={field.title}
                            onChange={(e) => handleUpdateSelectedField({ title: e.target.value })}
                            className="w-full font-semibold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-hidden pb-0.5"
                            placeholder="Escriba la pregunta..."
                          />
                          {field.required && (
                            <span className="text-rose-500 font-bold shrink-0">*</span>
                          )}
                        </div>
                        {field.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {field.description}
                          </div>
                        )}
                      </div>

                      {/* Field Actions */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleMoveField(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                          title="Subir"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveField(index, 'down')}
                          disabled={index === form.fields.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                          title="Bajar"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicateField(field.id)}
                          className="p-1 text-slate-400 hover:text-blue-700 rounded"
                          title="Duplicar pregunta"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Eliminar pregunta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Field Visual Representation in Canvas */}
                    <div className="mt-3 pointer-events-none opacity-85">
                      {field.type === 'short_text' && (
                        <div className="h-8 border border-dashed border-slate-300 rounded-lg bg-slate-50 px-3 flex items-center text-xs text-slate-400">
                          {field.placeholder || 'Respuesta en texto corto...'}
                        </div>
                      )}

                      {field.type === 'paragraph' && (
                        <div className="h-16 border border-dashed border-slate-300 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-400">
                          {field.placeholder || 'Respuesta detallada en párrafo extenso...'}
                        </div>
                      )}

                      {field.type === 'number' && (
                        <div className="w-40 h-8 border border-dashed border-slate-300 rounded-lg bg-slate-50 px-3 flex items-center text-xs text-slate-400 font-mono">
                          0
                        </div>
                      )}

                      {(field.type === 'email' || field.type === 'phone') && (
                        <div className="h-8 border border-dashed border-slate-300 rounded-lg bg-slate-50 px-3 flex items-center text-xs text-slate-400">
                          {field.type === 'email' ? 'nombre@gobierno.cl' : '+56 9 1234 5678'}
                        </div>
                      )}

                      {(field.type === 'date' || field.type === 'time') && (
                        <div className="w-48 h-8 border border-dashed border-slate-300 rounded-lg bg-slate-50 px-3 flex items-center text-xs text-slate-400">
                          {field.type === 'date' ? 'dd / mm / aaaa' : 'hh : mm'}
                        </div>
                      )}

                      {field.type === 'single_choice' && (
                        <div className="space-y-1.5">
                          {(field.options || ['Opción 1', 'Opción 2']).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                              <span className="w-3.5 h-3.5 rounded-full border border-slate-400 shrink-0"></span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {field.type === 'multiple_choice' && (
                        <div className="space-y-1.5">
                          {(field.options || ['Opción 1', 'Opción 2']).map((opt, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                              <span className="w-3.5 h-3.5 rounded-xs border border-slate-400 shrink-0"></span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {field.type === 'dropdown' && (
                        <div className="h-8 border border-slate-300 rounded-lg bg-white px-3 flex items-center justify-between text-xs text-slate-600">
                          <span>Seleccionar opción...</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      )}

                      {field.type === 'linear_scale' && (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[11px] text-slate-500">{field.scaleMinLabel || 'Mín'}</span>
                          <div className="flex items-center gap-2">
                            {Array.from({ length: (field.scaleMax || 5) - (field.scaleMin || 1) + 1 }).map((_, i) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <span className="text-[10px] text-slate-400 tabular-nums">{(field.scaleMin || 1) + i}</span>
                                <span className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-[10px] bg-white"></span>
                              </div>
                            ))}
                          </div>
                          <span className="text-[11px] text-slate-500">{field.scaleMaxLabel || 'Máx'}</span>
                        </div>
                      )}

                      {field.type === 'matrix' && (
                        <div className="text-[11px] border border-slate-200 rounded-lg overflow-hidden">
                          <div className="bg-slate-50 p-2 font-medium text-slate-600 border-b border-slate-200">
                            Matriz de {(field.matrixRows || []).length} filas × {(field.matrixColumns || []).length} columnas
                          </div>
                          <div className="p-2 text-slate-500">
                            {(field.matrixRows || []).slice(0, 2).map((r, i) => (
                              <div key={i} className="truncate">· {r}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {field.type === 'file_upload' && (
                        <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50 text-xs text-slate-500 flex items-center justify-center gap-2">
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span>Adjuntar documento o comprobante (máx. 10 MB)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>

          {/* RIGHT COLUMN: Field Configuration Panel (320px) */}
          <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Configuración del Campo
              </h3>
              <Settings2 className="w-4 h-4 text-slate-400" />
            </div>

            {selectedField ? (
              <div className="p-4 space-y-5 text-xs">
                {/* Field Title */}
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Etiqueta de la pregunta
                  </label>
                  <input
                    type="text"
                    value={selectedField.title}
                    onChange={(e) => handleUpdateSelectedField({ title: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Help text */}
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Texto de ayuda o aclaración
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.description || ''}
                    onChange={(e) => handleUpdateSelectedField({ description: e.target.value })}
                    placeholder="Instrucción adicional para el encuestado..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 resize-none"
                  />
                </div>

                {/* Required Toggle */}
                {selectedField.type !== 'section' && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <div className="font-semibold text-slate-800">Respuesta obligatoria</div>
                      <div className="text-[11px] text-slate-500">Exige completar este campo para enviar</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpdateSelectedField({ required: !selectedField.required })}
                      className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                        selectedField.required ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                    </button>
                  </div>
                )}

                {/* Options Manager (For single_choice, multiple_choice, dropdown) */}
                {(selectedField.type === 'single_choice' || 
                  selectedField.type === 'multiple_choice' || 
                  selectedField.type === 'dropdown') && (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
                      Opciones disponibles
                    </label>
                    <div className="space-y-1.5">
                      {(selectedField.options || []).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...(selectedField.options || [])];
                              newOpts[idx] = e.target.value;
                              handleUpdateSelectedField({ options: newOpts });
                            }}
                            className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = (selectedField.options || []).filter((_, i) => i !== idx);
                              handleUpdateSelectedField({ options: newOpts });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newOpts = [...(selectedField.options || []), `Opción ${(selectedField.options || []).length + 1}`];
                        handleUpdateSelectedField({ options: newOpts });
                      }}
                      className="text-blue-700 hover:text-blue-900 font-semibold text-xs flex items-center gap-1 mt-1"
                    >
                      <Plus className="w-3 h-3" /> Añadir otra opción
                    </button>
                  </div>
                )}

                {/* Linear Scale Config */}
                {selectedField.type === 'linear_scale' && (
                  <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600">Rango mínimo</label>
                        <select
                          value={selectedField.scaleMin || 1}
                          onChange={(e) => handleUpdateSelectedField({ scaleMin: Number(e.target.value) })}
                          className="w-full mt-1 p-1 bg-white border border-slate-200 rounded text-xs"
                        >
                          <option value={0}>0</option>
                          <option value={1}>1</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600">Rango máximo</label>
                        <select
                          value={selectedField.scaleMax || 5}
                          onChange={(e) => handleUpdateSelectedField({ scaleMax: Number(e.target.value) })}
                          className="w-full mt-1 p-1 bg-white border border-slate-200 rounded text-xs"
                        >
                          <option value={5}>5</option>
                          <option value={7}>7</option>
                          <option value={10}>10</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600">Etiqueta valor mínimo</label>
                      <input
                        type="text"
                        value={selectedField.scaleMinLabel || ''}
                        onChange={(e) => handleUpdateSelectedField({ scaleMinLabel: e.target.value })}
                        placeholder="Ej: Muy en desacuerdo"
                        className="w-full mt-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600">Etiqueta valor máximo</label>
                      <input
                        type="text"
                        value={selectedField.scaleMaxLabel || ''}
                        onChange={(e) => handleUpdateSelectedField({ scaleMaxLabel: e.target.value })}
                        placeholder="Ej: Totalmente de acuerdo"
                        className="w-full mt-1 px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Validation and Placeholder */}
                {(selectedField.type === 'short_text' || selectedField.type === 'paragraph' || selectedField.type === 'number') && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                        Texto de marcador (Placeholder)
                      </label>
                      <input
                        type="text"
                        value={selectedField.placeholder || ''}
                        onChange={(e) => handleUpdateSelectedField({ placeholder: e.target.value })}
                        placeholder="Ej: Ingrese su respuesta aquí..."
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600">
                          {selectedField.type === 'number' ? 'Valor mínimo' : 'Mín. caracteres'}
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation?.minLength || selectedField.validation?.minValue || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            handleUpdateSelectedField({
                              validation: {
                                ...selectedField.validation,
                                ...(selectedField.type === 'number' ? { minValue: val } : { minLength: val }),
                              }
                            });
                          }}
                          className="w-full mt-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-600">
                          {selectedField.type === 'number' ? 'Valor máximo' : 'Máx. caracteres'}
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation?.maxLength || selectedField.validation?.maxValue || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            handleUpdateSelectedField({
                              validation: {
                                ...selectedField.validation,
                                ...(selectedField.type === 'number' ? { maxValue: val } : { maxLength: val }),
                              }
                            });
                          }}
                          className="w-full mt-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional Logic */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                    Lógica Condicional
                  </div>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Mostrar u ocultar esta pregunta según la respuesta previa.
                  </p>
                  <select
                    value={selectedField.conditionalLogic?.dependsOnFieldId || 'none'}
                    onChange={(e) => {
                      if (e.target.value === 'none') {
                        handleUpdateSelectedField({ conditionalLogic: undefined });
                      } else {
                        handleUpdateSelectedField({
                          conditionalLogic: {
                            dependsOnFieldId: e.target.value,
                            operator: 'equals',
                            value: 'Sí',
                          }
                        });
                      }
                    }}
                    className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <option value="none">Sin condición (Siempre visible)</option>
                    {form.fields
                      .filter(f => f.id !== selectedField.id && f.type !== 'section')
                      .map(f => (
                        <option key={f.id} value={f.id}>
                          Depende de: {f.title.slice(0, 24)}...
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>Seleccione un campo del centro para editar sus propiedades y validaciones.</p>
              </div>
            )}
          </aside>
        </div>
      ) : activeTab === 'design' ? (
        /* DESIGN TAB */
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex justify-center bg-slate-50">
          <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Identidad Visual y Tema</h3>
              <p className="text-xs text-slate-500">
                Personalice los colores institucionales y la apariencia general del formulario.
              </p>
            </div>

            {/* Color Palette */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Color Institucional Primario
              </label>
              <div className="flex items-center gap-3">
                {[
                  { name: 'Azul Institucional', hex: '#1D4ED8' },
                  { name: 'Azul Marino', hex: '#1E3A8A' },
                  { name: 'Verde Estado', hex: '#059669' },
                  { name: 'Gris Ejecutivo', hex: '#334155' },
                  { name: 'Índigo Moderno', hex: '#4F46E5' },
                ].map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => updateFormState({
                      ...form,
                      design: { ...form.design, primaryColor: color.hex }
                    })}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      form.design.primaryColor === color.hex ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  >
                    {form.design.primaryColor === color.hex && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Tipografía de Lectura
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['sans', 'serif', 'mono'] as const).map((font) => (
                  <button
                    key={font}
                    onClick={() => updateFormState({
                      ...form,
                      design: { ...form.design, fontFamily: font }
                    })}
                    className={`p-3 rounded-lg border text-xs font-medium capitalize text-center ${
                      form.design.fontFamily === font
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {font === 'sans' ? 'Plus Jakarta (Sans)' : font === 'serif' ? 'Editorial Serif' : 'Datos (Mono)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Style */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Densidad y Estilo de Contenedores
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['institutional', 'clean', 'compact'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => updateFormState({
                      ...form,
                      design: { ...form.design, themeStyle: style }
                    })}
                    className={`p-3 rounded-lg border text-xs font-medium capitalize text-center ${
                      form.design.themeStyle === style
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {style === 'institutional' ? 'Institucional' : style === 'clean' ? 'Minimalista' : 'Compacto'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'settings' ? (
        /* SETTINGS TAB */
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex justify-center bg-slate-50">
          <div className="w-full max-w-xl bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Configuración del Formulario</h3>
              <p className="text-xs text-slate-500">
                Parámetros de acceso, restricciones de respuesta y avisos institucionales.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Limitar a 1 respuesta por usuario</div>
                  <div className="text-[11px] text-slate-500">Requiere validar correo o sesión institucional</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateFormState({
                    ...form,
                    settings: { ...form.settings, limitOneResponsePerUser: !form.settings.limitOneResponsePerUser }
                  })}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                    form.settings.limitOneResponsePerUser ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Permitir editar respuestas</div>
                  <div className="text-[11px] text-slate-500">Los usuarios podrán modificar su envío con su folio</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateFormState({
                    ...form,
                    settings: { ...form.settings, allowEditResponses: !form.settings.allowEditResponses }
                  })}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                    form.settings.allowEditResponses ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Notificar por correo cada respuesta</div>
                  <div className="text-[11px] text-slate-500">Envía un aviso a los correos del departamento</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateFormState({
                    ...form,
                    settings: { ...form.settings, notifyEmailOnSubmit: !form.settings.notifyEmailOnSubmit }
                  })}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                    form.settings.notifyEmailOnSubmit ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mensaje de Confirmación tras Enviar
                </label>
                <textarea
                  rows={3}
                  value={form.settings.confirmationMessage}
                  onChange={(e) => updateFormState({
                    ...form,
                    settings: { ...form.settings, confirmationMessage: e.target.value }
                  })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Departamento Responsable
                </label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => updateFormState({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PREVIEW TAB */
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center bg-slate-100">
          <div className="mb-4 text-xs text-slate-500 flex items-center gap-2">
            <span>Modo de simulación de vista previa activa.</span>
            <button
              onClick={() => onShowPublicView(form.id)}
              className="text-blue-700 font-semibold hover:underline flex items-center gap-1"
            >
              Abrir en pantalla completa de respuesta <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            <div 
              className="h-2.5 w-full"
              style={{ backgroundColor: form.design.primaryColor || '#1D4ED8' }}
            />
            <div className="p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">{form.title}</h2>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">{form.description}</p>
              
              <div className="space-y-6">
                {form.fields.map((f, i) => (
                  <div key={f.id} className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      {f.title} {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    {f.description && <p className="text-xs text-slate-500 mb-2">{f.description}</p>}
                    
                    <input
                      type="text"
                      disabled
                      placeholder={f.placeholder || 'Campo de respuesta del usuario...'}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
                <button
                  disabled
                  className="px-5 py-2 bg-blue-700 text-white rounded-lg text-xs font-semibold opacity-80 cursor-not-allowed"
                >
                  Enviar respuestas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
