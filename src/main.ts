/**
 * Redirect Map QA — yükle → eşle → worker'da denetle → tablo/CSV.
 * Kullanıcı verisi innerHTML ile basılmaz; textContent / DOM API.
 */

import './style.css';
import {
  APP_NAME,
  APP_VERSION,
  MAX_COMBINED_ROWS,
  PWA_ENABLED,
  TABLE_PAGE_SIZE,
} from './config';
import { runAudits } from './lib/audit';
import { FileParseError, getXlsxVersion, parseWorkbookFile } from './lib/excel';
import { downloadFixedMapCsv, downloadIssuesCsv } from './lib/export-csv';
import { joinGsc, sortByPriority } from './lib/gsc';
import { t, type Lang } from './lib/i18n';
import { logger } from './lib/logger';
import type { NormalizeOptions } from './lib/normalize';
import {
  buildParsedUpload,
  parseGscUpload,
  parseRedirectUpload,
} from './lib/parse-redirects';
import type { ColumnRoles, FileKind } from './lib/schemas';
import { isStorageEnabled, mountStoragePanel } from './lib/storage';
import type {
  AuditSummary,
  GscRecord,
  ParsedUpload,
  RedirectRecord,
} from './lib/types';
import type {
  AuditWorkerRequest,
  AuditWorkerResponse,
} from './worker/audit.worker';

interface UploadState extends ParsedUpload {
  id: string;
}

let lang: Lang = 'tr';
let uploads: UploadState[] = [];
let records: RedirectRecord[] = [];
let summary: AuditSummary | null = null;
let page = 0;
let filter: string = 'all';
let waitingWorker: ServiceWorker | null = null;
let auditWorker: Worker | null = null;

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

function normOptions(): NormalizeOptions {
  return {
    pathCaseInsensitive: ($('opt-path-case') as HTMLInputElement).checked,
    ignoreTrailingSlash: ($('opt-trail-slash') as HTMLInputElement).checked,
    ignoreQuery: ($('opt-ignore-query') as HTMLInputElement).checked,
  };
}

function applyI18n(): void {
  document.documentElement.lang = lang;
  $('app-title').textContent = t(lang, 'title');
  document.title = t(lang, 'title');
  $('lead-text').textContent = t(lang, 'lead');
  $('privacy-note').textContent = t(lang, 'privacy');
  $('upload-heading').textContent = t(lang, 'upload');
  $('upload-label').childNodes[0]!.textContent = t(lang, 'upload') + ' ';
  ($('btn-run') as HTMLButtonElement).textContent = t(lang, 'run');
  ($('btn-download-map') as HTMLButtonElement).textContent = t(lang, 'downloadMap');
  ($('btn-download-issues') as HTMLButtonElement).textContent =
    t(lang, 'downloadIssues');
  $('options-legend').textContent = t(lang, 'options');
  $('lbl-path-case').textContent = t(lang, 'pathCase');
  $('lbl-trail-slash').textContent = t(lang, 'trailSlash');
  $('lbl-ignore-query').textContent = t(lang, 'ignoreQuery');
  $('filters-label').textContent = t(lang, 'filters');
  $('lbl-flatten').textContent = t(lang, 'flattenHint');
  $('mapping-title').textContent = t(lang, 'mapping');
}

function kindLabel(kind: FileKind): string {
  switch (kind) {
    case 'rankmath':
      return 'Rank Math';
    case 'redirection':
      return 'Redirection';
    case 'plain':
      return 'Düz CSV';
    case 'gsc':
      return 'GSC';
    default:
      return 'Bilinmiyor';
  }
}

function renderFileList(): void {
  const list = $('file-list');
  list.replaceChildren();
  let needsMapping = false;

  for (const u of uploads) {
    const row = document.createElement('div');
    row.className = 'file-row';

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.textContent = `${u.fileName} · ${u.rows.length.toLocaleString('tr-TR')} satır · ${u.confidence}`;
    const note = document.createElement('div');
    note.className = 'muted';
    note.textContent = u.notes.join(' · ') || kindLabel(u.kind);
    info.appendChild(name);
    info.appendChild(note);

    const sel = document.createElement('select');
    sel.setAttribute('aria-label', t(lang, 'kind'));
    for (const k of ['rankmath', 'redirection', 'plain', 'gsc', 'unknown'] as FileKind[]) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = kindLabel(k);
      if (k === u.kind) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      u.kind = sel.value as FileKind;
      if (u.kind === 'unknown') needsMapping = true;
      renderMapping();
      updateRunEnabled();
    });

    row.appendChild(info);
    row.appendChild(sel);
    list.appendChild(row);

    if (u.kind === 'unknown') needsMapping = true;
  }

  renderMapping();
  updateRunEnabled();
  void needsMapping;
}

