import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CSP_POLICY } from '../shared/csp.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pagesOrigin = 'https://liarzpl.github.io/redirect-map-qa/';

function meta(attr: 'property' | 'name', key: string): string | undefined {
  const re = new RegExp(
    `<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`,
    'i',
  );
  return html.match(re)?.[1];
}

describe('link preview meta', () => {
  it('Open Graph title, description, url, and image are set', () => {
    expect(meta('property', 'og:title')).toBe('Redirect Map QA');
    expect(meta('property', 'og:description')).toMatch(/redirect/i);
    expect(meta('property', 'og:url')).toBe(pagesOrigin);
    expect(meta('property', 'og:image')).toBe(`${pagesOrigin}og.png`);
    expect(meta('property', 'og:image:width')).toBe('1280');
    expect(meta('property', 'og:image:height')).toBe('640');
  });

  it('Twitter card title, description, url, and image are set', () => {
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('name', 'twitter:title')).toBe('Redirect Map QA');
    expect(meta('name', 'twitter:description')).toBe(meta('property', 'og:description'));
    expect(meta('name', 'twitter:url')).toBe(pagesOrigin);
    expect(meta('name', 'twitter:image')).toBe(`${pagesOrigin}og.png`);
  });

  it('og image exists at the Pages path and is 1280x640', () => {
    const file = path.join(root, 'public', 'og.png');
    expect(fs.existsSync(file)).toBe(true);
    const buf = fs.readFileSync(file);
    expect(buf.readUInt32BE(16)).toBe(1280);
    expect(buf.readUInt32BE(20)).toBe(640);
  });

  it('preview tags do not widen the shared CSP', () => {
    const metaCsp = html.match(
      /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
    );
    expect(metaCsp?.[1]).toBe(CSP_POLICY);
    expect(CSP_POLICY).toContain("img-src 'self'");
    expect(CSP_POLICY).not.toMatch(/unsafe-inline/);
    expect(html).not.toMatch(/<img\b[^>]*\bsrc="https?:/i);
    expect(html).not.toMatch(/<script\b(?![^>]*\bsrc=)[^>]*>/i);
  });
});
