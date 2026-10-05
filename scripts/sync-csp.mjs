#!/usr/bin/env node
/**
 * shared/csp.mjs → index.html meta, public/_headers, netlify.toml, vercel.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CSP_POLICY, EXTRA_SECURITY_HEADERS } from '../shared/csp.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function write(rel, content) {
  const full = path.join(root, rel);
  fs.writeFileSync(full, content, 'utf8');
  console.info('csp-sync:', rel);
}

// index.html — meta content=
{
  const rel = 'index.html';
  let html = fs.readFileSync(path.join(root, rel), 'utf8');
  const next = html.replace(
    /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i,
    `$1${CSP_POLICY}$3`,
  );
  if (next === html && !html.includes('Content-Security-Policy')) {
    throw new Error('index.html CSP meta bulunamadı');
  }
  write(rel, next);
}

// public/_headers (Netlify / Cloudflare Pages)
{
  const lines = [
    '/*',
    `  Content-Security-Policy: ${CSP_POLICY}`,
    ...Object.entries(EXTRA_SECURITY_HEADERS).map(
      ([k, v]) => `  ${k}: ${v}`,
    ),
    '',
  ];
  write('public/_headers', lines.join('\n'));
}

// netlify.toml
{
  const headerLines = Object.entries(EXTRA_SECURITY_HEADERS)
    .map(([k, v]) => `    ${k} = "${v}"`)
    .join('\n');
  const toml = `[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "${CSP_POLICY}"
${headerLines}
`;
  write('netlify.toml', toml);
}

// vercel.json
{
  const headers = [
    { key: 'Content-Security-Policy', value: CSP_POLICY },
    ...Object.entries(EXTRA_SECURITY_HEADERS).map(([key, value]) => ({
      key,
      value,
    })),
  ];
  const json = {
    headers: [{ source: '/(.*)', headers }],
  };
  write('vercel.json', JSON.stringify(json, null, 2) + '\n');
}

console.info('CSP hizalandı:', CSP_POLICY);
