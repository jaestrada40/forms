import React, { useEffect, useState } from 'react';
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
  ExternalLink,
  Loader2,
  CloudUpload,
  IdCard,
  Receipt,
  MapPin,
  Sparkles,
  Image as ImageIcon,
  PanelTop
} from 'lucide-react';
import { api } from '../services/api';
import { Form, FormField, FormFieldType, FormDesign, FormSettings } from '../types';
import { ColorPicker } from '../components/ColorPicker';
import { TitleStyleEditor } from '../components/TitleStyleEditor';
import { CAPTCHA_LABELS, CaptchaStatus, effectiveCaptcha, isHeaderMedia, isQuestionField } from '../utils/helpers';
import { FIELD_WIDTHS, FONT_OPTIONS, ensureFont, fieldSpan, getFormTheme, getSubmitButton, titleCss, useFormFonts, DEFAULT_SUBMIT_TEXT, readImageAsDataUrl } from '../utils/formTheme';
import { FormBannerBar, FormMediaBlock, HeaderBanners, HeaderLogos, DEFAULT_IMAGE_WIDTH, DEFAULT_BANNER_HEIGHT } from '../components/FormBranding';
import { PRESET_FIELDS } from '../data/presetFields';
import { GUATEMALA_DEPARTMENT_NAMES } from '../data/guatemalaLocations';

export type FormSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FormBuilderProps {
  form: Form;
  onUpdateForm: (updated: Form) => void;
  saveStatus: FormSaveStatus;
  departments: string[];
  onBack: () => void;
  onShowPublicView: (formId: string) => void;
  onOpenShareModal: (form: Form) => void;
  onOpenPublishModal: (form: Form) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const SaveStatusBadge: React.FC<{ status: FormSaveStatus }> = ({ status }) => {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="hidden 2xl:inline">Guardando cambios…</span><span className="2xl:hidden">Guardando…</span>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold border border-rose-200">
        <AlertCircle className="w-3 h-3" />
        No se pudo guardar
      </span>
    );
  }
  return (
    <span key={status === 'saved' ? 'saved-flash' : 'idle'} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 animate-in fade-in zoom-in-95 duration-200">
      <Check className="w-3 h-3" />
      <span className="hidden 2xl:inline">Todos los cambios guardados</span><span className="2xl:hidden">Guardado</span>
    </span>
  );
};

const FIELD_CATALOG: { type: FormFieldType; label: string; icon: any; category: 'Texto' | 'Opciones' | 'Avanzados' | 'Multimedia' }[] = [
  { type: 'short_text', label: 'Texto corto', icon: Type, category: 'Texto' },
  { type: 'paragraph', label: 'Párrafo', icon: AlignLeft, category: 'Texto' },
  { type: 'number', label: 'Número', icon: Hash, category: 'Texto' },
  { type: 'email', label: 'Correo institucional', icon: Mail, category: 'Texto' },
  { type: 'phone', label: 'Teléfono', icon: Phone, category: 'Texto' },
  { type: 'dpi', label: 'DPI', icon: IdCard, category: 'Texto' },
  { type: 'nit', label: 'NIT', icon: Receipt, category: 'Texto' },
  { type: 'date', label: 'Fecha', icon: Calendar, category: 'Texto' },
  { type: 'time', label: 'Hora', icon: Clock, category: 'Texto' },
  { type: 'single_choice', label: 'Selección única', icon: CircleDot, category: 'Opciones' },
  { type: 'multiple_choice', label: 'Selección múltiple', icon: CheckSquare, category: 'Opciones' },
  { type: 'dropdown', label: 'Lista desplegable', icon: ListOrdered, category: 'Opciones' },
  { type: 'guatemala_location', label: 'Departamento y Municipio', icon: MapPin, category: 'Avanzados' },
  { type: 'linear_scale', label: 'Escala lineal', icon: Sliders, category: 'Avanzados' },
  { type: 'matrix', label: 'Matriz de cuadrícula', icon: Grid, category: 'Avanzados' },
  { type: 'file_upload', label: 'Carga de archivo', icon: Upload, category: 'Avanzados' },
  { type: 'section', label: 'Nueva sección', icon: Divide, category: 'Avanzados' },
  { type: 'banner', label: 'Banner (imagen ancha)', icon: PanelTop, category: 'Multimedia' },
  { type: 'image', label: 'Imagen o logo', icon: ImageIcon, category: 'Multimedia' },
];

