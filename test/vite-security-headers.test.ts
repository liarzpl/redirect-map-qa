import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';
import { CSP_POLICY, EXTRA_SECURITY_HEADERS } from '../shared/csp.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': EXTRA_SECURITY_HEADERS['Permissions-Policy'],
  'Cross-Origin-Opener-Policy': 'same-origin',
};

describe('Vite preview güvenlik başlıkları', () => {
  it('gerekli başlıkları içerir ve CSP index.html meta ile birebir', () => {
    const headers = viteConfig.preview?.headers as
      | Record<string, string>
      | undefined;
    expect(headers).toBeDefined();

    for (const [key, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(headers?.[key]).toBe(value);
    }

    for (const [key, value] of Object.entries(EXTRA_SECURITY_HEADERS)) {
      expect(headers?.[key]).toBe(value);
    }

    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const meta = html.match(
      /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
    );
    expect(meta?.[1]).toBe(CSP_POLICY);
    expect(headers?.['Content-Security-Policy']).toBe(meta?.[1]);
  });

  it('server aynı başlıkları kullanır', () => {
    expect(viteConfig.server?.headers).toEqual(viteConfig.preview?.headers);
  });
});
