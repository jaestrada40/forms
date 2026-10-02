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
import { api, CaptchaSettings, InstitutionSettings, SmtpSettings } from '../services/api';

interface SettingsViewProps {
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  isSuperAdmin: boolean;
  departments: string[];
  onDepartmentsChange: (departments: string[]) => void;
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

export const SettingsView: React.FC<SettingsViewProps> = ({ showToast, isSuperAdmin, departments, onDepartmentsChange, onBrandingUpdated }) => {
  const [settings, setSettings] = useState<InstitutionSettings>(defaultSettings);
  const [useSameLogo, setUseSameLogo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loginFileInputRef = useRef<HTMLInputElement>(null);

  const [captcha, setCaptcha] = useState<CaptchaSettings | null>(null);
  const [captchaSecret, setCaptchaSecret] = useState('');
  const [captchaBusy, setCaptchaBusy] = useState<'save' | 'verify' | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.getCaptchaSettings().then(setCaptcha).catch(() => showToast('No fue posible cargar la configuración del captcha.', 'error'));
  }, [isSuperAdmin]);

  const handleSaveCaptcha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha) return;
    setCaptchaBusy('save');
    try {
      await api.saveCaptchaSettings({ provider: captcha.provider, siteKey: captcha.siteKey, secretKey: captchaSecret || undefined, minScore: captcha.minScore });
      setCaptchaSecret('');
      setCaptcha(await api.getCaptchaSettings());
      showToast(captcha.provider === 'none' ? 'Captcha desactivado: los formularios se muestran sin verificación' : 'Captcha guardado: aparecerá en todos los formularios públicos', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible guardar el captcha.', 'error');
    } finally {
      setCaptchaBusy(null);
    }
  };

  const handleVerifyCaptcha = async () => {
    setCaptchaBusy('verify');
    try {
      const result = await api.verifyCaptchaSettings();
      showToast(
        result.checked
          ? 'La clave secreta es válida para el proveedor.'
          : 'Conexión con Google correcta. Google no permite comprobar la clave secreta sin un envío real: pruebe enviando un formulario público.',
        result.checked ? 'success' : 'info',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible verificar las credenciales.', 'error');
    } finally {
      setCaptchaBusy(null);
    }
  };

  const [smtp, setSmtp] = useState<SmtpSettings | null>(null);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.getSmtpSettings().then(setSmtp).catch(() => showToast('No fue posible cargar la configuración de correo.', 'error'));
  }, [isSuperAdmin]);

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtp) return;
    setSmtpSaving(true);
    try {
      await api.saveSmtpSettings({
        host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, from: smtp.from,
        password: smtpPassword || undefined,
      });
      setSmtpPassword('');
      setSmtp(await api.getSmtpSettings());
      showToast('Configuración de correo guardada', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible guardar la configuración de correo.', 'error');
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSmtpTest = async () => {
    setTesting(true);
    try {
      await api.sendSmtpTest(testTo.trim());
      showToast(`Correo de prueba enviado a ${testTo.trim()}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible enviar el correo de prueba.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const [newDepartment, setNewDepartment] = useState('');
  const [deptSaving, setDeptSaving] = useState(false);

  const saveDepartments = async (next: string[]) => {
    setDeptSaving(true);
    try {
      onDepartmentsChange(await api.saveDepartments(next));
      setNewDepartment('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible guardar los departamentos.', 'error');
    } finally {
      setDeptSaving(false);
    }
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDepartment.trim();
    if (name.length < 2) return;
    if (departments.some(d => d.toLowerCase() === name.toLowerCase())) {
      showToast('Ese departamento ya existe.', 'info');
      return;
    }
    saveDepartments([...departments, name]);
  };

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
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-blue-700" />
            <h3 className="font-bold text-sm text-slate-900">Departamentos</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Estos departamentos aparecen al crear usuarios y al asignar la unidad responsable de un formulario.
          </p>
          <form onSubmit={handleAddDepartment} className="flex gap-2">
            <input
              type="text"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="Ej: Dirección de Informática"
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={deptSaving || newDepartment.trim().length < 2}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-xs font-semibold"
            >
              Agregar
            </button>
          </form>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {departments.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Aún no hay departamentos.</li>}
            {departments.map(d => (
              <li key={d} className="px-3 py-2 text-xs text-slate-700 flex items-center justify-between">
                <span>{d}</span>
                <button
                  type="button"
                  disabled={deptSaving}
                  onClick={() => saveDepartments(departments.filter(x => x !== d))}
                  className="p-1 text-slate-400 hover:text-rose-600"
                  title="Eliminar departamento"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isSuperAdmin && captcha && (
        <form onSubmit={handleSaveCaptcha} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <h3 className="font-bold text-sm text-slate-900">Captcha anti-spam</h3>
            <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              captcha.provider === 'none' || !captcha.hasSecret ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {captcha.provider === 'none' ? 'Sin configurar' : captcha.hasSecret ? 'Activo en todos los formularios' : 'Falta la clave secreta'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Si lo configura, el captcha aparece al final de <strong>cada formulario público</strong> (cada formulario puede excluirse en su pestaña Configuración).
            Mientras no lo configure, los formularios se ven y se responden con normalidad, sin verificación.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Proveedor</label>
            <select
              value={captcha.provider}
              onChange={(e) => setCaptcha({ ...captcha, provider: e.target.value as CaptchaSettings['provider'] })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            >
              <option value="none">Ninguno (sin captcha)</option>
              <option value="turnstile">Cloudflare Turnstile</option>
              <option value="hcaptcha">hCaptcha</option>
              <option value="recaptcha">Google reCAPTCHA v2 (casilla «No soy un robot»)</option>
              <option value="recaptcha3">Google reCAPTCHA v3 (invisible, por puntaje)</option>
            </select>
          </div>

          {captcha.provider !== 'none' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clave del sitio (pública)</label>
                  <input type="text" autoComplete="off" value={captcha.siteKey} onChange={(e) => setCaptcha({ ...captcha, siteKey: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Clave secreta</label>
                  <input type="password" autoComplete="new-password" value={captchaSecret}
                    placeholder={captcha.hasSecret ? '•••••••• (guardada; escriba para cambiarla)' : ''}
                    onChange={(e) => setCaptchaSecret(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
                </div>
              </div>
              {captcha.provider === 'recaptcha3' && (
                <div>
                  <label className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>Puntaje mínimo para aceptar un envío</span>
                    <span className="font-mono text-slate-500">{(captcha.minScore ?? 0.5).toFixed(1)}</span>
                  </label>
                  <input
                    type="range" min={0.1} max={0.9} step={0.1}
                    value={captcha.minScore ?? 0.5}
                    onChange={(e) => setCaptcha({ ...captcha, minScore: Number(e.target.value) })}
                    className="w-full accent-blue-700"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    0.5 es el valor recomendado por Google. Si personas reales son rechazadas, bájelo; si pasa demasiado spam, súbalo. Con v3 no hay desafío: un envío con puntaje bajo se rechaza.
                  </p>
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                {captcha.provider === 'turnstile' && 'Cree un widget en dash.cloudflare.com → Turnstile y agregue su dominio. Gratuito.'}
                {captcha.provider === 'hcaptcha' && 'Cree un sitio en dashboard.hcaptcha.com y copie la clave del sitio y la clave secreta de su cuenta.'}
                {captcha.provider === 'recaptcha3' && 'Cree la clave en la consola de Google Cloud (reCAPTCHA) con el tipo «Puntaje» (v3) y agregue su dominio. No muestra casilla: Google puntúa cada envío de 0 (robot) a 1 (persona).'}
                {captcha.provider === 'recaptcha' && 'Cree la clave en la consola de Google Cloud (reCAPTCHA) con el tipo «Casilla» (v2) y agregue su dominio. Las claves antiguas de v2 siguen funcionando.'}
                {' '}Las claves de prueba del proveedor también sirven. La clave secreta se guarda cifrada y nunca se envía al navegador.
              </p>
            </>
          )}

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button type="button" disabled={captchaBusy !== null || captcha.provider === 'none' || !captcha.hasSecret} onClick={handleVerifyCaptcha}
              className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg flex items-center gap-1.5">
              {captchaBusy === 'verify' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Verificar conexión y clave
            </button>
            <button type="submit" disabled={captchaBusy !== null}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
              {captchaBusy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar captcha
            </button>
          </div>
        </form>
      )}

      {isSuperAdmin && smtp && (
        <form onSubmit={handleSaveSmtp} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Mail className="w-4 h-4 text-blue-700" />
            <h3 className="font-bold text-sm text-slate-900">Servidor de correo (SMTP)</h3>
            <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              smtp.source === 'none' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {smtp.source === 'none' ? 'Sin configurar' : smtp.source === 'env' ? 'Configurado en variables de entorno' : 'Configurado'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Se usa para los avisos de nuevas respuestas y los reportes programados. Escriba <code className="font-mono">console</code> como servidor para probar sin enviar correos reales (se muestran en el registro del servidor).
            {smtp.source === 'env' && ' Mientras no guarde datos aquí, se usan las variables SMTP_* del archivo .env.'}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Servidor</label>
              <input type="text" value={smtp.host} placeholder="smtp.minfin.gob.gt" onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Puerto</label>
              <input type="number" min={1} max={65535} value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) || 587 })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={smtp.secure} onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })} className="accent-blue-700" />
            Conexión segura SSL/TLS directa (normalmente puerto 465; con 587 déjelo apagado)
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Usuario</label>
              <input type="text" autoComplete="off" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña</label>
              <input type="password" autoComplete="new-password" value={smtpPassword}
                placeholder={smtp.hasPassword ? '•••••••• (guardada; escriba para cambiarla)' : ''}
                onChange={(e) => setSmtpPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remitente (From)</label>
            <input type="text" value={smtp.from} placeholder="Formularios <formularios@minfin.gob.gt>" onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2">
              <input type="email" value={testTo} placeholder="correo para la prueba" onChange={(e) => setTestTo(e.target.value)}
                className="w-56 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600" />
              <button type="button" disabled={testing || !testTo.trim() || smtp.source === 'none'} onClick={handleSmtpTest}
                className="px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 rounded-lg flex items-center gap-1.5">
                {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enviar prueba
              </button>
            </div>
            <button type="submit" disabled={smtpSaving}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-xs font-semibold flex items-center gap-2">
              {smtpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar correo
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Guarde primero y luego envíe la prueba. Dejar el servidor vacío y guardar elimina esta configuración.</p>
        </form>
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
                placeholder="@minfin.gob.gt"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Los usuarios con rol Administrador o Creador deben tener un correo con alguno de estos dominios (sepárelos con comas). Déjelo vacío para no restringir. Se valida al crear o editar usuarios.
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
              {settings.retentionPeriod !== 'indefinite' ? (
                <p className="text-[11px] text-rose-700 mt-1 font-medium">
                  Atención: una vez guardada, el sistema eliminará de forma permanente y automática (una vez al día) todas las respuestas
                  con más antigüedad que este período. Descargue una copia antes de activarla.
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Las respuestas se conservan sin límite de tiempo.</p>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-900">Registro de Auditoría Integral (Audit Log)</div>
                  <div className="text-[11px] text-slate-500">Registra inicios de sesión, cambios de formularios, usuarios y ajustes. Si lo desactiva, deja de registrarse nueva actividad</div>
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
