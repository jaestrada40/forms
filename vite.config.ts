import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// 'self' lets the app frame itself only. To embed public forms in another site, add that origin, e.g.
// "frame-ancestors 'self' https://www.ejemplo.gob.gt"
const SECURITY_HEADERS = {
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiOrigin = (() => { try { return new URL(env.VITE_API_URL || 'http://localhost:4000').origin; } catch { return ''; } })();
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // Content-Security-Policy for production builds only (the dev server needs inline scripts and websockets for HMR).
        // frame-ancestors cannot be set from a <meta>: configure it as a header on the web server that serves the build.
        name: 'inject-csp',
        apply: 'build' as const,
        transformIndexHtml: () => [{
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: [
              "default-src 'self'",
              // The captcha providers (Turnstile, hCaptcha, reCAPTCHA) load a script and an iframe from their own hosts
              "script-src 'self' https://challenges.cloudflare.com https://js.hcaptcha.com https://*.hcaptcha.com https://www.google.com https://www.gstatic.com",
              "frame-src https://challenges.cloudflare.com https://*.hcaptcha.com https://hcaptcha.com https://www.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.hcaptcha.com https://hcaptcha.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://www.gstatic.com",
              `connect-src 'self' ${apiOrigin} https://*.hcaptcha.com https://hcaptcha.com https://challenges.cloudflare.com`.trim(),
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          injectTo: 'head-prepend' as const,
        }],
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // frame-ancestors only works as an HTTP header (not in a <meta>), so set it for `vite` and `vite preview`.
    // For a real deployment see public/_headers and the "Cabeceras de seguridad" section of the README.
    preview: { headers: SECURITY_HEADERS },
    server: {
      headers: SECURITY_HEADERS,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
