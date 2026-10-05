/**
 * Tek kaynak CSP — vite.config, index.html meta, Netlify/Vercel header dosyaları
 * ve hiza testi buradan beslenir. 'unsafe-inline' YOK.
 */
export const CSP_POLICY =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'self'";

export const EXTRA_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy':
    'interest-cohort=(), geolocation=(), microphone=(), camera=()',
};
