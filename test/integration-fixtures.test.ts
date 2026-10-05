import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runAudits } from '../src/lib/audit';
import { parseWorkbookFile } from '../src/lib/excel';
import { escapeFormulaCell } from '../src/lib/formula-guard';
import { joinGsc } from '../src/lib/gsc';
import {
  buildParsedUpload,
  parseGscUpload,
  parseRedirectUpload,
} from '../src/lib/parse-redirects';
import { detectSchema } from '../src/lib/schemas';

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);

function fileFrom(name: string): File {
  const buf = fs.readFileSync(path.join(fixtures, name));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new File([ab], name, { type: 'text/csv' });
}

describe('SENTETIK fixture entegrasyonu', () => {
  it('Rank Math + Redirection birleşik denetim', async () => {
    const rm = await parseWorkbookFile(fileFrom('SENTETIK-rankmath-redirects.csv'));
    const rd = await parseWorkbookFile(fileFrom('SENTETIK-redirection-export.csv'));
    expect(detectSchema(rm.headers).kind).toBe('rankmath');
    expect(detectSchema(rd.headers).kind).toBe('redirection');

    const u1 = buildParsedUpload('SENTETIK-rankmath-redirects.csv', rm.headers, rm.rows);
    const u2 = buildParsedUpload('SENTETIK-redirection-export.csv', rd.headers, rd.rows);
    const rows = [
      ...parseRedirectUpload(u1, 0, {}),
      ...parseRedirectUpload(u2, 0, {}),
    ];
    // reindex
    rows.forEach((r, i) => {
      r.index = i;
    });

    const summary = runAudits(rows);
    expect(summary.duplicate).toBeGreaterThan(0);
    expect(summary.conflict).toBeGreaterThan(0);
    expect(summary.chain).toBeGreaterThan(0);
    expect(summary.loop).toBeGreaterThan(0);
    expect(summary.self).toBeGreaterThan(0);
    expect(summary.unsupported).toBeGreaterThan(0);

    const unsupported = rows.filter((r) => r.isUnsupported);
    expect(unsupported.every((r) => r.flags.includes('unsupported'))).toBe(true);
  });

  it('GSC TR join', async () => {
    const rm = await parseWorkbookFile(fileFrom('SENTETIK-rankmath-redirects.csv'));
    const gscFile = await parseWorkbookFile(fileFrom('SENTETIK-gsc-pages-tr.csv'));
    const u1 = buildParsedUpload('rm.csv', rm.headers, rm.rows);
    const ug = buildParsedUpload('g.csv', gscFile.headers, gscFile.rows);
    expect(ug.kind).toBe('gsc');

    const rows = parseRedirectUpload(u1, 0, {});
    // GSC example.com host — join path için source'ları absolute yapmayız;
    // fixture path'leri /old-a; GSC normalize host+path → example.com/old-a
    // Bu yüzden GSC satırlarını path-only beklemeyebiliriz; join path eşleşsin diye
    // testte GSC pageNorm'u path'e indirgemek yerine source'lara host ekliyoruz.
    for (const r of rows) {
      if (r.sourceRaw.startsWith('/')) {
        r.sourceRaw = `https://example.com${r.sourceRaw}`;
        r.sourceNorm = r.sourceNorm.startsWith('example.com')
          ? r.sourceNorm
          : `example.com${r.sourceNorm}`;
      }
    }
    const gsc = parseGscUpload(ug, {});
    joinGsc(rows, gsc);
    runAudits(rows);
    const withClicks = rows.filter((r) => r.gscClicks && r.gscClicks > 0);
    expect(withClicks.length).toBeGreaterThan(0);
  });

  it('boş / bozuk dosya', async () => {
    await expect(parseWorkbookFile(fileFrom('SENTETIK-bos.csv'))).rejects.toThrow();
    await expect(parseWorkbookFile(fileFrom('bozuk.xlsx'))).rejects.toThrow();
  });

  it('formül kaçırma çıktıda', () => {
    expect(escapeFormulaCell('=cmd')).toBe("'=cmd");
    expect(escapeFormulaCell('+1+1')).toBe("'+1+1");
    expect(escapeFormulaCell('@SUM(1)')).toBe("'@SUM(1)");
    const formul = fs.readFileSync(
      path.join(fixtures, 'SENTETIK-formul-map.csv'),
      'utf8',
    );
    expect(formul).toContain('=cmd');
    const cells = formul.trim().split('\n')[1]!.split(',');
    expect(escapeFormulaCell(cells[0])).toBe("'=cmd|/c calc");
    expect(escapeFormulaCell(cells[1] ?? '')).toBe('/safe');
  });
});
