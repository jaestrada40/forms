import React, { useEffect, useRef, useState } from 'react';
import {
  Settings,
  Building2,
  ShieldCheck,
  Mail,
  Key,
  Save,
  Database,
  Check,
  Globe,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Upload
} from 'lucide-react';
import { api, InstitutionSettings } from '../services/api';

interface SettingsViewProps {
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  isSuperAdmin: boolean;
  onBrandingUpdated?: (branding: { name: string; logoDataUrl: string | null; loginLogoDataUrl: string | null }) => void;
}

const MAX_LOGO_BYTES = 1_000_000; // 1MB raw file, before base64 encoding

const defaultSettings: InstitutionSettings = {
  name: 'Formularios Institucionales',
  allowedDomains: '',
  retentionPeriod: 'indefinite',
  enableAuditLog: true,
  logoDataUrl: null,
  loginLogoDataUrl: null,
};

export const SettingsView: React.FC<SettingsViewProps> = ({ showToast, isSuperAdmin, onBrandingUpdated }) => {
  const [settings, setSettings] = useState<InstitutionSettings>(defaultSettings);
  const [useSameLogo, setUseSameLogo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loginFileInputRef = useRef<HTMLInputElement>(null);

  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSaving, setMfaSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    api.getInstitutionSettings()
      .then((saved) => {
        setSettings(saved);
        setUseSameLogo(!saved.loginLogoDataUrl);
      })
      .catch(() => showToast('No fue posible cargar la configuración institucional.', 'error'))
      .finally(() => setLoading(false));

    setMfaLoading(true);
    api.getMfaPolicy()
      .then(({ enforced }) => setMfaEnforced(enforced))
      .catch(() => showToast('No fue posible cargar la política de MFA.', 'error'))
      .finally(() => setMfaLoading(false));
  }, [isSuperAdmin]);

  const handleToggleMfa = async () => {
    const next = !mfaEnforced;
    setMfaSaving(true);
    try {
      await api.setMfaPolicy(next);
      setMfaEnforced(next);
      showToast(
        next
          ? 'MFA obligatorio activado: todos los usuarios deberán configurarlo en su próximo inicio de sesión.'
          : 'MFA obligatorio desactivado para toda la institución.',
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible actualizar la política de MFA.', 'error');
    } finally {
      setMfaSaving(false);
    }
  };

  const handleLogoSelect = (file: File, target: 'logoDataUrl' | 'loginLogoDataUrl') => {
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(file.type)) {
      showToast('Formato no soportado. Use PNG, JPG, SVG o WEBP.', 'error');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast('La imagen es demasiado grande. Máximo 1 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSettings(prev => ({ ...prev, [target]: reader.result as string }));
    reader.onerror = () => showToast('No fue posible leer la imagen.', 'error');
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: InstitutionSettings = {
        ...settings,
        loginLogoDataUrl: useSameLogo ? null : settings.loginLogoDataUrl,
      };
      const saved = await api.updateInstitutionSettings(payload);
      setSettings(saved);
      onBrandingUpdated?.({ name: saved.name, logoDataUrl: saved.logoDataUrl, loginLogoDataUrl: saved.loginLogoDataUrl });
      showToast('Configuraciones institucionales actualizadas correctamente', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible guardar la configuración.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">
          Parámetros Globales
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Configuración del Sistema Institucional
        </h2>
        <p className="text-xs text-slate-500">
          Ajustes generales de seguridad, gobernanza de datos y personalización del organismo.
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-3">
          Solo un Administrador puede ver y modificar la configuración institucional.
        </div>
      )}

      {isSuperAdmin && (
        <form onSubmit={handleSave} className="space-y-5">
          {/* Organization identity */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-blue-700" />
              <h3 className="font-bold text-sm text-slate-900">Identidad del Organismo</h3>
              {loading && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin ml-auto" />}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Logotipo de la barra lateral
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {settings.logoDataUrl ? (
                    <img src={settings.logoDataUrl} alt="Logotipo institucional" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoSelect(file, 'logoDataUrl');
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {settings.logoDataUrl ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  {settings.logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, logoDataUrl: null }))}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Quitar
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                PNG, JPG, SVG o WEBP, máximo 1 MB. Si es una versión clara/blanca, úsela solo aquí (la barra lateral tiene fondo oscuro).
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 select-none cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={useSameLogo}
                onChange={(e) => setUseSameLogo(e.target.checked)}
                className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              Usar el mismo logo de la barra lateral para la pantalla de inicio de sesión
            </label>

            {!useSameLogo && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logotipo de la pantalla de inicio de sesión
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                    {settings.loginLogoDataUrl ? (
                      <img src={settings.loginLogoDataUrl} alt="Logotipo de inicio de sesión" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={loginFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoSelect(file, 'loginLogoDataUrl');
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => loginFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {settings.loginLogoDataUrl ? 'Cambiar logo' : 'Subir logo'}
                    </button>
                    {settings.loginLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, loginLogoDataUrl: null }))}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Se mostrará sobre la franja oscura de la pantalla de inicio de sesión. PNG, JPG, SVG o WEBP, máximo 1 MB.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre Oficial de la Institución
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dominios de Correo Institucional Permitidos
              </label>
              <input
                type="text"
                value={settings.allowedDomains}
                onChange={(e) => setSettings(prev => ({ ...prev, allowedDomains: e.target.value }))}
                placeholder="@gobierno.cl, @ministerio.cl"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Solo cuentas con estos sufijos podrán acceder como creadores o administradores.
              </p>
            </div>
          </div>

          {/* Security & Data Retention */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-sm text-slate-900">Seguridad y Resguardo de la Información</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Política de Retención de Respuestas y Folios
              </label>
              <select
                value={settings.retentionPeriod}
                onChange={(e) => setSettings(prev => ({ ...prev, retentionPeriod: e.target.value as InstitutionSettings['retentionPeriod'] }))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              >
                <option value="1_year">1 año (Ciclo operativo anual)</option>
                <option value="3_years">3 años (Normativa de auditoría ministerial)</option>
                <option value="5_years">5 años (Histórico permanente)</option>
                <option value="indefinite">Indefinido (Sin purga automática)</option>
              </select>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Registro de Auditoría Integral (Audit Log)</div>
                  <div className="text-[11px] text-slate-500">Registra modificaciones de formularios y descargas de respuestas</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings(prev => ({ ...prev, enableAuditLog: !prev.enableAuditLog }))}
                  className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${
                    settings.enableAuditLog ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                </button>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Exigir Verificación en Dos Pasos (MFA) para todos los usuarios</div>
                  <div className="text-[11px] text-slate-500">
                    Como super administrador, puede exigir MFA a toda la institución. Quien no lo tenga configurado deberá activarlo en su próximo inicio de sesión.
                  </div>
                </div>
                {mfaLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0 ml-3" />
                ) : (
                  <button
                    type="button"
                    disabled={mfaSaving}
                    onClick={handleToggleMfa}
                    className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ml-3 disabled:opacity-60 ${
                      mfaEnforced ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-xs"></div>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Guardar cambios institucionales</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
