import React, { useEffect, useRef, useState } from 'react';

export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'recaptcha';

interface ProviderScript { src: string; global: 'turnstile' | 'hcaptcha' | 'grecaptcha' }

const SCRIPTS: Record<CaptchaProvider, ProviderScript> = {
  turnstile: { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', global: 'turnstile' },
  hcaptcha: { src: 'https://js.hcaptcha.com/1/api.js?render=explicit', global: 'hcaptcha' },
  recaptcha: { src: 'https://www.google.com/recaptcha/api.js?render=explicit', global: 'grecaptcha' },
};

const loading = new Map<CaptchaProvider, Promise<any>>();

/** Loads the provider's script once and resolves with its global API object. */
function loadProvider(provider: CaptchaProvider): Promise<any> {
  const cached = loading.get(provider);
  if (cached) return cached;
  const { src, global } = SCRIPTS[provider];
  const promise = new Promise<any>((resolve, reject) => {
    const ready = () => {
      const api = (window as any)[global];
      if (!api) return reject(new Error('missing'));
      // reCAPTCHA exposes render only after ready()
      if (provider === 'recaptcha' && typeof api.ready === 'function') api.ready(() => resolve(api));
      else resolve(api);
    };
    if ((window as any)[global]) return ready();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = ready;
    script.onerror = () => { script.remove(); reject(new Error('blocked')); };
    document.head.appendChild(script);
  });
  // A failed load must be retryable
  promise.catch(() => loading.delete(provider));
  loading.set(provider, promise);
  return promise;
}

interface CaptchaWidgetProps {
  provider: CaptchaProvider;
  siteKey: string;
  /** Called with the token when the person solves it, or null when it expires or errors. */
  onToken: (token: string | null) => void;
  /** Change this value to reset the widget (e.g. after a failed submission: tokens are single-use). */
  resetKey?: number;
}

export const CaptchaWidget: React.FC<CaptchaWidgetProps> = ({ provider, siteKey, onToken, resetKey = 0 }) => {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | number | null>(null);
  const apiRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    loadProvider(provider)
      .then(api => {
        if (cancelled || !container.current) return;
        apiRef.current = api;
        container.current.replaceChildren(); // clear any previous render before drawing the widget
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      try { if (widgetId.current !== null) apiRef.current?.remove?.(widgetId.current); } catch { /* widget already gone */ }
      widgetId.current = null;
      onTokenRef.current(null);
    };
  }, [provider, siteKey, attempt]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current !== null) {
      try { apiRef.current?.reset?.(widgetId.current); } catch { /* ignore */ }
      onTokenRef.current(null);
    }
  }, [resetKey]);

  if (failed) {
    return (
      <div className="text-xs text-rose-600">
        No se pudo cargar la verificación anti-spam (revise su conexión o si un bloqueador la impide).{' '}
        <button type="button" onClick={() => setAttempt(a => a + 1)} className="font-semibold underline">Reintentar</button>
      </div>
    );
  }
  return <div ref={container} className="min-h-[65px]" />;
};

// ---------------------------------------------------------------------------
// reCAPTCHA v3: no widget. The script is loaded with the site key and a token is requested when the form is sent.
// ---------------------------------------------------------------------------

const v3Loading = new Map<string, Promise<any>>();

function loadRecaptchaV3(siteKey: string): Promise<any> {
  const cached = v3Loading.get(siteKey);
  if (cached) return cached;
  const promise = new Promise<any>((resolve, reject) => {
    const ready = () => {
      const api = (window as any).grecaptcha;
      if (api?.ready) api.ready(() => resolve(api)); else reject(new Error('missing'));
    };
    if ((window as any).grecaptcha?.execute) return ready();
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = ready;
    script.onerror = () => { script.remove(); reject(new Error('blocked')); };
    document.head.appendChild(script);
  });
  promise.catch(() => v3Loading.delete(siteKey));
  v3Loading.set(siteKey, promise);
  return promise;
}

/** Loads reCAPTCHA v3 early (so its badge shows and the first submit is fast). Safe to call repeatedly. */
export const preloadRecaptchaV3 = (siteKey: string) => { loadRecaptchaV3(siteKey).catch(() => undefined); };

/** Asks Google for a token for this action. Rejects when the script is blocked or the key is invalid. */
export async function getRecaptchaV3Token(siteKey: string, action = 'submit'): Promise<string> {
  const api = await loadRecaptchaV3(siteKey);
  return api.execute(siteKey, { action });
}
