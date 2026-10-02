import React from 'react';
import { Bold, Italic, Underline } from 'lucide-react';
import { FontId, TitleStyle } from '../types';
import { ColorPicker } from './ColorPicker';
import { FONT_OPTIONS, TITLE_SIZES, titleCss } from '../utils/formTheme';

interface TitleStyleEditorProps {
  value?: TitleStyle;
  onChange: (next: TitleStyle | undefined) => void;
  /** Text of the "use the form's font" option (omit when editing the form-level style). */
  inheritFontLabel?: string;
  /** Style the title inherits from, shown in the preview. */
  inheritedStyle?: TitleStyle;
  sample?: string;
}

const segment = (active: boolean) =>
  `py-1.5 rounded border text-[11px] font-medium ${active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;

/** Color, size, weight, italic/underline and font for a title. Clearing every option resets to the inherited look. */
export const TitleStyleEditor: React.FC<TitleStyleEditorProps> = ({ value, onChange, inheritFontLabel = 'Fuente del formulario', inheritedStyle, sample = 'Título de ejemplo' }) => {
  const style = value ?? {};
  const set = (patch: Partial<TitleStyle>) => {
    const next = { ...style, ...patch };
    // drop keys that went back to "inherit" so saved forms stay clean
    (Object.keys(next) as (keyof TitleStyle)[]).forEach(k => { if (next[k] === undefined || next[k] === false) delete next[k]; });
    onChange(Object.keys(next).length ? next : undefined);
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="block text-[11px] text-slate-500 mb-1">Color</span>
        <ColorPicker value={style.color} onChange={(hex) => set({ color: hex })} noneLabel="Automático" />
      </div>

      <div>
        <span className="block text-[11px] text-slate-500 mb-1">Tamaño</span>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(TITLE_SIZES) as (keyof typeof TITLE_SIZES)[]).map(key => (
            <button key={key} type="button" onClick={() => set({ size: style.size === key ? undefined : key })} className={segment(style.size === key)}>
              {TITLE_SIZES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-[11px] text-slate-500 mb-1">Estilo</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {([['normal', 'Normal'], ['semibold', 'Seminegrita'], ['bold', 'Negrita']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => set({ weight: style.weight === key ? undefined : key })} className={`px-2.5 ${segment(style.weight === key)}`}>
              {label}
            </button>
          ))}
          <button type="button" aria-label="Cursiva" title="Cursiva" onClick={() => set({ italic: !style.italic })} className={`px-2.5 ${segment(!!style.italic)}`}><Italic className="w-3.5 h-3.5" /></button>
          <button type="button" aria-label="Subrayado" title="Subrayado" onClick={() => set({ underline: !style.underline })} className={`px-2.5 ${segment(!!style.underline)}`}><Underline className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <div>
        <span className="block text-[11px] text-slate-500 mb-1">Fuente</span>
        <select
          value={style.fontFamily ?? ''}
          onChange={(e) => set({ fontFamily: (e.target.value || undefined) as FontId | undefined })}
          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
        >
          <option value="">{inheritFontLabel}</option>
          {(['Sans serif', 'Serif', 'Monoespaciada'] as const).map(group => (
            <optgroup key={group} label={group}>
              {FONT_OPTIONS.filter(f => f.group === group).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <span className="text-slate-800 truncate" style={{ fontSize: 14, fontWeight: 600, ...titleCss(inheritedStyle, style) }}>{sample}</span>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="shrink-0 text-[11px] font-semibold text-rose-600 hover:underline">Restablecer</button>
        )}
      </div>
    </div>
  );
};