function renderMapping(): void {
  const panel = $('mapping-panel');
  const forms = $('mapping-forms');
  forms.replaceChildren();

  const unknowns = uploads.filter((u) => u.kind === 'unknown');
  if (unknowns.length === 0) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  for (const u of unknowns) {
    const wrap = document.createElement('div');
    wrap.className = 'mapping-form';
    const title = document.createElement('div');
    title.textContent = u.fileName;
    title.className = 'mapping-file-title';
    wrap.appendChild(title);

    const fields: Array<{ key: keyof ColumnRoles; label: string }> = [
      { key: 'source', label: 'source' },
      { key: 'destination', label: 'destination' },
      { key: 'type', label: 'type' },
      { key: 'regex', label: 'regex' },
      { key: 'matching', label: 'matching' },
      { key: 'page', label: 'page (GSC)' },
      { key: 'clicks', label: 'clicks' },
      { key: 'impressions', label: 'impressions' },
    ];

    for (const f of fields) {
      const lab = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = f.label;
      const sel = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '—';
      sel.appendChild(empty);
      u.headers.forEach((h, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = h || `(kolon ${i})`;
        if (u.roles[f.key] === i) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        const v = sel.value;
        if (v === '') delete u.roles[f.key];
        else u.roles[f.key] = Number(v);
        updateRunEnabled();
      });
      lab.appendChild(span);
      lab.appendChild(sel);
      wrap.appendChild(lab);
    }
    forms.appendChild(wrap);
  }
}

function updateRunEnabled(): void {
  const btn = $('btn-run') as HTMLButtonElement;
  btn.disabled = uploads.length === 0;
}

async function onFilesSelected(fileList: FileList): Promise<void> {
  setStatus(t(lang, 'processing'), 'info');
  try {
    for (const file of Array.from(fileList)) {
      const parsed = await parseWorkbookFile(file);
      const upload = buildParsedUpload(file.name, parsed.headers, parsed.rows);
      uploads.push({ ...upload, id: `${file.name}-${Date.now()}-${Math.random()}` });
    }
    renderFileList();
    setStatus(
      `${uploads.length} dosya yüklendi. Denetimi çalıştırın.`,
      'ok',
    );
  } catch (err) {
    const msg =
      err instanceof FileParseError
        ? err.message
        : 'Beklenmeyen bir hata oluştu.';
    setStatus(msg, 'error');
    logger.error('Dosya işleme hatası');
  }
}

function collectRecords(): { redirects: RedirectRecord[]; gsc: GscRecord[] } {
  const opts = normOptions();
  const redirects: RedirectRecord[] = [];
  const gsc: GscRecord[] = [];

  for (const u of uploads) {
    // unknown with source+destination → treat as plain
    let kind = u.kind;
    if (
      kind === 'unknown' &&
      u.roles.source !== undefined &&
      u.roles.destination !== undefined
    ) {
      kind = 'plain';
    }
    if (
      kind === 'unknown' &&
      u.roles.page !== undefined
    ) {
      kind = 'gsc';
    }

    const effective: ParsedUpload = { ...u, kind, roles: u.roles };

    if (kind === 'gsc') {
      gsc.push(...parseGscUpload(effective, opts));
    } else if (kind !== 'unknown') {
      const batch = parseRedirectUpload(effective, redirects.length, opts);
      redirects.push(...batch);
    }
  }

  if (redirects.length > MAX_COMBINED_ROWS) {
    throw new FileParseError(
      `Birleşik satır sınırı aşıldı: ${redirects.length.toLocaleString('tr-TR')} > ${MAX_COMBINED_ROWS.toLocaleString('tr-TR')}.`,
    );
  }

  return { redirects, gsc };
}

