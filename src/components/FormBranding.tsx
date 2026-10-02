import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { FormDesign, FormField } from '../types';
import { getFormTheme } from '../utils/formTheme';
import { isHeaderMedia } from '../utils/helpers';

export const DEFAULT_IMAGE_WIDTH = 40;
export const DEFAULT_BANNER_HEIGHT = 160;

/** Colour bar shown at the top of the form header card. */
export const FormBannerBar: React.FC<{ design: FormDesign }> = ({ design }) => {
  const theme = getFormTheme(design);
  return <div className={`${theme.topBar} w-full`} style={theme.primaryBg} />;
};

/**
 * Renders a `banner` (full-width picture) or `image` (logo / picture with adjustable width and alignment)
 * field. In the builder an empty field shows a placeholder; in the public form it renders nothing.
 * `bare` drops the rounded card chrome (used inside the header card).
 */
export const FormMediaBlock: React.FC<{ field: FormField; editing?: boolean; cardClass?: string; bare?: boolean }> = ({ field, editing, cardClass = '', bare }) => {
  if (!field.imageSrc) {
    if (!editing) return null;
    return (
      <div className="flex flex-col items-center justify-center gap-1 h-24 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 text-xs text-slate-400">
        <ImageIcon className="w-5 h-5" />
        <span>{field.type === 'banner' ? 'Banner' : 'Imagen'}: seleccione una imagen en el panel derecho</span>
      </div>
    );
  }

  const background = field.imageBackground ? { backgroundColor: field.imageBackground } : undefined;

  if (field.type === 'banner') {
    return (
      <div className={`overflow-hidden ${bare ? '' : `${field.imageBackground ? '' : 'bg-white'} ${cardClass}`}`} style={background}>
        <img
          src={field.imageSrc}
          alt={field.title}
          style={{ height: field.imageHeight || DEFAULT_BANNER_HEIGHT }}
          className={`w-full block ${field.imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
        />
      </div>
    );
  }

  const justify = field.imageAlign === 'center' ? 'justify-center' : field.imageAlign === 'right' ? 'justify-end' : 'justify-start';
  return (
    <div className={`flex ${justify} ${field.imageBackground ? 'p-3 rounded-lg' : ''}`} style={background}>
      <img
        src={field.imageSrc}
        alt={field.title}
        style={{ width: `${field.imageWidth || DEFAULT_IMAGE_WIDTH}%` }}
        className="h-auto object-contain block"
      />
    </div>
  );
};

/** Media fields placed "above the title": banners go edge-to-edge at the top of the header card, logos sit above the title. */
export const HeaderBanners: React.FC<{ fields: FormField[] }> = ({ fields }) => (
  <>
    {fields.filter(f => isHeaderMedia(f) && f.type === 'banner').map(f => <FormMediaBlock key={f.id} field={f} bare />)}
  </>
);

export const HeaderLogos: React.FC<{ fields: FormField[] }> = ({ fields }) => {
  const logos = fields.filter(f => isHeaderMedia(f) && f.type === 'image' && f.imageSrc);
  if (logos.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      {logos.map(f => <FormMediaBlock key={f.id} field={f} />)}
    </div>
  );
};
