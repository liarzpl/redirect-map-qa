import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
XLSX.set_fs(fs);
import { MAX_FILE_BYTES, MAX_ROWS } from '../src/config';
import {
  assertAllowedFile,
  FileParseError,
  getExtension,
  getXlsxVersion,
  parseWorkbookFile,
  workbookDownloadName,
} from '../src/lib/excel';
import { escapeFormulaCell } from '../src/lib/formula-guard';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');

function fileFromFixture(name: string, type?: string): File {
  const buf = fs.readFileSync(path.join(fixtures, name));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new File([ab], name, {
    type: type ?? 'application/octet-stream',
  });
}

describe('SheetJS sürümü', () => {
  it('0.20.2 veya üstüdür (CVE’li 0.18.5 değil)', () => {
    const v = getXlsxVersion();
    expect(v).toMatch(/^0\.20\./);
    const parts = v.split('.').map(Number);
    expect(parts[0]).toBe(0);
    expect(parts[1]).toBeGreaterThanOrEqual(20);
    expect(XLSX.version).toBe(v);
  });
});

describe('assertAllowedFile / uzantı', () => {
  it('boş dosyayı reddeder', () => {
    const f = new File([], 'bos.xlsx');
    expect(() => assertAllowedFile(f)).toThrow(FileParseError);
  });

  it('yanlış uzantıyı reddeder', () => {
    const f = new File([new Uint8Array([1, 2, 3])], 'not.pdf');
    expect(() => assertAllowedFile(f)).toThrow(/uzantı/i);
  });

  it('boyut sınırını reddeder', () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'buyuk.xlsx');
    expect(() => assertAllowedFile(big)).toThrow(/büyük/i);
  });

  it('uzantı yardımcısı', () => {
    expect(getExtension('a.XLSX')).toBe('.xlsx');
    expect(getExtension('a')).toBe('');
  });
});

describe('workbookDownloadName', () => {
  it('csv adına ikinci .csv eklemez', () => {
    expect(workbookDownloadName('redirect-map-fixed.csv', 'csv')).toBe(
      'redirect-map-fixed.csv',
    );
    expect(workbookDownloadName('redirect-map-issues.csv', 'csv')).toBe(
      'redirect-map-issues.csv',
    );
  });

  it('xls ve xlsx uzantısını da değiştirir', () => {
    expect(workbookDownloadName('report.xlsx', 'csv')).toBe('report.csv');
    expect(workbookDownloadName('report.xls', 'csv')).toBe('report.csv');
    expect(workbookDownloadName('report.CSV', 'xlsx')).toBe('report.xlsx');
  });
});

describe('parseWorkbookFile fixtures', () => {
  it('geçerli xlsx okur', async () => {
    const file = fileFromFixture('gecerli.xlsx');
    const parsed = await parseWorkbookFile(file);
    expect(parsed.headers).toContain('Ürün Adı');
    expect(parsed.rows.length).toBeGreaterThan(0);
  });

  it('geçerli csv okur', async () => {
    const file = fileFromFixture('gecerli.csv', 'text/csv');
    const parsed = await parseWorkbookFile(file);
    expect(parsed.headers.map((h) => h.trim())).toEqual(
      expect.arrayContaining(['Ürün Adı', 'Adet', 'Fiyat']),
    );
  });

  it('formül içeren dosyayı okur (hücre metin kalır)', async () => {
    const file = fileFromFixture('formul.xlsx');
    const parsed = await parseWorkbookFile(file);
    const flat = parsed.rows.flat().map(String);
    expect(flat.some((c) => c.startsWith('=') || c.startsWith('+') || c.startsWith('@'))).toBe(
      true,
    );
  });

  it('bozuk dosyada anlaşılır hata verir', async () => {
    const file = fileFromFixture('bozuk.xlsx');
    await expect(parseWorkbookFile(file)).rejects.toThrow(FileParseError);
  });

  it('satır sınırını aşan dosyayı reddeder', async () => {
    // CSV ile eşik+1 satır (xlsx üretmek 100k satırda ağır)
    const bigPath = path.join(fixtures, 'buyuk-satir.csv');
    if (!fs.existsSync(bigPath) || fs.statSync(bigPath).size < 1000) {
      const lines = ['Ürün Adı,Adet,Fiyat'];
      for (let i = 0; i < MAX_ROWS + 5; i++) {
        lines.push(`Urun ${i},${i},1.5`);
      }
      fs.writeFileSync(bigPath, lines.join('\n'), 'utf8');
    }
    const file = fileFromFixture('buyuk-satir.csv', 'text/csv');
    await expect(parseWorkbookFile(file)).rejects.toThrow(/satır/i);
  }, 120_000);
});

describe('çıktı kaçırma entegrasyonu', () => {
  it('yazılan hücreler kaçırılmış olur', () => {
    const headers = ['Ürün Adı', 'Adet', 'Fiyat', 'Not'];
    const rows = [
      ['Kalem', 2, 10, '=HYPERLINK("x")'],
      ['Defter', -1, 5.5, '+1+1'],
    ];
    const safe = [
      headers.map(escapeFormulaCell),
      ...rows.map((r) => r.map(escapeFormulaCell)),
    ];
    expect(safe[1]![3]).toBe("'=HYPERLINK(\"x\")");
    expect(safe[2]![3]).toBe("'+1+1");
    expect(safe[2]![1]).toBe(-1);
  });
});