function getWorker(): Worker {
  if (!auditWorker) {
    auditWorker = new Worker(
      new URL('./worker/audit.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return auditWorker;
}

function runAuditMainThread(
  redirects: RedirectRecord[],
  gsc: GscRecord[],
): { records: RedirectRecord[]; summary: AuditSummary } {
  joinGsc(redirects, gsc);
  const sum = runAudits(redirects, { normalize: normOptions() });
  return { records: sortByPriority(redirects), summary: sum };
}

async function onRunAudit(): Promise<void> {
  setStatus(t(lang, 'processing'), 'info');
  $('btn-run').setAttribute('disabled', 'true');

  try {
    const { redirects, gsc } = collectRecords();
    if (redirects.length === 0) {
      setStatus('Yönlendirme satırı bulunamadı.', 'error');
      updateRunEnabled();
      return;
    }

    const useWorker = typeof Worker !== 'undefined';
    if (useWorker) {
      await new Promise<void>((resolve, reject) => {
        const w = getWorker();
        const onMsg = (ev: MessageEvent<AuditWorkerResponse>) => {
          w.removeEventListener('message', onMsg);
          w.removeEventListener('error', onErr);
          if (ev.data?.type === 'audit-result') {
            records = ev.data.records;
            summary = ev.data.summary;
            resolve();
          } else {
            reject(new Error('Worker yanıtı geçersiz'));
          }
        };
        const onErr = () => {
          w.removeEventListener('message', onMsg);
          w.removeEventListener('error', onErr);
          // Fallback
          const r = runAuditMainThread(redirects, gsc);
          records = r.records;
          summary = r.summary;
          resolve();
        };
        w.addEventListener('message', onMsg);
        w.addEventListener('error', onErr);
        const req: AuditWorkerRequest = {
          type: 'audit',
          records: redirects,
          gsc,
          options: { normalize: normOptions() },
        };
        w.postMessage(req);
      });
    } else {
      const r = runAuditMainThread(redirects, gsc);
      records = r.records;
      summary = r.summary;
    }

    page = 0;
    renderSummary();
    renderTable();
    ($('btn-download-map') as HTMLButtonElement).disabled = false;
    ($('btn-download-issues') as HTMLButtonElement).disabled = false;
    setStatus(
      `${t(lang, 'done')} ${records.length.toLocaleString('tr-TR')} satır.`,
      'ok',
    );
  } catch (err) {
    const msg =
      err instanceof FileParseError ? err.message : 'Denetim başarısız.';
    setStatus(msg, 'error');
    logger.error('Denetim hatası');
  } finally {
    updateRunEnabled();
  }
}

function renderSummary(): void {
  const wrap = $('summary-wrap');
  const box = $('summary-counts');
  box.replaceChildren();
  if (!summary) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const items: Array<[string, number, string]> = [
    ['Toplam', summary.total, ''],
    ['duplicate', summary.duplicate, 'warn'],
    ['conflict', summary.conflict, 'err'],
    ['chain', summary.chain, 'warn'],
    ['loop', summary.loop, 'err'],
    ['self', summary.self, 'warn'],
    ['unsupported', summary.unsupported, ''],
    ['ok', summary.ok, 'ok'],
    ['GSC eşleşen', summary.withGsc, ''],
  ];
  for (const [label, n, cls] of items) {
    const chip = document.createElement('span');
    chip.className = cls ? `chip ${cls}` : 'chip';
    chip.textContent = `${label}: ${n.toLocaleString('tr-TR')}`;
    box.appendChild(chip);
  }
}

function filteredRecords(): RedirectRecord[] {
  if (filter === 'all') return records;
  if (filter === 'ok') return records.filter((r) => r.flags.length === 0);
  if (filter === 'flatten') return records.filter((r) => !!r.flattenTo);
  return records.filter((r) => r.flags.includes(filter as RedirectRecord['flags'][number]));
}

function renderTable(): void {
  const wrap = $('preview-wrap');
  const thead = $('preview-head');
  const tbody = $('preview-body');
  thead.replaceChildren();
  tbody.replaceChildren();

  if (!records.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  const cols = [
    '✓',
    'source',
    'destination',
    'type',
    'flags',
    'chain',
    'flatten→',
    'clicks',
    'file',
    'satır',
  ];
  const hr = document.createElement('tr');
  for (const c of cols) {
    const th = document.createElement('th');
    th.textContent = c;
    hr.appendChild(th);
  }
  thead.appendChild(hr);

  const list = filteredRecords();
  const totalPages = Math.max(1, Math.ceil(list.length / TABLE_PAGE_SIZE));
  if (page >= totalPages) page = totalPages - 1;
  const start = page * TABLE_PAGE_SIZE;
  const slice = list.slice(start, start + TABLE_PAGE_SIZE);

  for (const r of slice) {
    const tr = document.createElement('tr');
    if (r.flags[0]) tr.classList.add(`flag-${r.flags[0]}`);

    const tdCheck = document.createElement('td');
    if (r.flattenTo && !r.flags.includes('loop')) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = r.applyFlatten;
      cb.title = 'Flatten uygula';
      cb.addEventListener('change', () => {
        r.applyFlatten = cb.checked;
      });
      tdCheck.appendChild(cb);
    } else {
      tdCheck.textContent = '';
    }
    tr.appendChild(tdCheck);

    const vals = [
      r.sourceRaw,
      r.destinationRaw,
      r.type,
      r.flags.join(', ') || 'ok',
      r.chainLength ? String(r.chainLength) : '',
      r.flattenTo ?? '',
      r.gscClicks !== null ? String(r.gscClicks) : '',
      r.fileName,
      String(r.lineNo),
    ];
    for (const v of vals) {
      const td = document.createElement('td');
      td.textContent = v;
      td.title = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  $('preview-note').textContent = `Gösterilen: ${slice.length} / ${list.length} (filtre: ${filter}) · sayfa ${page + 1}/${totalPages}`;
  ($('btn-prev') as HTMLButtonElement).disabled = page <= 0;
  ($('btn-next') as HTMLButtonElement).disabled = page >= totalPages - 1;
  $('page-info').textContent = `${page + 1} / ${totalPages}`;
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
}

function setupPwaUi(): void {
  const panel = $('pwa-panel');
  if (!PWA_ENABLED) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = './manifest.webmanifest';
  document.head.appendChild(link);
  $('install-hint').textContent = `Sürüm ${APP_VERSION}. Veri sunucuya gitmez.`;
}

function init(): void {
  document.title = APP_NAME;
  applyI18n();
  $('xlsx-version').textContent = `SheetJS ${getXlsxVersion()} · v${APP_VERSION}`;

  ($('lang-select') as HTMLSelectElement).addEventListener('change', (e) => {
    lang = (e.target as HTMLSelectElement).value as Lang;
    applyI18n();
  });

  const input = $('file-input') as HTMLInputElement;
  input.addEventListener('change', () => {
    if (input.files?.length) void onFilesSelected(input.files);
    input.value = '';
  });

  $('btn-run').addEventListener('click', () => void onRunAudit());
  $('btn-download-map').addEventListener('click', () => {
    if (!records.length) return;
    downloadFixedMapCsv(records);
    setStatus('redirect-map-fixed.csv indirildi (formül kaçırması uygulandı).', 'ok');
  });
  $('btn-download-issues').addEventListener('click', () => {
    if (!records.length) return;
    downloadIssuesCsv(records);
    setStatus('redirect-map-issues.csv indirildi (formül kaçırması uygulandı).', 'ok');
  });

  ($('flag-filter') as HTMLSelectElement).addEventListener('change', (e) => {
    filter = (e.target as HTMLSelectElement).value;
    page = 0;
    renderTable();
  });

  $('btn-prev').addEventListener('click', () => {
    page = Math.max(0, page - 1);
    renderTable();
  });
  $('btn-next').addEventListener('click', () => {
    page += 1;
    renderTable();
  });

  ($('opt-select-all-flatten') as HTMLInputElement).addEventListener(
    'change',
    (e) => {
      const on = (e.target as HTMLInputElement).checked;
      for (const r of records) {
        if (r.flattenTo && !r.flags.includes('loop')) r.applyFlatten = on;
      }
      renderTable();
    },
  );

  const storagePanel = $('storage-panel');
  if (isStorageEnabled()) {
    mountStoragePanel(storagePanel, async () => {
      downloadFixedMapCsv(records);
    });
  } else {
    storagePanel.hidden = true;
  }

  setupPwaUi();
  registerServiceWorker();
  hideUpdateBanner();
  setStatus(t(lang, 'statusReady'), 'info');
  logger.info('Uygulama hazır');
}

init();
