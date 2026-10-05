import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { CSP_POLICY } from './shared/csp.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
) as { version: string };

function generateSwPlugin(): Plugin {
  return {
    name: 'generate-sw',
    closeBundle() {
      spawnSync(process.execPath, [path.join(root, 'scripts/generate-sw.mjs')], {
        stdio: 'inherit',
      });
    },
  };
}

function injectCspPlugin(): Plugin {
  return {
    name: 'inject-csp-meta',
    transformIndexHtml(html) {
      return html.replace(
        /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i,
        `$1${CSP_POLICY}$3`,
      );
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    headers: {
      'Content-Security-Policy': CSP_POLICY,
    },
  },
  preview: {
    headers: {
      'Content-Security-Policy': CSP_POLICY,
    },
  },
  plugins: [injectCspPlugin(), generateSwPlugin()],
});
