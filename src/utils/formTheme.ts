import React from 'react';
import { FontId, FormDesign, TitleStyle } from '../types';

export interface FontOption { id: FontId; label: string; stack: string; group: 'Sans serif' | 'Serif' | 'Monoespaciada'; google?: string }

// Fonts offered for the whole form and for individual titles. `google` is the Google Fonts family spec,
// loaded on demand only when a form actually uses the font. Plus Jakarta Sans and JetBrains Mono ship with the app.
export const FONT_OPTIONS: FontOption[] = [
  { id: 'sans', label: 'Plus Jakarta Sans', group: 'Sans serif', stack: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'inter', label: 'Inter', group: 'Sans serif', stack: "'Inter', system-ui, sans-serif", google: 'Inter:wght@400;500;600;700' },
  { id: 'roboto', label: 'Roboto', group: 'Sans serif', stack: "'Roboto', system-ui, sans-serif", google: 'Roboto:wght@400;500;700' },
  { id: 'opensans', label: 'Open Sans', group: 'Sans serif', stack: "'Open Sans', system-ui, sans-serif", google: 'Open+Sans:wght@400;600;700' },
  { id: 'lato', label: 'Lato', group: 'Sans serif', stack: "'Lato', system-ui, sans-serif", google: 'Lato:wght@400;700' },
  { id: 'montserrat', label: 'Montserrat', group: 'Sans serif', stack: "'Montserrat', system-ui, sans-serif", google: 'Montserrat:wght@400;500;600;700' },
  { id: 'poppins', label: 'Poppins', group: 'Sans serif', stack: "'Poppins', system-ui, sans-serif", google: 'Poppins:wght@400;500;600;700' },
  { id: 'nunito', label: 'Nunito', group: 'Sans serif', stack: "'Nunito', system-ui, sans-serif", google: 'Nunito:wght@400;600;700' },
  { id: 'sourcesans', label: 'Source Sans 3', group: 'Sans serif', stack: "'Source Sans 3', system-ui, sans-serif", google: 'Source+Sans+3:wght@400;600;700' },
  { id: 'serif', label: 'Georgia (clásica)', group: 'Serif', stack: "Georgia, 'Times New Roman', Cambria, serif" },
  { id: 'merriweather', label: 'Merriweather', group: 'Serif', stack: "'Merriweather', Georgia, serif", google: 'Merriweather:wght@400;700' },
  { id: 'lora', label: 'Lora', group: 'Serif', stack: "'Lora', Georgia, serif", google: 'Lora:wght@400;600;700' },
  { id: 'playfair', label: 'Playfair Display', group: 'Serif', stack: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@400;600;700' },
  { id: 'mono', label: 'Monoespaciada (sistema)', group: 'Monoespaciada', stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  { id: 'jetbrains', label: 'JetBrains Mono', group: 'Monoespaciada', stack: "'JetBrains Mono', ui-monospace, Menlo, monospace" },
];

const FONT_STACKS = Object.fromEntries(FONT_OPTIONS.map(f => [f.id, f.stack])) as Record<FontId, string>;
export const fontStack = (id?: string) => FONT_STACKS[id as FontId] ?? FONT_STACKS.sans;

const loadedFonts = new Set<string>();
/** Adds the Google Fonts stylesheet for a font the first time it is needed. */
export function ensureFont(id?: string) {
  const option = FONT_OPTIONS.find(f => f.id === id);
  if (!option?.google || loadedFonts.has(option.id) || typeof document === 'undefined') return;
  loadedFonts.add(option.id);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${option.google}&display=swap`;
  document.head.appendChild(link);
}

/** Loads every font a form uses (form font, title fonts) so it renders correctly in the builder and the public page. */
export function useFormFonts(design: Partial<FormDesign> | undefined, fields: { titleStyle?: TitleStyle }[]) {
  const ids = [design?.fontFamily, design?.titleStyle?.fontFamily, ...fields.map(f => f.titleStyle?.fontFamily)].filter(Boolean).join(',');
  React.useEffect(() => { ids.split(',').filter(Boolean).forEach(ensureFont); }, [ids]);
}

export const TITLE_SIZES: Record<NonNullable<TitleStyle['size']>, { label: string; px: number }> = {
  sm: { label: 'Pequeño', px: 13 },
  md: { label: 'Normal', px: 15 },
  lg: { label: 'Grande', px: 19 },
  xl: { label: 'Muy grande', px: 24 },
};

/** CSS for a question title: the form's title style, overridden by the field's own style. */
export function titleCss(formStyle?: TitleStyle, fieldStyle?: TitleStyle): React.CSSProperties {
  const s: TitleStyle = { ...formStyle, ...fieldStyle };
  const css: React.CSSProperties = {};
  if (s.color) css.color = s.color;
  if (s.size) css.fontSize = TITLE_SIZES[s.size].px;
  if (s.weight) css.fontWeight = s.weight === 'normal' ? 400 : s.weight === 'bold' ? 700 : 600;
  if (s.italic) css.fontStyle = 'italic';
  if (s.underline) css.textDecoration = 'underline';
  if (s.fontFamily) { css.fontFamily = fontStack(s.fontFamily); ensureFont(s.fontFamily); }
  return css;
}

// Density + container style per theme. Class strings are written out in full so Tailwind can see them.
const STYLES = {
  institutional: {
    card: 'rounded-xl border border-slate-200 shadow-sm',
    cardPad: 'p-5 sm:p-6',
    headerPad: 'p-6 sm:p-8',
    gap: 'space-y-4',
    topBar: 'h-2.5',
    gridGap: 'gap-4',
    input: 'rounded-lg',
  },
  clean: {
    card: 'rounded-2xl border border-transparent shadow-md shadow-slate-200/60',
    cardPad: 'p-7 sm:p-9',
    headerPad: 'p-8 sm:p-10',
    gap: 'space-y-7',
    topBar: 'h-1',
    gridGap: 'gap-7',
    input: 'rounded-xl',
  },
  compact: {
    card: 'rounded-md border border-slate-300 shadow-none',
    cardPad: 'p-3 sm:p-4',
    headerPad: 'p-4 sm:p-5',
    gap: 'space-y-2',
    topBar: 'h-1.5',
    gridGap: 'gap-2',
    input: 'rounded',
  },
} as const;

export const DEFAULT_SUBMIT_TEXT = 'Enviar respuestas';

/** Readable text colour (black/white) for a given hex background. */
function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.65 ? '#0F172A' : '#FFFFFF';
}

export function getSubmitButton(design: Partial<FormDesign> | undefined) {
  const color = design?.submitButtonColor || design?.primaryColor || '#1D4ED8';
  return {
    text: design?.submitButtonText?.trim() || DEFAULT_SUBMIT_TEXT,
    style: { backgroundColor: color, color: contrastText(color) } as React.CSSProperties,
  };
}

export type FieldWidth = NonNullable<import('../types').FormField['width']>;

export const FIELD_WIDTHS: { value: FieldWidth; label: string; hint: string }[] = [
  { value: 'full', label: 'Completo', hint: '1 por fila' },
  { value: 'half', label: '1/2', hint: '2 por fila' },
  { value: 'third', label: '1/3', hint: '3 por fila' },
  { value: 'two_thirds', label: '2/3', hint: 'con un 1/3' },
];

/** Grid span for a field: always full width on phones, partial from the `sm` breakpoint up. */
export function fieldSpan(width?: string): string {
  switch (width) {
    case 'half': return 'min-w-0 col-span-6 sm:col-span-3 [&_input]:max-w-none';
    case 'third': return 'min-w-0 col-span-6 sm:col-span-2 [&_input]:max-w-none';
    case 'two_thirds': return 'min-w-0 col-span-6 sm:col-span-4 [&_input]:max-w-none';
    default: return 'min-w-0 col-span-6';
  }
}

export function getFormTheme(design: Partial<FormDesign> | undefined) {
  const style = STYLES[design?.themeStyle ?? 'institutional'] ?? STYLES.institutional;
  const primary = design?.primaryColor || '#1D4ED8';
  return {
    ...style,
    primary,
    fontStyle: { fontFamily: fontStack(design?.fontFamily) } as React.CSSProperties,
    primaryBg: { backgroundColor: primary } as React.CSSProperties,
    primaryText: { color: primary } as React.CSSProperties,
  };
}

const MAX_DIMENSION = 1600;

/** Reads an image file, downscales rasters so the stored data URL stays small. SVGs are kept as-is. */
export function readImageAsDataUrl(file: File, maxBytes = 1_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      reject(new Error('Formato no soportado. Use PNG, JPG, SVG o WEBP.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No fue posible leer la imagen.'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === 'image/svg+xml') {
        if (file.size > maxBytes) reject(new Error('La imagen es demasiado grande.'));
        else resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('No fue posible procesar la imagen.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const out = canvas.toDataURL(type, 0.85);
        if (out.length > maxBytes * 1.4) reject(new Error('La imagen es demasiado grande.'));
        else resolve(out);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
