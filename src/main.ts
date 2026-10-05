/**
 * Redirect Map QA — yükle → önizle → denetle → tablo/CSV.
 * Kullanıcı verisi innerHTML ile basılmaz; textContent / DOM API.
 * UI: self bayrağı error şiddetinde gösterilir. audit.ts değişmez.
 * Duplicate politikası radyoları yalnız sunumdur; denetime bağlanmaz.
 */

import './tokens.css';
import './tokens.product.css';
import './style.css';
import {
  APP_NAME,
  APP_VERSION,
  MAX_COMBINED_ROWS,
  PWA_ENABLED,
  TABLE_PAGE_SIZE,
} from './config';
import { runAudits } from './lib/audit';
import { normalizeHeader } from './lib/columns';
import { FileParseError, getXlsxVersion, parseWorkbookFile } from './lib/excel';
import { downloadFixedMapCsv, downloadIssuesCsv } from './lib/export-csv';
import { joinGsc, sortByPriority } from './lib/gsc';
import { helpCodes, helpFlags, helpSeverities, t, type Lang } from './lib/i18n';
import { logger } from './lib/logger';
import type { NormalizeOptions } from './lib/normalize';
import {
  buildParsedUpload,
  parseGscUpload,
  parseRedirectUpload,
} from './lib/parse-redirects';
import { cell, type ColumnRoles, type FileKind } from './lib/schemas';
import { isStorageEnabled, mountStoragePanel } from './lib/storage';
import type {
  AuditFlag,
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

type SeverityName = 'error' | 'warning' | 'notice' | 'ok';
type SeverityFilter = 'all' | 'issues' | SeverityName;
type MetricKey = 'total' | 'issues' | 'ok';

const FLAG_PRIORITY: AuditFlag[] = [
  'loop',
  'conflict',
  'self',
  'chain',
  'duplicate',
  'unsupported',
];

const PREVIEW_N = 8;
const REDIRECT_CODES = new Set(['301', '302', '303', '304', '307']);
const KNOWN_HEADERS = new Set(
  [
    'id',
    'category',
    'status',
    'ignore',
    'hits',
    'title',
    'group',
    'source',
    'destination',
    'target',
    'sourceurl',
    'targeturl',
    'matching',
    'type',
    'regex',
    'code',
    'httpcode',
    'page',
    'toppages',
    'landingpage',
    'url',
    'clicks',
    'impressions',
    'kaynak',
    'hedef',
    'from',
    'to',
    'eskiurl',
    'oldurl',
    'yeniurl',
    'newurl',
    'sayfa',
    'sayfalar',
    'ustsayfalar',
    'encokziyaretedilensayfalar',
    'ençokziyaretedilensayfalar',
    'tiklamalar',
    'tıklamalar',
    'gosterimler',
    'gösterimler',
  ].map((name) => normalizeHeader(name)),
);
const IGNORE_ON = new Set(['1', 'yes', 'true', 'ignore', 'on']);

let lang: Lang = 'tr';
let uploads: UploadState[] = [];
let records: RedirectRecord[] = [];
let summary: AuditSummary | null = null;
let page = 0;
let filter = 'all';
let severityFilter: SeverityFilter = 'all';
let typeFilter = 'all';
let searchQuery = '';
let waitingWorker: ServiceWorker | null = null;
let auditWorker: Worker | null = null;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Eksik eleman: ${id}`);
  return el;
}

function fmt(n: number): string {
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'tr-TR');
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

/**
 * UI-only şiddet. self = error (tek adımlı loop). audit.ts hâlâ self'i ayrı sayar.
 */
function flagSeverity(flag: string): SeverityName {
  if (flag === 'loop' || flag === 'conflict' || flag === 'self') return 'error';
  if (flag === 'chain' || flag === 'duplicate') return 'warning';
  if (flag === 'unsupported') return 'notice';
  return 'ok';
}

function rowSeverity(row: RedirectRecord): SeverityName {
  if (row.flags.some((flag) => flagSeverity(flag) === 'error')) return 'error';
  if (row.flags.some((flag) => flagSeverity(flag) === 'warning')) return 'warning';
  if (row.flags.includes('unsupported')) return 'notice';
  return 'ok';
}

function applyI18n(): void {
  document.documentElement.lang = lang;
  $('app-title').textContent = t(lang, 'title');
  document.title = t(lang, 'title');
  $('lead-text').textContent = t(lang, 'lead');
  $('privacy-note').textContent = t(lang, 'privacy');
  $('upload-heading-text').textContent = t(lang, 'uploadHeading');
  $('upload-btn-text').textContent = t(lang, 'uploadButton');
  $('drop-hint').textContent = t(lang, 'dropHint');
  $('empty-hint').textContent = t(lang, 'emptyHint');
  $('step-preview-title').textContent = t(lang, 'previewTitle');
  $('preview-intro').textContent = t(lang, 'previewIntro');
  $('step-results-title').textContent = t(lang, 'resultsTitle');
  ($('btn-run') as HTMLButtonElement).textContent = t(lang, 'run');
  ($('btn-download-map') as HTMLButtonElement).textContent = t(lang, 'downloadMap');
  ($('btn-download-issues') as HTMLButtonElement).textContent = t(lang, 'downloadIssues');
  $('options-legend').textContent = t(lang, 'options');
  $('lbl-path-case').textContent = t(lang, 'pathCase');
  $('lbl-trail-slash').textContent = t(lang, 'trailSlash');
  $('lbl-ignore-query').textContent = t(lang, 'ignoreQuery');
  $('filters-label').textContent = t(lang, 'filters');
  $('lbl-flatten').textContent = t(lang, 'flattenHint');
  $('flatten-help').textContent = t(lang, 'flattenHelp');
  $('mapping-title').textContent = t(lang, 'mapping');
  $('advanced-summary').textContent = t(lang, 'advanced');
  $('dup-legend').textContent = t(lang, 'dupLegend');
  $('dup-check').textContent = t(lang, 'dupCheck');
  $('dup-ignore').textContent = t(lang, 'dupIgnore');
  $('dup-update').textContent = t(lang, 'dupUpdate');
  $('dup-note').textContent = t(lang, 'dupNote');
  $('help-summary').textContent = t(lang, 'helpSummary');
  $('filter-summary').textContent = t(lang, 'filterPanel');
  $('severity-label').textContent = t(lang, 'severityLabel');
  $('type-label').textContent = t(lang, 'typeLabel');
  $('search-label').textContent = t(lang, 'searchLabel');
  ($('row-search') as HTMLInputElement).placeholder = t(lang, 'searchPlaceholder');
  $('btn-prev').textContent = t(lang, 'prev');
  $('btn-next').textContent = t(lang, 'next');

  document.querySelectorAll<HTMLElement>('[data-sev-label]').forEach((el) => {
    if (el.dataset.sevLabel === 'all') el.textContent = t(lang, 'all');
    if (el.dataset.sevLabel === 'issues') el.textContent = t(lang, 'metricIssues');
  });

  const flagSelect = $('flag-filter') as HTMLSelectElement;
  for (const opt of flagSelect.options) {
    if (opt.value === 'all') opt.textContent = t(lang, 'all');
    if (opt.value === 'flatten') opt.textContent = t(lang, 'filterFlatten');
  }

  const typeSel = $('type-filter') as HTMLSelectElement;
  const first = typeSel.options[0];
  if (first && first.value === 'all') first.textContent = t(lang, 'all');

  renderGlossary();
}

function kindLabel(kind: FileKind): string {
  switch (kind) {
    case 'rankmath':
      return t(lang, 'kindRank');
    case 'redirection':
      return t(lang, 'kindRedir');
    case 'plain':
      return t(lang, 'kindPlain');
    case 'gsc':
      return t(lang, 'kindGsc');
    default:
      return t(lang, 'kindUnknown');
  }
}

function renderGlossary(): void {
  const body = $('help-body');
  body.replaceChildren();
  const grid = document.createElement('div');
  grid.className = 'help-grid';

  const blocks: Array<{ title: string; entries: { id: string; text: string }[] }> = [
    { title: t(lang, 'glossaryCodes'), entries: helpCodes(lang) },
    { title: t(lang, 'glossaryFlags'), entries: helpFlags(lang) },
    { title: t(lang, 'glossarySeverity'), entries: helpSeverities(lang) },
  ];

  for (const block of blocks) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.className = 'help-kicker';
    heading.textContent = block.title;
    const list = document.createElement('dl');
    for (const entry of block.entries) {
      const dt = document.createElement('dt');
      dt.textContent = entry.id;
      const dd = document.createElement('dd');
      dd.textContent = entry.text;
      list.append(dt, dd);
    }
    section.append(heading, list);
    grid.append(section);
  }
  body.append(grid);
}

function headerIndex(headers: string[], name: string): number {
  const want = normalizeHeader(name);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeader(headers[i] ?? '') === want) return i;
  }
  return -1;
}

function isInactive(row: RedirectRecord): boolean {
  const upload = uploads.find((item) => item.fileName === row.fileName);
  if (!upload) return false;
  const source = upload.rows[row.lineNo - 1];
  if (!source) return false;
  const statusIdx = headerIndex(upload.headers, 'status');
  const ignoreIdx = headerIndex(upload.headers, 'ignore');
  const status =
    statusIdx >= 0 ? String(source[statusIdx] ?? '').trim().toLowerCase() : '';
  const ignore =
    ignoreIdx >= 0 ? String(source[ignoreIdx] ?? '').trim().toLowerCase() : '';
  return status === 'inactive' || IGNORE_ON.has(ignore);
}

function renderFileList(): void {
  const list = $('file-list');
  list.replaceChildren();

  for (const upload of uploads) {
    const row = document.createElement('div');
    row.className = 'file-row';

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = upload.fileName;
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = kindLabel(upload.kind);
    const count = document.createElement('span');
    count.className = 'file-note';
    count.textContent = `${fmt(upload.rows.length)} ${t(lang, 'rowsWord')} · ${upload.confidence}`;
    meta.append(badge, count);
    info.append(name, meta);
    if (upload.notes.length) {
      const note = document.createElement('div');
      note.className = 'file-note';
      note.textContent = upload.notes.join(' · ');
      info.append(note);
    }

    const sel = document.createElement('select');
    sel.setAttribute('aria-label', t(lang, 'kind'));
    for (const kind of ['rankmath', 'redirection', 'plain', 'gsc', 'unknown'] as FileKind[]) {
      const opt = document.createElement('option');
      opt.value = kind;
      opt.textContent = kindLabel(kind);
      if (kind === upload.kind) opt.selected = true;
      sel.append(opt);
    }
    sel.addEventListener('change', () => {
      upload.kind = sel.value as FileKind;
      renderFileList();
    });

    row.append(info, sel);
    list.append(row);
  }

  $('step-preview').hidden = uploads.length === 0;
  $('empty-hint').hidden = uploads.length > 0;
  renderMapping();
  renderPreview();
  updateRunEnabled();
}

function renderMapping(): void {
  const panel = $('mapping-panel');
  const forms = $('mapping-forms');
  forms.replaceChildren();

  const unknowns = uploads.filter((upload) => upload.kind === 'unknown');
  if (unknowns.length === 0) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;

  for (const upload of unknowns) {
    const wrap = document.createElement('div');
    wrap.className = 'mapping-form';
    const title = document.createElement('div');
    title.textContent = upload.fileName;
    title.className = 'mapping-file-title';
    wrap.append(title);

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

    for (const field of fields) {
      const lab = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = field.label;
      const sel = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '—';
      sel.append(empty);
      upload.headers.forEach((header, index) => {
        const opt = document.createElement('option');
        opt.value = String(index);
        opt.textContent = header || `(kolon ${index})`;
        if (upload.roles[field.key] === index) opt.selected = true;
        sel.append(opt);
      });
      sel.addEventListener('change', () => {
        const value = sel.value;
        if (value === '') delete upload.roles[field.key];
        else upload.roles[field.key] = Number(value);
        renderPreview();
        updateRunEnabled();
      });
      lab.append(span, sel);
      wrap.append(lab);
    }
    forms.append(wrap);
  }
}

function previewWarnings(upload: UploadState): string[] {
  const warnings: string[] = [];
  const headerLine = upload.headers.join(',');
  const firstCell = String(upload.rows[0]?.[0] ?? '');
  if (
    upload.headers.length <= 1 &&
    (/[;\t]/.test(headerLine) || /[;\t]/.test(firstCell))
  ) {
    warnings.push(t(lang, 'badDelim'));
  }

  if (upload.kind === 'gsc') {
    if (upload.roles.page === undefined) warnings.push(t(lang, 'noPage'));
  } else if (upload.roles.source === undefined) {
    warnings.push(t(lang, 'noSource'));
  }

  const unmatched = upload.headers.filter((header) => {
    const name = normalizeHeader(header ?? '');
    return name.length > 0 && !KNOWN_HEADERS.has(name);
  });
  if (unmatched.length) {
    warnings.push(`${t(lang, 'unmatched')}: ${unmatched.join(', ')}`);
  }

  if (upload.kind === 'redirection' && upload.roles.type !== undefined) {
    const bad = new Set<string>();
    for (const row of upload.rows) {
      const code = cell(row, upload.roles.type);
      if (code && !REDIRECT_CODES.has(code)) bad.add(code);
    }
    if (bad.size) {
      warnings.push(`${t(lang, 'badCode')} (${[...bad].join(', ')})`);
    }
  }

  const emptyLines: number[] = [];
  upload.rows.forEach((row, index) => {
    if (upload.kind === 'gsc') {
      if (!cell(row, upload.roles.page)) emptyLines.push(index + 1);
      return;
    }
    if (!cell(row, upload.roles.source) && !cell(row, upload.roles.destination)) {
      emptyLines.push(index + 1);
    }
  });
  if (emptyLines.length) {
    const shown = emptyLines.slice(0, 8).join(', ');
    const more = emptyLines.length > 8 ? ` +${emptyLines.length - 8}` : '';
    warnings.push(`${t(lang, 'emptyRows')}: ${shown}${more}`);
  }

  return warnings;
}

function renderPreview(): void {
  const warnings = $('preview-warnings');
  const samples = $('preview-samples');
  warnings.replaceChildren();
  samples.replaceChildren();

  for (const upload of uploads) {
    for (const message of previewWarnings(upload)) {
      const box = document.createElement('p');
      box.className = 'callout callout-warning';
      const badge = document.createElement('span');
      badge.className = 'badge badge-warning';
      badge.textContent = 'warning';
      const text = document.createElement('span');
      text.textContent = `${upload.fileName} — ${message}`;
      box.append(badge, text);
      warnings.append(box);
    }

    const block = document.createElement('div');
    block.className = 'sample';
    const title = document.createElement('p');
    title.className = 'sample-name';
    title.textContent = upload.fileName;
    const meta = document.createElement('p');
    meta.className = 'sample-meta';
    const shown = Math.min(PREVIEW_N, upload.rows.length);
    meta.textContent = `${t(lang, 'firstRows')} ${fmt(shown)} / ${fmt(upload.rows.length)}`;
    block.append(title, meta);

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    upload.headers.forEach((header, index) => {
      const th = document.createElement('th');
      th.textContent = header || `(kolon ${index})`;
      hr.append(th);
    });
    thead.append(hr);
    const tbody = document.createElement('tbody');
    for (const row of upload.rows.slice(0, PREVIEW_N)) {
      const tr = document.createElement('tr');
      upload.headers.forEach((_, index) => {
        const td = document.createElement('td');
        td.className = 'mono clip';
        const value = cell(row, index);
        td.textContent = value;
        td.title = value;
        tr.append(td);
      });
      tbody.append(tr);
    }
    table.append(thead, tbody);
    wrap.append(table);
    block.append(wrap);
    samples.append(block);
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
    setStatus(`${fmt(uploads.length)} ${t(lang, 'filesLoaded')}`, 'ok');
  } catch (err) {
    const msg = err instanceof FileParseError ? err.message : t(lang, 'unexpected');
    setStatus(msg, 'error');
    logger.error('Dosya işleme hatası');
  }
}

function collectRecords(): { redirects: RedirectRecord[]; gsc: GscRecord[] } {
  const opts = normOptions();
  const redirects: RedirectRecord[] = [];
  const gsc: GscRecord[] = [];

  for (const upload of uploads) {
    let kind = upload.kind;
    if (
      kind === 'unknown' &&
      upload.roles.source !== undefined &&
      upload.roles.destination !== undefined
    ) {
      kind = 'plain';
    }
    if (kind === 'unknown' && upload.roles.page !== undefined) {
      kind = 'gsc';
    }

    const effective: ParsedUpload = { ...upload, kind, roles: upload.roles };

    if (kind === 'gsc') {
      gsc.push(...parseGscUpload(effective, opts));
    } else if (kind !== 'unknown') {
      const batch = parseRedirectUpload(effective, redirects.length, opts);
      redirects.push(...batch);
    }
  }

  if (redirects.length > MAX_COMBINED_ROWS) {
    throw new FileParseError(
      `Birleşik satır sınırı aşıldı: ${fmt(redirects.length)} > ${fmt(MAX_COMBINED_ROWS)}.`,
    );
  }

  return { redirects, gsc };
}

function getWorker(): Worker {
  if (!auditWorker) {
    auditWorker = new Worker(new URL('./worker/audit.worker.ts', import.meta.url), {
      type: 'module',
    });
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

function clearFilters(): void {
  severityFilter = 'all';
  filter = 'all';
  typeFilter = 'all';
  searchQuery = '';
  ($('row-search') as HTMLInputElement).value = '';
  ($('flag-filter') as HTMLSelectElement).value = 'all';
  ($('type-filter') as HTMLSelectElement).value = 'all';
  const allRadio = document.querySelector<HTMLInputElement>(
    'input[name="severity"][value="all"]',
  );
  if (allRadio) allRadio.checked = true;
}

function fillTypeFilter(): void {
  const sel = $('type-filter') as HTMLSelectElement;
  const types = [...new Set(records.map((row) => row.type).filter((value) => value))].sort();
  sel.replaceChildren();
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = t(lang, 'all');
  sel.append(all);
  for (const type of types) {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    sel.append(opt);
  }
  sel.value = 'all';
  typeFilter = 'all';
}

async function onRunAudit(): Promise<void> {
  setStatus(t(lang, 'processing'), 'info');
  $('btn-run').setAttribute('disabled', 'true');

  try {
    const { redirects, gsc } = collectRecords();
    if (redirects.length === 0) {
      setStatus(t(lang, 'noRedirects'), 'error');
      updateRunEnabled();
      return;
    }

    const useWorker = typeof Worker !== 'undefined';
    if (useWorker) {
      await new Promise<void>((resolve, reject) => {
        const worker = getWorker();
        const onMsg = (ev: MessageEvent<AuditWorkerResponse>) => {
          worker.removeEventListener('message', onMsg);
          worker.removeEventListener('error', onErr);
          if (ev.data?.type === 'audit-result') {
            records = ev.data.records;
            summary = ev.data.summary;
            resolve();
          } else {
            reject(new Error('Worker yanıtı geçersiz'));
          }
        };
        const onErr = () => {
          worker.removeEventListener('message', onMsg);
          worker.removeEventListener('error', onErr);
          const result = runAuditMainThread(redirects, gsc);
          records = result.records;
          summary = result.summary;
          resolve();
        };
        worker.addEventListener('message', onMsg);
        worker.addEventListener('error', onErr);
        const req: AuditWorkerRequest = {
          type: 'audit',
          records: redirects,
          gsc,
          options: { normalize: normOptions() },
        };
        worker.postMessage(req);
      });
    } else {
      const result = runAuditMainThread(redirects, gsc);
      records = result.records;
      summary = result.summary;
    }

    page = 0;
    clearFilters();
    fillTypeFilter();
    renderSummary();
    renderTable();
    ($('btn-download-map') as HTMLButtonElement).disabled = false;
    ($('btn-download-issues') as HTMLButtonElement).disabled = false;
    setStatus(`${t(lang, 'done')} ${fmt(records.length)} ${t(lang, 'rowsWord')}.`, 'ok');
  } catch (err) {
    const msg = err instanceof FileParseError ? err.message : t(lang, 'auditFailed');
    setStatus(msg, 'error');
    logger.error('Denetim hatası');
  } finally {
    updateRunEnabled();
  }
}

function countSeverities(list: RedirectRecord[]): Record<SeverityName, number> {
  const counts: Record<SeverityName, number> = {
    error: 0,
    warning: 0,
    notice: 0,
    ok: 0,
  };
  for (const row of list) counts[rowSeverity(row)] += 1;
  return counts;
}

function metricPressed(key: MetricKey): boolean {
  if (key === 'total') {
    return (
      severityFilter === 'all' &&
      filter === 'all' &&
      typeFilter === 'all' &&
      searchQuery.trim() === ''
    );
  }
  return severityFilter === key;
}

function paintMetricState(): void {
  document.querySelectorAll<HTMLButtonElement>('.metric').forEach((btn) => {
    const key = btn.dataset.metric as MetricKey | undefined;
    if (!key) return;
    btn.setAttribute('aria-pressed', metricPressed(key) ? 'true' : 'false');
  });
}

function renderSummary(): void {
  const wrap = $('summary-wrap');
  const box = $('summary-counts');
  const breakdown = $('severity-breakdown');
  box.replaceChildren();
  breakdown.textContent = '';
  if (!summary) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  const counts = countSeverities(records);
  const items: Array<{ key: MetricKey; label: string; value: number }> = [
    { key: 'total', label: t(lang, 'metricTotal'), value: summary.total },
    {
      key: 'issues',
      label: t(lang, 'metricIssues'),
      value: counts.error + counts.warning + counts.notice,
    },
    { key: 'ok', label: 'ok', value: counts.ok },
  ];

  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'metric';
    btn.dataset.metric = item.key;
    btn.setAttribute('aria-pressed', metricPressed(item.key) ? 'true' : 'false');

    const value = document.createElement('span');
    value.className = 'metric-value';
    value.textContent = fmt(item.value);
    const label = document.createElement('span');
    label.className = 'metric-label';
    label.textContent = item.label;
    btn.append(value, label);
    btn.addEventListener('click', () => onMetric(item.key));
    box.append(btn);
  }

  breakdown.textContent =
    summary.withGsc > 0 ? `${t(lang, 'metricGsc')}: ${fmt(summary.withGsc)}` : '';
}

function onMetric(key: MetricKey): void {
  if (key === 'total') {
    clearFilters();
    page = 0;
    renderSummary();
    renderTable();
    return;
  }
  if (severityFilter === key) {
    severityFilter = 'all';
    const allRadio = document.querySelector<HTMLInputElement>(
      'input[name="severity"][value="all"]',
    );
    if (allRadio) allRadio.checked = true;
  } else {
    severityFilter = key;
    const radio = document.querySelector<HTMLInputElement>(
      `input[name="severity"][value="${key}"]`,
    );
    if (radio) radio.checked = true;
  }
  page = 0;
  paintMetricState();
  renderTable();
}

function flagHit(row: RedirectRecord, flag: string): boolean {
  if (flag === 'all') return true;
  if (flag === 'ok') return row.flags.length === 0;
  if (flag === 'flatten') return !!row.flattenTo;
  return row.flags.includes(flag as AuditFlag);
}

function filteredRecords(): RedirectRecord[] {
  const query = searchQuery.trim().toLocaleLowerCase(lang === 'en' ? 'en-US' : 'tr-TR');
  return records.filter((row) => {
    if (severityFilter === 'issues') {
      if (rowSeverity(row) === 'ok') return false;
    } else if (severityFilter !== 'all' && rowSeverity(row) !== severityFilter) {
      return false;
    }
    if (!flagHit(row, filter)) return false;
    if (typeFilter !== 'all' && row.type !== typeFilter) return false;
    if (query) {
      const hay = `${row.sourceRaw} ${row.destinationRaw}`.toLocaleLowerCase(
        lang === 'en' ? 'en-US' : 'tr-TR',
      );
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

interface Hop {
  destNorm: string;
  destRaw: string;
}

function buildHops(list: RedirectRecord[]): Map<string, Hop> {
  const bySource = new Map<string, RedirectRecord[]>();
  for (const row of list) {
    if (row.isUnsupported || !row.sourceNorm) continue;
    const group = bySource.get(row.sourceNorm) ?? [];
    group.push(row);
    bySource.set(row.sourceNorm, group);
  }
  const hops = new Map<string, Hop>();
  for (const [src, group] of bySource) {
    const dests = new Set(group.map((row) => row.destinationNorm));
    if (dests.size !== 1) continue;
    const destNorm = group[0]!.destinationNorm;
    if (!destNorm || destNorm === src) continue;
    hops.set(src, { destNorm, destRaw: group[0]!.destinationRaw });
  }
  return hops;
}

function chainText(row: RedirectRecord, hops: Map<string, Hop>): string {
  if (!row.chainLength && !row.flags.includes('loop')) return '';
  const parts = [row.sourceRaw];
  const seen = new Set<string>([row.sourceNorm]);
  let cursor = row.sourceNorm;
  for (let i = 0; i < 8; i++) {
    const hop = hops.get(cursor);
    if (!hop) break;
    parts.push(hop.destRaw);
    if (seen.has(hop.destNorm)) break;
    seen.add(hop.destNorm);
    cursor = hop.destNorm;
  }
  if (parts.length < 2) return row.chainLength ? String(row.chainLength) : '';
  return parts.join(' → ');
}

function thCell(label: string, className = ''): HTMLTableCellElement {
  const th = document.createElement('th');
  if (className) th.className = className;
  th.textContent = label;
  return th;
}

function primaryIssue(row: RedirectRecord): AuditFlag | 'ok' {
  for (const flag of FLAG_PRIORITY) {
    if (row.flags.includes(flag)) return flag;
  }
  return 'ok';
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

  const showClicks = records.some((row) => row.gscClicks !== null);
  const hops = buildHops(records);
  const hr = document.createElement('tr');
  hr.append(
    thCell(t(lang, 'colInclude')),
    thCell(t(lang, 'colStatus')),
    thCell('source'),
    thCell('destination'),
    thCell('type'),
    thCell('chain'),
    thCell('flatten→'),
  );
  if (showClicks) hr.append(thCell('clicks', 'num'));
  hr.append(thCell('file'), thCell('satır', 'num'));
  thead.append(hr);

  const list = filteredRecords();
  const totalPages = Math.max(1, Math.ceil(list.length / TABLE_PAGE_SIZE));
  if (page >= totalPages) page = totalPages - 1;
  const start = page * TABLE_PAGE_SIZE;
  const slice = list.slice(start, start + TABLE_PAGE_SIZE);

  for (const row of slice) {
    const tr = document.createElement('tr');
    const inactive = isInactive(row);
    if (inactive) tr.classList.add('is-inactive');

    const tdCheck = document.createElement('td');
    if (row.flattenTo && !row.flags.includes('loop')) {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = row.applyFlatten;
      if (row.applyFlatten) tr.classList.add('is-selected');
      cb.addEventListener('change', () => {
        row.applyFlatten = cb.checked;
        tr.classList.toggle('is-selected', cb.checked);
      });
      const hidden = document.createElement('span');
      hidden.className = 'visually-hidden';
      hidden.textContent = t(lang, 'includeFlatten');
      label.append(cb, hidden);
      tdCheck.append(label);
    }
    tr.append(tdCheck);

    const primary = primaryIssue(row);
    const tdStatus = document.createElement('td');
    tdStatus.className = 'status-cell';
    const chip = document.createElement('span');
    chip.className = `badge badge-${flagSeverity(primary)}`;
    chip.textContent = primary;
    tdStatus.append(chip);
    const moreBits: string[] = row.flags.filter((flag) => flag !== primary);
    if (inactive) moreBits.push('inactive');
    if (moreBits.length) {
      const more = document.createElement('span');
      more.className = 'status-more';
      more.textContent = moreBits.join(', ');
      tdStatus.append(more);
    }
    tr.append(tdStatus);

    const source = document.createElement('td');
    source.className = 'mono clip';
    source.textContent = row.sourceRaw;
    source.title = row.sourceRaw;
    const dest = document.createElement('td');
    dest.className = 'mono clip';
    dest.textContent = row.destinationRaw;
    dest.title = row.destinationRaw;
    tr.append(source, dest);

    const tdType = document.createElement('td');
    tdType.className = 'mono';
    tdType.textContent = row.type;
    tr.append(tdType);

    const path = chainText(row, hops);
    const tdChain = document.createElement('td');
    tdChain.className = 'mono clip';
    tdChain.textContent = path;
    tdChain.title = path;
    const tdFlat = document.createElement('td');
    tdFlat.className = 'mono clip';
    tdFlat.textContent = row.flattenTo ?? '';
    tdFlat.title = row.flattenTo ?? '';
    tr.append(tdChain, tdFlat);

    if (showClicks) {
      const tdClicks = document.createElement('td');
      tdClicks.className = 'num';
      tdClicks.textContent = row.gscClicks !== null ? fmt(row.gscClicks) : '';
      tr.append(tdClicks);
    }

    const tdFile = document.createElement('td');
    tdFile.className = 'mono clip';
    tdFile.textContent = row.fileName;
    tdFile.title = row.fileName;
    const tdLine = document.createElement('td');
    tdLine.className = 'num';
    tdLine.textContent = fmt(row.lineNo);
    tr.append(tdFile, tdLine);
    tbody.append(tr);
  }

  const note =
    list.length === 0 && records.length > 0
      ? t(lang, 'noRows')
      : `${fmt(list.length)} ${t(lang, 'rowsShown')}`;
  $('preview-note').textContent = note;
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
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
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

function bindDropzone(): void {
  const zone = $('dropzone');
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragover');
  });
  zone.addEventListener('dragleave', (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && zone.contains(next)) return;
    zone.classList.remove('is-dragover');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragover');
    const files = event.dataTransfer?.files;
    if (files?.length) void onFilesSelected(files);
  });
}

function init(): void {
  document.title = APP_NAME;
  applyI18n();
  $('xlsx-version').textContent = `SheetJS ${getXlsxVersion()} · v${APP_VERSION}`;

  ($('lang-select') as HTMLSelectElement).addEventListener('change', (event) => {
    lang = (event.target as HTMLSelectElement).value as Lang;
    applyI18n();
    renderFileList();
    renderSummary();
    if (records.length) fillTypeFilter();
    renderTable();
  });

  const input = $('file-input') as HTMLInputElement;
  input.addEventListener('change', () => {
    if (input.files?.length) void onFilesSelected(input.files);
    input.value = '';
  });
  bindDropzone();

  $('btn-run').addEventListener('click', () => void onRunAudit());
  $('btn-download-map').addEventListener('click', () => {
    if (!records.length) return;
    downloadFixedMapCsv(records);
    setStatus(t(lang, 'mapSaved'), 'ok');
  });
  $('btn-download-issues').addEventListener('click', () => {
    if (!records.length) return;
    downloadIssuesCsv(records);
    setStatus(t(lang, 'issuesSaved'), 'ok');
  });

  ($('flag-filter') as HTMLSelectElement).addEventListener('change', (event) => {
    filter = (event.target as HTMLSelectElement).value;
    page = 0;
    paintMetricState();
    renderTable();
  });

  document.querySelectorAll<HTMLInputElement>('input[name="severity"]').forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      severityFilter = input.value as SeverityFilter;
      page = 0;
      paintMetricState();
      renderTable();
    });
  });

  ($('type-filter') as HTMLSelectElement).addEventListener('change', (event) => {
    typeFilter = (event.target as HTMLSelectElement).value;
    page = 0;
    paintMetricState();
    renderTable();
  });

  ($('row-search') as HTMLInputElement).addEventListener('input', (event) => {
    searchQuery = (event.target as HTMLInputElement).value;
    page = 0;
    paintMetricState();
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

  ($('opt-select-all-flatten') as HTMLInputElement).addEventListener('change', (event) => {
    const on = (event.target as HTMLInputElement).checked;
    for (const row of records) {
      if (row.flattenTo && !row.flags.includes('loop')) row.applyFlatten = on;
    }
    renderTable();
  });

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
  logger.info('Uygulama hazır');
}

init();
