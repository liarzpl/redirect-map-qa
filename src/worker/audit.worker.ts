/**
 * Ağır denetimler Web Worker'da — UI donmasın.
 * CSP: worker-src 'self'
 */

import { runAudits } from '../lib/audit';
import { joinGsc, sortByPriority } from '../lib/gsc';
import type { AuditOptions, GscRecord, RedirectRecord } from '../lib/types';

export interface AuditWorkerRequest {
  type: 'audit';
  records: RedirectRecord[];
  gsc: GscRecord[];
  options: AuditOptions;
}

export interface AuditWorkerResponse {
  type: 'audit-result';
  records: RedirectRecord[];
  summary: ReturnType<typeof runAudits>;
}

self.onmessage = (ev: MessageEvent<AuditWorkerRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'audit') return;

  const records = msg.records;
  joinGsc(records, msg.gsc ?? []);
  const summary = runAudits(records, msg.options);
  const sorted = sortByPriority(records);

  const response: AuditWorkerResponse = {
    type: 'audit-result',
    records: sorted,
    summary,
  };
  self.postMessage(response);
};
