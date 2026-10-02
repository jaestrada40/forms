import React, { useEffect, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

// 9 rows x 7 shades: enough variety for institutional palettes without a full picker.
const PALETTE: string[][] = [
  ['#0A2847', '#0D3A63', '#1E3A8A', '#1D4ED8', '#3B82F6', '#93C5FD', '#DBEAFE'],
  ['#134E4A', '#0F766E', '#059669', '#10B981', '#34D399', '#A7F3D0', '#D1FAE5'],
  ['#365314', '#4D7C0F', '#65A30D', '#84CC16', '#BEF264', '#ECFCCB', '#F7FEE7'],
  ['#78350F', '#B45309', '#D97706', '#F59E0B', '#FCD34D', '#FDE68A', '#FEF3C7'],
  ['#7C2D12', '#C2410C', '#EA580C', '#F97316', '#FDBA74', '#FED7AA', '#FFEDD5'],
  ['#7F1D1D', '#B91C1C', '#DC2626', '#EF4444', '#FCA5A5', '#FECACA', '#FEE2E2'],
  ['#581C87', '#7E22CE', '#9333EA', '#A855F7', '#D8B4FE', '#E9D5FF', '#F3E8FF'],
  ['#831843', '#BE185D', '#DB2777', '#EC4899', '#F9A8D4', '#FBCFE8', '#FCE7F3'],
  ['#0F172A', '#1E293B', '#334155', '#64748B', '#CBD5E1', '#F1F5F9', '#FFFFFF'],
];

// Always-visible shortcuts (institutional blues first)
const QUICK = ['#0A2847', '#0D3A63', '#1D4ED8', '#059669', '#B45309', '#DC2626', '#7E22CE', '#0F172A', '#64748B', '#FFFFFF'];

const LIGHT = new Set(['#FFFFFF', '#F1F5F9', '#CBD5E1', '#FEF3C7', '#FDE68A', '#FCD34D', '#ECFCCB', '#F7FEE7', '#BEF264', '#FFEDD5', '#FED7AA', '#FEE2E2', '#FECACA', '#F3E8FF', '#E9D5FF', '#FCE7F3', '#FBCFE8', '#DBEAFE', '#D1FAE5', '#A7F3D0', '#93C5FD', '#FDBA74', '#FCA5A5', '#D8B4FE', '#F9A8D4', '#34D399']);
const HEX = /^#([0-9a-f]{6})$/i;

interface ColorPickerProps {
  value?: string;
  onChange: (hex: string | undefined) => void;
  /** Label of an extra "no colour" / automatic option; omit to hide it. */
  noneLabel?: string;
}

const Swatch: React.FC<{ hex: string; active: boolean; onPick: (hex: string) => void }> = ({ hex, active, onPick }) => (
  <button
    type="button"
    title={hex}
    onClick={() => onPick(hex)}
    className={`w-7 h-7 rounded-md border border-black/10 flex items-center justify-center transition-transform hover:scale-110 ${
      active ? 'ring-2 ring-offset-1 ring-slate-900' : ''
    }`}
    style={{ backgroundColor: hex }}
  >
    {active && <Check className="w-3.5 h-3.5" style={{ color: LIGHT.has(hex) ? '#0F172A' : '#FFFFFF' }} />}
  </button>
);

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, noneLabel }) => {
  const [hexInput, setHexInput] = useState(value ?? '');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { setHexInput(value ?? ''); }, [value]);

  const current = value?.toUpperCase();

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {noneLabel && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className={`h-7 px-2.5 mr-1 rounded-md border text-[11px] font-medium ${
              !value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {noneLabel}
          </button>
        )}
        {QUICK.map(hex => <Swatch key={hex} hex={hex} active={current === hex} onPick={onChange} />)}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1"
          aria-expanded={expanded}
        >
          Más colores <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="inline-grid gap-1 p-2 bg-slate-50 border border-slate-200 rounded-lg" style={{ gridTemplateColumns: `repeat(${PALETTE[0].length}, minmax(0, 1fr))` }}>
          {PALETTE.flat().map(hex => <Swatch key={hex} hex={hex} active={current === hex} onPick={onChange} />)}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value && HEX.test(value) ? value : '#FFFFFF'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-8 h-8 rounded-md border border-slate-200 bg-white p-0.5 cursor-pointer"
          title="Selector de color libre"
        />
        <input
          type="text"
          value={hexInput}
          maxLength={7}
          placeholder="#1D4ED8"
          onChange={(e) => {
            const text = e.target.value.startsWith('#') || e.target.value === '' ? e.target.value : `#${e.target.value}`;
            setHexInput(text);
            if (HEX.test(text)) onChange(text.toUpperCase());
          }}
          className="w-24 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-600"
          aria-label="Código hexadecimal del color"
        />
        <span className="text-[11px] text-slate-400">o escriba un código hex</span>
      </div>
    </div>
  );
};