export const FormBuilder: React.FC<FormBuilderProps> = ({
  form,
  onUpdateForm,
  saveStatus,
  departments,
  onBack,
  onShowPublicView,
  onOpenShareModal,
  onOpenPublishModal,
  showToast
}) => {
  const theme = getFormTheme(form.design);
  useFormFonts(form.design, form.fields);
  const [mailMode, setMailMode] = useState<'smtp' | 'console' | 'off' | null>(null);
  const [captchaStatus, setCaptchaStatus] = useState<CaptchaStatus | null>(null);
  const activeCaptcha = effectiveCaptcha(form.settings, captchaStatus);
  const [notifyEmailsText, setNotifyEmailsText] = useState((form.settings.notificationEmails || []).join(', '));
  const submitButton = getSubmitButton(form.design);
  const requiresEmail = !!(form.settings.collectEmails || form.settings.limitOneResponsePerUser);
  const [activeTab, setActiveTab] = useState<'questions' | 'design' | 'settings' | 'preview'>('questions');
  // The design tab previews every font, so load them all while it is open
  useEffect(() => { if (activeTab === 'design') FONT_OPTIONS.forEach(f => ensureFont(f.id)); }, [activeTab]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(
    form.fields.length > 0 ? form.fields[0].id : null
  );
  const [emailSelected, setEmailSelected] = useState(false);
  useEffect(() => { if (selectedFieldId) setEmailSelected(false); }, [selectedFieldId]);

  useEffect(() => {
    api.getEmailStatus().then(r => setMailMode(r.mode)).catch(() => {});
    api.getCaptchaStatus().then(setCaptchaStatus).catch(() => {});
  }, []);

  const selectedField = form.fields.find(f => f.id === selectedFieldId) || null;

  const previewEmail = (
    <div className={`col-span-6 ${theme.cardPad} ${theme.card} !shadow-none`}>
      <label className="block text-sm font-semibold text-slate-800 mb-1">
        {form.settings.emailLabel || 'Correo electrónico'} <span className="text-rose-500">*</span>
      </label>
      {form.settings.emailHelp && <p className="text-xs text-slate-500 mb-2">{form.settings.emailHelp}</p>}
      <input
        type="text"
        disabled
        placeholder={form.settings.emailPlaceholder || 'nombre@minfin.gob.gt'}
        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
      />
    </div>
  );

  const emailCard = (
    <div
      onClick={() => { setSelectedFieldId(null); setEmailSelected(true); }}
      className={`col-span-6 bg-white ${theme.card} ${theme.cardPad} cursor-pointer border-dashed ${emailSelected ? '!border-blue-600 ring-2 ring-blue-600/20' : 'hover:!border-slate-400'}`}
    >
      <div className="font-semibold text-sm text-slate-900">
        {form.settings.emailLabel || 'Correo electrónico'} <span className="text-rose-500 font-bold">*</span>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">
        {form.settings.emailHelp || (form.settings.limitOneResponsePerUser ? 'Solo se permite una respuesta por correo electrónico.' : '')}
      </div>
      <div className="mt-3 h-8 border border-dashed border-slate-300 rounded-lg bg-slate-50 px-3 flex items-center text-xs text-slate-400 pointer-events-none">
        {form.settings.emailPlaceholder || 'nombre@minfin.gob.gt'}
      </div>
    </div>
  );

  // Mutator helper
  const updateFormState = (newForm: Form) => {
    onUpdateForm({
      ...newForm,
      updatedAt: new Date().toISOString()
    });
  };

  // Add field
  const handleAddField = (type: FormFieldType) => {
    const id = `field_${Date.now()}`;
    const defaultTitles: Partial<Record<FormFieldType, string>> = {
      section: 'Nueva Sección',
      banner: 'Banner',
      image: 'Logo o imagen',
      dpi: 'Número de DPI (CUI)',
      nit: 'NIT',
      guatemala_location: 'Departamento y Municipio de residencia',
    };

    const newField: FormField = {
      id,
      type,
      title: defaultTitles[type] || 'Pregunta sin título',
      required: isQuestionField({ type }),
      description: '',
      placeholder: '',
    };

    if (type === 'banner' || type === 'image') {
      newField.imagePlacement = 'above_title'; // logos and banners go in the header by default
    }
    if (type === 'banner') {
      newField.imageWidth = 100;
      newField.imageHeight = DEFAULT_BANNER_HEIGHT;
    }
    if (type === 'image') {
      newField.imageWidth = DEFAULT_IMAGE_WIDTH;
      newField.imageAlign = 'left';
    }

    if (type === 'phone') {
      newField.placeholder = '+502 ';
      newField.validation = {
        minLength: 8,
        maxLength: 8,
        regexPattern: '^[0-9]{8}$',
        customErrorMessage: 'Ingrese un número de teléfono válido de 8 dígitos.',
      };
    }

    if (type === 'dpi') {
      newField.placeholder = '1234567890101';
      newField.validation = {
        minLength: 13,
        maxLength: 13,
        regexPattern: '^[0-9]{13}$',
        customErrorMessage: 'El DPI debe tener 13 dígitos numéricos. No se verifica contra RENAP.',
      };
    }

    if (type === 'nit') {
      newField.placeholder = '12345678-9';
      newField.validation = {
        regexPattern: '^[0-9]{1,8}-?[0-9Kk]$',
        customErrorMessage: 'Formato de NIT no válido (ej. 12345678-9). No se verifica contra la SAT.',
      };
    }

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

  // Add a predefined question (autoidentificación, comunidad lingüística, sexo, discapacidad...)
  const handleAddPresetField = (presetId: string) => {
    const preset = PRESET_FIELDS.find(p => p.id === presetId);
    if (!preset) return;
    const id = `field_${Date.now()}`;
    const newField: FormField = {
      id,
      type: 'dropdown',
      title: preset.title,
      required: true,
      description: '',
      options: [...preset.options],
    };
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
  const handleUpdateSelectedFieldById = (id: string, patch: Partial<FormField>) => {
    updateFormState({ ...form, fields: form.fields.map(f => (f.id === id ? { ...f, ...patch } : f)) });
  };

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
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Volver a Mis Formularios"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="min-w-0 overflow-hidden">
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateFormState({ ...form, title: e.target.value })}
              className="font-bold text-slate-900 text-sm sm:text-base bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white rounded px-2 py-0.5 truncate max-w-xs sm:max-w-md focus:outline-hidden"
              placeholder="Nombre del formulario"
            />
            <div className="flex items-center gap-2 px-2 mt-1">
              <SaveStatusBadge status={saveStatus} />
              <span className="text-[11px] text-slate-400">·</span>
              <span className="text-[11px] text-slate-500 capitalize">{form.status === 'published' ? 'Publicado' : form.status === 'draft' ? 'Borrador' : 'Cerrado'}</span>
            </div>
          </div>
        </div>

        {/* Center Tabs */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 whitespace-nowrap">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'questions' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Preguntas ({form.fields.filter(isQuestionField).length})
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
            <span className="hidden xl:inline">Previsualizar</span>
          </button>

          <button
            onClick={() => onOpenShareModal(form)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Compartir</span>
          </button>

          <button
            onClick={() => onOpenPublishModal(form)}
            title="Cambiar el estado del formulario (borrador, publicado o cerrado)"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors ${
              form.status === 'published' || form.status === 'closed'
                ? 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'
                : 'bg-blue-700 hover:bg-blue-800 text-white'
            }`}
          >
            {form.status === 'published' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Estado: Publicado</span>
              </>
            ) : form.status === 'closed' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Estado: Cerrado</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                <span>Publicar</span>
              </>
            )}
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
              {['Texto', 'Opciones', 'Avanzados', 'Multimedia'].map((category) => (
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

              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Preguntas Predefinidas
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {PRESET_FIELDS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleAddPresetField(preset.id)}
                      title={`Agrega el campo con las ${preset.options.length} opciones oficiales ya cargadas`}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-800 border border-transparent hover:border-amber-200 transition-all text-left group"
                    >
                      <Sparkles className="w-4 h-4 text-slate-400 group-hover:text-amber-600 shrink-0" />
                      <span className="font-medium">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER COLUMN: Interactive Editable Canvas (Flex-1) */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 flex justify-center" style={theme.fontStyle}>
            <div className={`w-full max-w-2xl ${theme.gap} pb-16`}>
              {/* Form Title & Description Card */}
              <div className={`bg-white ${theme.card} relative overflow-hidden`}>
                <HeaderBanners fields={form.fields} />
                <FormBannerBar design={form.design} />
                <div className={theme.headerPad}>
                <HeaderLogos fields={form.fields} />
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
              </div>

              <div className={`grid grid-cols-6 ${theme.gridGap}`}>
              {requiresEmail && form.settings.emailPosition !== 'bottom' && emailCard}

              {/* Questions List */}
              {form.fields.map((field, index) => {
                const isSelected = field.id === selectedFieldId;
                const isSection = field.type === 'section';

                if (isSection) {
                  return (
                    <div
                      key={field.id}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`col-span-6 rounded-xl border p-5 transition-all cursor-pointer ${
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
                    className={`${isQuestionField(field) ? fieldSpan(field.width) : 'col-span-6'} bg-white ${theme.card} ${theme.cardPad} transition-all cursor-pointer relative ${
                      isSelected
                        ? '!border-blue-600 ring-2 ring-blue-600/20'
                        : 'hover:!border-slate-400'
                    }`}
                  >
                    {/* Header: Title + Type badge */}
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 mb-2">
                      <div className="flex-1 min-w-[8rem]">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={field.title}
                            onChange={(e) => handleUpdateSelectedField({ title: e.target.value })}
                            style={isQuestionField(field) ? titleCss(form.design.titleStyle, field.titleStyle) : undefined}
                            className="w-full font-semibold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-600 focus:outline-hidden pb-0.5"
                            placeholder={isQuestionField(field) ? 'Escriba la pregunta...' : 'Descripción de la imagen (texto alternativo)'}
                          />
                          {field.required && isQuestionField(field) && (
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
                        {(field.type === 'banner' || field.type === 'image') && (
                          <button
                            onClick={() => handleUpdateSelectedFieldById(field.id, { imagePlacement: isHeaderMedia(field) ? 'in_form' : 'above_title' })}
                            className={`p-1 rounded ${isHeaderMedia(field) ? 'text-blue-700 bg-blue-50' : 'text-slate-400 hover:text-blue-700'}`}
                            title={isHeaderMedia(field) ? 'Está sobre el título: clic para ponerla dentro del formulario' : 'Poner sobre el título (en el encabezado)'}
                          >
                            <PanelTop className="w-3.5 h-3.5" />
                          </button>
                        )}
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
                    <div className="mt-3 pointer-events-none opacity-85 overflow-hidden [&>div]:max-w-full">
                      {(field.type === 'banner' || field.type === 'image') && (
                        isHeaderMedia(field) ? (
                          <div className="flex items-center gap-3 p-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-[11px] text-slate-500">
                            {field.imageSrc && <img src={field.imageSrc} alt="" className="h-10 w-16 object-contain rounded bg-white border border-slate-200" style={field.imageBackground ? { backgroundColor: field.imageBackground } : undefined} />}
                            <span>{field.imageSrc ? 'Se muestra en el encabezado, encima del título (véalo arriba).' : 'Se mostrará encima del título: seleccione una imagen en el panel derecho.'}</span>
                          </div>
                        ) : (
                          <FormMediaBlock field={field} editing />
                        )
                      )}

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

                      {(field.type === 'email' || field.type === 'phone' || field.type === 'dpi' || field.type === 'nit') && (
                        <div className="h-8 border border-dashed border-slate-300 rounded-lg bg-slate-50 px-3 flex items-center text-xs text-slate-400">
                          {field.placeholder || (field.type === 'email' ? 'nombre@minfin.gob.gt' : field.type === 'phone' ? '+502 ' : field.type === 'dpi' ? '1234567890101' : '12345678-9')}
                        </div>
                      )}

                      {field.type === 'guatemala_location' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-8 border border-slate-300 rounded-lg bg-white px-3 flex items-center justify-between text-xs text-slate-600">
                            <span>Departamento...</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <div className="h-8 border border-slate-300 rounded-lg bg-white px-3 flex items-center justify-between text-xs text-slate-400">
                            <span>Municipio...</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </div>
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
                          <span>
                            Formatos {(field.fileConfig?.allowedTypes || ['pdf', 'png', 'jpg']).join(', ').toUpperCase()} · máx. {field.fileConfig?.maxMb || 10} MB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {requiresEmail && form.settings.emailPosition === 'bottom' && emailCard}
              </div>
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

            {!selectedField && emailSelected && requiresEmail ? (
              <div className="p-4 space-y-4 text-xs">
                <p className="text-[11px] text-slate-500">
                  Campo de correo que se agrega solo porque el formulario solicita el correo de quien responde.
                </p>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Etiqueta</label>
                  <input
                    type="text"
                    value={form.settings.emailLabel ?? ''}
                    placeholder="Correo electrónico"
                    onChange={(e) => updateFormState({ ...form, settings: { ...form.settings, emailLabel: e.target.value || undefined } })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Texto de ayuda</label>
                  <textarea
                    rows={2}
                    value={form.settings.emailHelp ?? ''}
                    placeholder="Instrucción adicional..."
                    onChange={(e) => updateFormState({ ...form, settings: { ...form.settings, emailHelp: e.target.value || undefined } })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600 resize-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">Texto de ejemplo (placeholder)</label>
                  <input
                    type="text"
                    value={form.settings.emailPlaceholder ?? ''}
                    placeholder="nombre@minfin.gob.gt"
                    onChange={(e) => updateFormState({ ...form, settings: { ...form.settings, emailPlaceholder: e.target.value || undefined } })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">Posición</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([{ v: 'top' as const, l: 'Al inicio' }, { v: 'bottom' as const, l: 'Al final' }]).map(o => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => updateFormState({ ...form, settings: { ...form.settings, emailPosition: o.v } })}
                        className={`py-1.5 rounded border text-[11px] font-medium ${
                          (form.settings.emailPosition || 'top') === o.v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      updateFormState({ ...form, settings: { ...form.settings, collectEmails: false, limitOneResponsePerUser: false } });
                      setEmailSelected(false);
                      showToast('Campo de correo quitado (también se desactivó el límite de 1 respuesta por correo).', 'info');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    Quitar campo de correo
                  </button>
                  {form.settings.limitOneResponsePerUser && (
                    <p className="text-[10px] text-slate-400 mt-1">Quitarlo desactiva el límite de 1 respuesta por correo.</p>
                  )}
                </div>
              </div>
            ) : selectedField ? (
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

                {(selectedField.type === 'banner' || selectedField.type === 'image') && (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">Imagen</label>
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{selectedField.imageSrc ? 'Cambiar imagen' : 'Subir imagen'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              try {
                                handleUpdateSelectedField({ imageSrc: await readImageAsDataUrl(file) });
                              } catch (err) {
                                showToast(err instanceof Error ? err.message : 'No fue posible cargar la imagen.', 'error');
                              }
                            }}
                          />
                        </label>
                        {selectedField.imageSrc && (
                          <button
                            type="button"
                            onClick={() => handleUpdateSelectedField({ imageSrc: undefined })}
                            className="px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP o SVG.</p>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">Ubicación</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          { v: 'in_form' as const, l: 'En el formulario' },
                          { v: 'above_title' as const, l: 'Sobre el título' },
                        ]).map(o => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => handleUpdateSelectedField({ imagePlacement: o.v })}
                            className={`py-1.5 rounded border text-[11px] font-medium ${
                              (selectedField.imagePlacement || 'in_form') === o.v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {o.l}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {selectedField.imagePlacement === 'above_title'
                          ? 'Aparece en el encabezado, encima del título del formulario.'
                          : 'Aparece en el lugar que ocupa en la lista de campos.'}
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">Color de fondo</label>
                      <ColorPicker value={selectedField.imageBackground} onChange={(hex) => handleUpdateSelectedField({ imageBackground: hex })} noneLabel="Sin fondo" />
                    </div>

                    {selectedField.type === 'image' ? (
                      <>
                        <div>
                          <label className="flex items-center justify-between font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                            <span>Tamaño</span>
                            <span className="font-mono text-slate-500 normal-case">{selectedField.imageWidth || DEFAULT_IMAGE_WIDTH}% del ancho</span>
                          </label>
                          <input
                            type="range"
                            min={10}
                            max={100}
                            step={5}
                            value={selectedField.imageWidth || DEFAULT_IMAGE_WIDTH}
                            onChange={(e) => handleUpdateSelectedField({ imageWidth: Number(e.target.value) })}
                            className="w-full accent-blue-700"
                          />
                          <div className="flex gap-1.5 mt-1.5">
                            {[{ l: 'Pequeño', v: 20 }, { l: 'Mediano', v: 40 }, { l: 'Grande', v: 70 }, { l: 'Completo', v: 100 }].map(o => (
                              <button
                                key={o.v}
                                type="button"
                                onClick={() => handleUpdateSelectedField({ imageWidth: o.v })}
                                className={`flex-1 py-1 rounded border text-[10px] font-medium ${
                                  (selectedField.imageWidth || DEFAULT_IMAGE_WIDTH) === o.v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {o.l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">Alineación</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(['left', 'center', 'right'] as const).map(pos => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => handleUpdateSelectedField({ imageAlign: pos })}
                                className={`py-1.5 rounded border text-[11px] font-medium ${
                                  (selectedField.imageAlign || 'left') === pos ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {pos === 'left' ? 'Izquierda' : pos === 'center' ? 'Centro' : 'Derecha'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="flex items-center justify-between font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                          <span>Altura</span>
                          <span className="font-mono text-slate-500 normal-case">{selectedField.imageHeight || DEFAULT_BANNER_HEIGHT} px</span>
                        </label>
                        <input
                          type="range"
                          min={80}
                          max={400}
                          step={10}
                          value={selectedField.imageHeight || DEFAULT_BANNER_HEIGHT}
                          onChange={(e) => handleUpdateSelectedField({ imageHeight: Number(e.target.value) })}
                          className="w-full accent-blue-700"
                        />
                        <div className="grid grid-cols-2 gap-1.5 mt-2">
                          {([{ v: 'cover' as const, l: 'Recortar para llenar' }, { v: 'contain' as const, l: 'Mostrar completa' }]).map(o => (
                            <button
                              key={o.v}
                              type="button"
                              onClick={() => handleUpdateSelectedField({ imageFit: o.v })}
                              className={`py-1.5 rounded border text-[11px] font-medium ${
                                (selectedField.imageFit || 'cover') === o.v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {o.l}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">El banner ocupa todo el ancho. "Mostrar completa" evita recortes y deja ver el color de fondo a los lados.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Help text */}
                {isQuestionField(selectedField) && (
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
                )}

                {/* Title style */}
                {isQuestionField(selectedField) && (
                  <details className="group border border-slate-200 rounded-lg bg-white">
                    <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                      Estilo del título
                      {selectedField.titleStyle && <span className="text-[10px] font-semibold text-blue-700 normal-case">Personalizado</span>}
                    </summary>
                    <div className="px-3 pb-3">
                      <TitleStyleEditor
                        value={selectedField.titleStyle}
                        onChange={(titleStyle) => handleUpdateSelectedField({ titleStyle })}
                        inheritedStyle={form.design.titleStyle}
                        sample={selectedField.title || 'Título de ejemplo'}
                      />
                    </div>
                  </details>
                )}

                {/* Width / columns */}
                {isQuestionField(selectedField) && (
                  <div>
                    <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                      Ancho en el formulario
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {FIELD_WIDTHS.map(w => (
                        <button
                          key={w.value}
                          type="button"
                          title={w.hint}
                          onClick={() => handleUpdateSelectedField({ width: w.value })}
                          className={`py-1.5 rounded border text-[11px] font-medium ${
                            (selectedField.width || 'full') === w.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Los campos seguidos con ancho parcial se acomodan en la misma fila (1/2 + 1/2, 1/3 + 1/3 + 1/3, 2/3 + 1/3). En celular siempre ocupan toda la fila.
                    </p>
                  </div>
                )}

                {/* Required Toggle */}
                {isQuestionField(selectedField) && (
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

                {/* Matrix Rows & Columns Editor */}
                {selectedField.type === 'matrix' && (
                  <div className="space-y-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                        Filas (aspectos a evaluar)
                      </label>
                      <div className="space-y-1.5">
                        {(selectedField.matrixRows || []).map((row, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={row}
                              onChange={(e) => {
                                const rows = [...(selectedField.matrixRows || [])];
                                rows[idx] = e.target.value;
                                handleUpdateSelectedField({ matrixRows: rows });
                              }}
                              className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-blue-600"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const rows = (selectedField.matrixRows || []).filter((_, i) => i !== idx);
                                handleUpdateSelectedField({ matrixRows: rows });
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
                          const rows = [...(selectedField.matrixRows || []), `Fila ${(selectedField.matrixRows || []).length + 1}`];
                          handleUpdateSelectedField({ matrixRows: rows });
                        }}
                        className="text-blue-700 hover:text-blue-900 font-semibold text-xs flex items-center gap-1 mt-1.5"
                      >
                        <Plus className="w-3 h-3" /> Añadir fila
                      </button>
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                        Columnas (opciones de respuesta)
                      </label>
                      <div className="space-y-1.5">
                        {(selectedField.matrixColumns || []).map((col, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={col}
                              onChange={(e) => {
                                const cols = [...(selectedField.matrixColumns || [])];
                                cols[idx] = e.target.value;
                                handleUpdateSelectedField({ matrixColumns: cols });
                              }}
                              className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs focus:ring-2 focus:ring-blue-600"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cols = (selectedField.matrixColumns || []).filter((_, i) => i !== idx);
                                handleUpdateSelectedField({ matrixColumns: cols });
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
                          const cols = [...(selectedField.matrixColumns || []), `Columna ${(selectedField.matrixColumns || []).length + 1}`];
                          handleUpdateSelectedField({ matrixColumns: cols });
                        }}
                        className="text-blue-700 hover:text-blue-900 font-semibold text-xs flex items-center gap-1 mt-1.5"
                      >
                        <Plus className="w-3 h-3" /> Añadir columna
                      </button>
                    </div>
                  </div>
                )}

                {/* File Upload Config */}
                {selectedField.type === 'file_upload' && (
                  <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                        Extensiones permitidas
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['pdf', 'png', 'jpg', 'doc', 'docx', 'xlsx'].map(ext => {
                          const allowed = selectedField.fileConfig?.allowedTypes || ['pdf', 'png', 'jpg'];
                          const checked = allowed.includes(ext);
                          return (
                            <label key={ext} className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-md cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked ? allowed.filter(t => t !== ext) : [...allowed, ext];
                                  handleUpdateSelectedField({
                                    fileConfig: { allowedTypes: next, maxMb: selectedField.fileConfig?.maxMb || 10 },
                                  });
                                }}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span className="uppercase">{ext}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                        Tamaño máximo (MB)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={selectedField.fileConfig?.maxMb || 10}
                        onChange={(e) => {
                          const maxMb = Number(e.target.value) || 10;
                          handleUpdateSelectedField({
                            fileConfig: { allowedTypes: selectedField.fileConfig?.allowedTypes || ['pdf', 'png', 'jpg'], maxMb },
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">Límite recomendado: 10 MB por archivo.</p>
                    </div>
                  </div>
                )}

                {/* Placeholder (available on every free-text style field) */}
                {(selectedField.type === 'short_text' || selectedField.type === 'paragraph' || selectedField.type === 'number' || selectedField.type === 'email' || selectedField.type === 'phone' || selectedField.type === 'dpi' || selectedField.type === 'nit') && (
                  <div className="pt-2 border-t border-slate-200">
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
                    {selectedField.type === 'phone' && (
                      <p className="text-[11px] text-slate-500 mt-1">El teléfono siempre exige 8 dígitos numéricos.</p>
                    )}
                    {selectedField.type === 'dpi' && (
                      <p className="text-[11px] text-slate-500 mt-1">Exige 13 dígitos numéricos (formato CUI). No se verifica contra RENAP.</p>
                    )}
                    {selectedField.type === 'nit' && (
                      <p className="text-[11px] text-slate-500 mt-1">Formato: hasta 8 dígitos + guion + dígito verificador o "K" (ej. 12345678-9). No se verifica contra la SAT.</p>
                    )}
                  </div>
                )}

                {/* Min/Max validation (text length or numeric range) */}
                {(selectedField.type === 'short_text' || selectedField.type === 'paragraph' || selectedField.type === 'number') && (
                  <div className="space-y-3">
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
                      .filter(f => f.id !== selectedField.id && isQuestionField(f))
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
          <div className="w-full max-w-xl self-start bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
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
              <ColorPicker
                value={form.design.primaryColor}
                onChange={(hex) => updateFormState({ ...form, design: { ...form.design, primaryColor: hex || '#1D4ED8' } })}
              />
            </div>

            {/* Typography */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Fuente del formulario
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => updateFormState({
                      ...form,
                      design: { ...form.design, fontFamily: font.id }
                    })}
                    style={{ fontFamily: font.stack }}
                    className={`px-2.5 py-2 rounded-lg border text-left ${
                      form.design.fontFamily === font.id
                        ? 'border-blue-600 bg-blue-50/50 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="block text-base leading-tight">Aa</span>
                    <span className="block text-[11px] truncate">{font.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">Se aplica a todo el formulario. Las fuentes distintas a Plus Jakarta Sans se descargan de Google Fonts al abrir el formulario.</p>
            </div>

            {/* Question title style (form-wide default) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Estilo de los títulos de las preguntas
              </label>
              <p className="text-[11px] text-slate-500 mb-3">Se aplica a todas las preguntas. Cada pregunta puede sobrescribirlo en su panel «Estilo del título».</p>
              <TitleStyleEditor
                value={form.design.titleStyle}
                onChange={(titleStyle) => updateFormState({ ...form, design: { ...form.design, titleStyle } })}
                inheritFontLabel="La fuente del formulario"
              />
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
              <p className="text-[11px] text-slate-500 mt-2">
                {form.design.themeStyle === 'clean'
                  ? 'Espaciado amplio, bordes muy redondeados y sombra suave.'
                  : form.design.themeStyle === 'compact'
                    ? 'Espaciado reducido y bordes definidos: más preguntas visibles por pantalla.'
                    : 'Equilibrio entre espacio y estructura, con bordes y sombra sutiles.'}
              </p>
            </div>

            {/* Submit button */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Botón de Enviar
              </label>
              <div className="space-y-3">
                <div>
                  <span className="block text-[11px] text-slate-500 mb-1">Texto del botón</span>
                  <input
                    type="text"
                    maxLength={40}
                    value={form.design.submitButtonText || ''}
                    placeholder={DEFAULT_SUBMIT_TEXT}
                    onChange={(e) => updateFormState({ ...form, design: { ...form.design, submitButtonText: e.target.value || undefined } })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-slate-500 mb-1">Color del botón</span>
                  <ColorPicker
                    value={form.design.submitButtonColor}
                    onChange={(hex) => updateFormState({ ...form, design: { ...form.design, submitButtonColor: hex } })}
                    noneLabel="Igual al color primario"
                  />
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Vista previa</span>
                  <span style={submitButton.style} className="px-5 py-2 rounded-lg text-xs font-semibold shadow-xs">{submitButton.text}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'settings' ? (
        /* SETTINGS TAB */
        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex justify-center bg-slate-50">
          <div className="w-full max-w-xl self-start bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Configuración del Formulario</h3>
              <p className="text-xs text-slate-500">
                Parámetros de acceso, restricciones de respuesta y avisos institucionales.
              </p>
            </div>

            <div className="space-y-4">
              {([
                {
                  key: 'collectEmails' as const,
                  title: 'Solicitar correo electrónico',
                  desc: 'El formulario pedirá el correo de quien responde y lo guardará con la respuesta',
                  checked: !!form.settings.collectEmails || !!form.settings.limitOneResponsePerUser,
                  disabled: !!form.settings.limitOneResponsePerUser,
                },
                {
                  key: 'captchaEnabled' as const,
                  title: 'Verificación anti-spam (captcha)',
                  desc: captchaStatus && captchaStatus.provider !== 'none'
                    ? `Se muestra ${CAPTCHA_LABELS[captchaStatus.provider]} antes de enviar. Apáguelo solo si este formulario no es público`
                    : 'Pide resolver una pregunta sencilla antes de enviar. Un Administrador puede configurar Turnstile, hCaptcha o reCAPTCHA en Configuración',
                  checked: activeCaptcha !== null,
                  disabled: false,
                },
                {
                  key: 'limitOneResponsePerUser' as const,
                  title: 'Limitar a 1 respuesta por correo',
                  desc: 'Rechaza una segunda respuesta con el mismo correo (solicita el correo automáticamente)',
                  checked: !!form.settings.limitOneResponsePerUser,
                  disabled: false,
                },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="pr-3">
                    <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                    <div className="text-[11px] text-slate-500">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => updateFormState({
                      ...form,
                      settings: { ...form.settings, [item.key]: !item.checked }
                    })}
                    className={`w-10 h-6 shrink-0 flex items-center rounded-full p-1 transition-colors disabled:opacity-60 ${
                      item.checked ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                  </button>
                </div>
              ))}

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-3">
                    <div className="text-xs font-semibold text-slate-900">Notificar por correo cada respuesta</div>
                    <div className="text-[11px] text-slate-500">Envía un aviso con el folio a estas direcciones</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFormState({
                      ...form,
                      settings: { ...form.settings, notifyEmailOnSubmit: !form.settings.notifyEmailOnSubmit }
                    })}
                    className={`w-10 h-6 shrink-0 flex items-center rounded-full p-1 transition-colors ${
                      form.settings.notifyEmailOnSubmit ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                  </button>
                </div>
                {form.settings.notifyEmailOnSubmit && (
                  <>
                    <input
                      type="text"
                      value={notifyEmailsText}
                      placeholder="jefatura@minfin.gob.gt, rrhh@minfin.gob.gt"
                      onChange={(e) => {
                        setNotifyEmailsText(e.target.value);
                        updateFormState({
                          ...form,
                          settings: { ...form.settings, notificationEmails: e.target.value.split(/[,;\s]+/).map(v => v.trim()).filter(Boolean) }
                        });
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                    />
                    {mailMode === 'off' && (
                      <p className="text-[11px] text-amber-700">
                        El servidor de correo (SMTP) no está configurado: los avisos no se enviarán hasta que un Administrador lo configure en Configuración → Servidor de correo.
                      </p>
                    )}
                    {mailMode === 'console' && (
                      <p className="text-[11px] text-blue-700">Modo de pruebas: los avisos se muestran en el registro del servidor, no se envían.</p>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Fecha de cierre
                  </label>
                  <input
                    type="date"
                    value={form.settings.closeDate || ''}
                    onChange={(e) => updateFormState({
                      ...form,
                      settings: { ...form.settings, closeDate: e.target.value || undefined }
                    })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Después de este día ya no recibe respuestas.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Máximo de respuestas
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Sin límite"
                    value={form.settings.maxTotalResponses || ''}
                    onChange={(e) => updateFormState({
                      ...form,
                      settings: { ...form.settings, maxTotalResponses: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : undefined }
                    })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Al llegar al límite se cierra solo.</p>
                </div>
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
                <select
                  value={form.department}
                  onChange={(e) => updateFormState({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  {[...new Set([form.department, ...departments])].filter(Boolean).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
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

          <div className={`w-full max-w-2xl bg-white ${theme.card} overflow-hidden`} style={theme.fontStyle}>
            <HeaderBanners fields={form.fields} />
            <FormBannerBar design={form.design} />
            <div className={theme.headerPad}>
              <HeaderLogos fields={form.fields} />
              <h2 className="text-xl font-bold text-slate-900 mb-2">{form.title}</h2>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed">{form.description}</p>
              
              <div className={`grid grid-cols-6 ${theme.gridGap}`}>
                {requiresEmail && form.settings.emailPosition !== 'bottom' && previewEmail}
                {form.fields.filter(f => !isHeaderMedia(f)).map((f, i) => (f.type === 'banner' || f.type === 'image') ? (
                  <div key={f.id} className="col-span-6"><FormMediaBlock field={f} cardClass={theme.card} /></div>
                ) : (
                  <div key={f.id} className={`${fieldSpan(f.width)} ${theme.cardPad} ${theme.card} !shadow-none`}>
                    <label className="block text-sm font-semibold text-slate-800 mb-1" style={titleCss(form.design.titleStyle, f.titleStyle)}>
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
                {requiresEmail && form.settings.emailPosition === 'bottom' && previewEmail}
                {activeCaptcha && (
                  <div className={`col-span-6 ${theme.cardPad} ${theme.card} !shadow-none`}>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">Verificación <span className="text-rose-500">*</span></label>
                    {activeCaptcha.provider === 'builtin' ? (
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="font-semibold">¿Cuánto es 7 + 4?</span>
                        <input type="text" disabled className="w-24 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg cursor-not-allowed" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg">
                        <span className="w-4 h-4 border-2 border-slate-300 rounded-sm" /> Verificación de {CAPTCHA_LABELS[activeCaptcha.provider]}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
                <button
                  disabled
                  style={submitButton.style}
                  className="px-5 py-2 rounded-lg text-xs font-semibold opacity-80 cursor-not-allowed"
                >
                  {submitButton.text}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
