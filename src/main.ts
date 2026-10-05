/**
 * Demo akış: yükle → kolon eşle → eksikleri göster → önizleme → kaçırılmış çıktı indir.
 * Kullanıcı verisi innerHTML ile basılmaz; textContent / DOM API kullanılır.
 * Konsola kullanıcı verisi yazılmaz.
 */

import './style.css';
import {
  APP_NAME,
  APP_VERSION,
  PWA_ENABLED,
  REQUIRED_COLUMNS,
} from './config';
import {
  formatMissingColumnsError,
  matchColumns,
  pickMatchedValues,
} from './lib/columns';
import {
  downloadEscapedWorkbook,
  FileParseError,
  getXlsxVersion,
  parseWorkbookFile,
  type SheetRow,
} from './lib/excel';
import { logger } from './lib/logger';
import { isStorageEnabled, mountStoragePanel } from './lib/storage';

interface DemoState {
  headers: string[];
  rows: SheetRow[];
  matchedRows: Record<string, unknown>[];
  missing: string[];
}

let state: DemoState | null = null;
let waitingWorker: ServiceWorker | null = null;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Eksik eleman: ${id}`);
  return el;
}

function setStatus(message: string, kind: 'info' | 'error' | 'ok' = 'info'): void {
  const el = $('status');
  el.textContent = message;
  el.dataset.kind = kind;
}

function clearPreview(): void {
  const thead = $('preview-head');
  const tbody = $('preview-body');
  thead.replaceChildren();
  tbody.replaceChildren();
  $('preview-wrap').hidden = true;
  $('btn-download-xlsx').setAttribute('disabled', 'true');
  $('btn-download-csv').setAttribute('disabled', 'true');
}

function renderPreview(matchedRows: Record<string, unknown>[]): void {
  const thead = $('preview-head');
  const tbody = $('preview-body');
  thead.replaceChildren();
  tbody.replaceChildren();

  const headRow = document.createElement('tr');
  for (const col of REQUIRED_COLUMNS) {
    const th = document.createElement('th');
    th.textContent = col;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const maxPreview = 50;
  const slice = matchedRows.slice(0, maxPreview);
  for (const rec of slice) {
    const tr = document.createElement('tr');
    for (const col of REQUIRED_COLUMNS) {
      const td = document.createElement('td');
      const val = rec[col];
      td.textContent = val === null || val === undefined ? '' : String(val);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  $('preview-wrap').hidden = false;
  const note = $('preview-note');
  if (matchedRows.length > maxPreview) {
    note.textContent = `Önizleme: ilk ${maxPreview} / ${matchedRows.length} satır.`;
  } else {
    note.textContent = `Önizleme: ${matchedRows.length} satır.`;
  }
}

async function onFileSelected(file: File): Promise<void> {
  clearPreview();
  state = null;
  setStatus('Dosya işleniyor…', 'info');

  try {
    const parsed = await parseWorkbookFile(file);
    const { matched, missing } = matchColumns(parsed.headers, REQUIRED_COLUMNS);

    if (missing.length > 0) {
      setStatus(formatMissingColumnsError(missing), 'error');
      state = {
        headers: parsed.headers,
        rows: parsed.rows,
        matchedRows: [],
        missing,
      };
      return;
    }

    const matchedRows = parsed.rows.map((row) =>
      pickMatchedValues(row, matched, REQUIRED_COLUMNS),
    );

    state = {
      headers: [...REQUIRED_COLUMNS],
      rows: matchedRows.map((r) => REQUIRED_COLUMNS.map((c) => r[c])),
      matchedRows,
      missing: [],
    };

    renderPreview(matchedRows);
    $('btn-download-xlsx').removeAttribute('disabled');
    $('btn-download-csv').removeAttribute('disabled');
    setStatus(
      `Hazır: ${matchedRows.length.toLocaleString('tr-TR')} satır eşlendi. SheetJS ${getXlsxVersion()}.`,
      'ok',
    );
  } catch (err) {
    const msg =
      err instanceof FileParseError
        ? err.message
        : 'Beklenmeyen bir hata oluştu. Dosyayı kontrol edip yeniden deneyin.';
    setStatus(msg, 'error');
    logger.error('Dosya işleme hatası');
  }
}

function onDownload(bookType: 'xlsx' | 'csv'): void {
  if (!state || state.missing.length > 0 || state.rows.length === 0) {
    setStatus('İndirmeden önce geçerli bir dosya yükleyin.', 'error');
    return;
  }
  const name =
    bookType === 'csv' ? 'sonuc-kacirilmis.csv' : 'sonuc-kacirilmis.xlsx';
  downloadEscapedWorkbook(state.headers, state.rows, name, bookType);
  setStatus(`«${name}» indirildi (formül kaçırması uygulandı).`, 'ok');
}

function showUpdateBanner(): void {
  const banner = $('update-banner');
  $('update-banner-text').textContent =
    'Yeni sürüm hazır. Güncellemek için Yenile’ye basın.';
  banner.hidden = false;
}

function hideUpdateBanner(): void {
  $('update-banner').hidden = true;
}

function registerServiceWorker(): void {
  if (!PWA_ENABLED) return;
  if (!('serviceWorker' in navigator)) return;

  void navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      logger.info('Service worker kayıtlı');

      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorker = reg.waiting;
        showUpdateBanner();
      }

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (
            installing.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            waitingWorker = installing;
            showUpdateBanner();
          }
        });
      });
    })
    .catch(() => logger.warn('Service worker kaydı başarısız'));

  $('btn-refresh').addEventListener('click', () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    hideUpdateBanner();
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Yeni SW devraldı — bir kez yenile
  });
}

function setupPwaUi(): void {
  const panel = $('pwa-panel');
  if (!PWA_ENABLED) {
    panel.hidden = true;
    // Manifest linkini yalnızca PWA açıkken ekle
    return;
  }

  panel.hidden = false;
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = './manifest.webmanifest';
  document.head.appendChild(link);

  $('install-hint').textContent =
    `Ana ekrana ekleme: Chrome/Edge menü → «Uygulamayı yükle» veya «Ana ekrana ekle». Safari (iOS): Paylaş → Ana Ekrana Ekle. Veri sunucuya gitmez. Sürüm ${APP_VERSION}.`;
}

function init(): void {
  document.title = APP_NAME;
  $('app-title').textContent = APP_NAME;
  $('required-cols').textContent = REQUIRED_COLUMNS.join(', ');

  const versionEl = $('xlsx-version');
  versionEl.textContent = `SheetJS (xlsx) ${getXlsxVersion()} · v${APP_VERSION}`;

  const input = $('file-input') as HTMLInputElement;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void onFileSelected(file);
  });

  $('btn-download-xlsx').addEventListener('click', () => onDownload('xlsx'));
  $('btn-download-csv').addEventListener('click', () => onDownload('csv'));

  const storagePanel = $('storage-panel');
  if (isStorageEnabled()) {
    mountStoragePanel(storagePanel, async () => {
      if (!state) return;
      downloadEscapedWorkbook(
        state.headers,
        state.rows,
        'yerel-yedek.xlsx',
        'xlsx',
      );
    });
  } else {
    storagePanel.hidden = true;
  }

  setupPwaUi();
  registerServiceWorker();
  clearPreview();
  hideUpdateBanner();
  setStatus('Bir Excel veya CSV dosyası seçin.', 'info');
  logger.info('Uygulama hazır');
}

init();
