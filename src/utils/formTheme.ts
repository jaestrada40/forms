import React from 'react';
import { FormDesign } from '../types';

const FONT_STACKS: Record<FormDesign['fontFamily'], string> = {
  sans: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', Cambria, serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

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
    fontStyle: { fontFamily: FONT_STACKS[design?.fontFamily ?? 'sans'] ?? FONT_STACKS.sans } as React.CSSProperties,
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
