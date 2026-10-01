import React, { useEffect, useState } from 'react';
import { Landmark, Loader2, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { api, session, SessionUser, MfaSetupInfo, BrandingInfo } from '../services/api';

interface LoginViewProps {
  onLoggedIn: (user: SessionUser) => void;
}

const REMEMBERED_EMAIL_KEY = 'formularios_remembered_email';

const TOTP_STEP_SECONDS = 30;

function useTotpCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(() => TOTP_STEP_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_STEP_SECONDS));

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(TOTP_STEP_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_STEP_SECONDS));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return secondsLeft;
}

const MfaCodeStep: React.FC<{
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
  onCancel: () => void;
}> = ({ title, description, loading, error, onSubmit, onCancel }) => {
  const [code, setCode] = useState('');
  const secondsLeft = useTotpCountdown();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length === 6) onSubmit(code.trim());
  };

  return (
    <div>
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 text-center">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Código de verificación</label>
            <span className="text-xs tabular-nums text-slate-400">Expira en {secondsLeft}s</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="000000"
          />
          <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / TOTP_STEP_SECONDS) * 100}%` }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Verificar código
        </button>
        <button type="button" onClick={onCancel} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1">
          Cancelar y volver
        </button>
      </form>
    </div>
  );
};

export const LoginView: React.FC<LoginViewProps> = ({ onLoggedIn }) => {
  const [step, setStep] = useState<'credentials' | 'mfa-verify' | 'mfa-setup-qr' | 'mfa-setup-code'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(false);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaSetup, setMfaSetup] = useState<MfaSetupInfo | null>(null);

  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  useEffect(() => {
    try {
      const remembered = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (remembered) {
        setEmail(remembered);
        setRememberUser(true);
      }
    } catch { /* localStorage unavailable */ }

    api.getBranding()
      .then(setBranding)
      .catch(() => { /* fall back to default branding */ })
      .finally(() => setBrandingLoaded(true));
  }, []);

  const persistRememberedEmail = (value: string) => {
    try {
      if (rememberUser) localStorage.setItem(REMEMBERED_EMAIL_KEY, value);
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch { /* localStorage unavailable */ }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.login(email.trim(), password);
      persistRememberedEmail(email.trim());

      if ('mfaRequired' in result && result.mfaRequired) {
        setMfaToken(result.mfaToken);
        setStep('mfa-verify');
        return;
      }

      if ('mfaSetupRequired' in result && result.mfaSetupRequired) {
        setMfaToken(result.mfaToken);
        setLoading(true);
        const setupInfo = await api.mfaSetup(result.mfaToken);
        setMfaSetup(setupInfo);
        setStep('mfa-setup-qr');
        return;
      }

      session.save(result);
      onLoggedIn(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (code: string) => {
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.mfaVerify(mfaToken, code);
      onLoggedIn(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateCode = async (code: string) => {
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.mfaActivate(mfaToken, code);
      onLoggedIn(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    } finally {
      setLoading(false);
    }
  };

  const resetToCredentials = () => {
    setStep('credentials');
    setMfaToken(null);
    setMfaSetup(null);
    setError(null);
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a2847] via-[#0d3a63] to-[#0a2847]">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden">
        {step === 'credentials' && (
          <>
            <div className="flex flex-col items-center pt-8 px-6">
              {!brandingLoaded ? (
                <div className="w-20 h-16 rounded-lg bg-slate-100 animate-pulse" />
              ) : (branding?.loginLogoDataUrl || branding?.logoDataUrl) ? (
                <img src={branding.loginLogoDataUrl || branding.logoDataUrl!} alt={branding.name} className="max-h-16 max-w-[260px] object-contain" />
              ) : (
                <>
                  <div className="w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center mb-3">
                    <Landmark className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-lg font-semibold text-slate-900">{branding?.name || 'Formularios Institucionales'}</h1>
                </>
              )}
            </div>
            <div className="px-8 pt-5 pb-8">
            <p className="text-sm text-slate-500 text-center mb-5">Inicie sesión para continuar</p>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Correo institucional</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="admin@ejemplo.gob.gt"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                Recordar correo
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#0d3a63] hover:bg-[#0a2847] disabled:opacity-60 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors shadow-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Iniciar sesión
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setForgotPasswordNotice(true)}
                  className="text-sm text-blue-700 hover:text-blue-900 hover:underline"
                >
                  ¿Olvidó su contraseña?
                </button>
                {forgotPasswordNotice && (
                  <p className="text-xs text-slate-500 mt-2">
                    Contacte a su Administrador institucional para restablecer su contraseña.
                  </p>
                )}
              </div>
            </form>
            </div>
          </>
        )}

        {step === 'mfa-verify' && (
          <div className="p-8">
            <MfaCodeStep
              title="Verificación en dos pasos"
              description="Ingrese el código de 6 dígitos de su aplicación de autenticación."
              loading={loading}
              error={error}
              onSubmit={handleVerifyCode}
              onCancel={resetToCredentials}
            />
          </div>
        )}

        {step === 'mfa-setup-qr' && mfaSetup && (
          <div className="p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center mb-3">
                <KeyRound className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900">Configure la verificación en dos pasos</h1>
              <p className="text-sm text-slate-500 text-center">Esta institución exige doble factor de autenticación. Escanee el código con Google Authenticator, Authy u otra app TOTP.</p>
            </div>
            <div className="flex justify-center mb-4">
              <img src={mfaSetup.qrDataUrl} alt="Código QR de verificación en dos pasos" className="w-44 h-44 rounded-lg border border-slate-200" />
            </div>
            <p className="text-xs text-slate-500 text-center mb-4">
              ¿No puede escanear? Ingrese esta clave manualmente: <span className="font-mono font-medium text-slate-700 break-all">{mfaSetup.secret}</span>
            </p>
            <button
              onClick={() => setStep('mfa-setup-code')}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Ya escaneé el código, continuar
            </button>
            <button type="button" onClick={resetToCredentials} className="w-full text-sm text-slate-500 hover:text-slate-700 py-1 mt-2">
              Cancelar
            </button>
          </div>
        )}

        {step === 'mfa-setup-code' && (
          <div className="p-8">
            <MfaCodeStep
              title="Confirme la configuración"
              description="Ingrese el código generado por su aplicación de autenticación para activar la verificación en dos pasos."
              loading={loading}
              error={error}
              onSubmit={handleActivateCode}
              onCancel={() => setStep('mfa-setup-qr')}
            />
          </div>
        )}
      </div>
    </div>
  );
};
