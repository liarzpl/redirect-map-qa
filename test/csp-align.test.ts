import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CSP_POLICY } from '../shared/csp.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('CSP hizası (tek kaynak shared/csp.mjs)', () => {
  it('style-src unsafe-inline içermez; font-src ve worker-src self', () => {
    expect(CSP_POLICY).not.toMatch(/unsafe-inline/);
    expect(CSP_POLICY).toContain("style-src 'self'");
    expect(CSP_POLICY).toContain("font-src 'self'");
    expect(CSP_POLICY).toContain("worker-src 'self'");
    expect(CSP_POLICY).toContain("connect-src 'self'");
  });

  it('index.html meta CSP ile birebir', () => {
    const html = read('index.html');
    const m = html.match(
      /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
    );
    expect(m?.[1]).toBe(CSP_POLICY);
  });

  it('public/_headers CSP ile birebir', () => {
    const headers = read('public/_headers');
    expect(headers).toContain(`Content-Security-Policy: ${CSP_POLICY}`);
  });

  it('netlify.toml CSP ile birebir', () => {
    const toml = read('netlify.toml');
    expect(toml).toContain(`Content-Security-Policy = "${CSP_POLICY}"`);
  });

  it('vercel.json CSP ile birebir', () => {
    const json = JSON.parse(read('vercel.json')) as {
      headers: Array<{ headers: Array<{ key: string; value: string }> }>;
    };
    const csp = json.headers[0]?.headers.find(
      (h) => h.key === 'Content-Security-Policy',
    );
    expect(csp?.value).toBe(CSP_POLICY);
  });

  it('vite.config.ts shared/csp.mjs kullanır', () => {
    const vite = read('vite.config.ts');
    expect(vite).toContain("from './shared/csp.mjs'");
    expect(vite).toContain('CSP_POLICY');
    expect(vite).not.toMatch(/unsafe-inline/);
  });
});
