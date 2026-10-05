import { describe, expect, it } from 'vitest';
import {
  escapeFormulaCell,
  escapeFormulaRecord,
  escapeFormulaRow,
  needsFormulaEscape,
  stripLeadingSpaces,
} from '../src/lib/formula-guard';

describe('escapeFormulaCell', () => {
  it('tehlikeli önekleri tek tırnak ile kaçırır', () => {
    expect(escapeFormulaCell('=HYPERLINK("http://evil")')).toBe(
      "'=HYPERLINK(\"http://evil\")",
    );
    expect(escapeFormulaCell('=cmd|\'/c calc\'!A0')).toBe(
      "'=cmd|'/c calc'!A0",
    );
    expect(escapeFormulaCell('+1+1')).toBe("'+1+1");
    expect(escapeFormulaCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(escapeFormulaCell('-1+1')).toBe("'-1+1");
    expect(escapeFormulaCell('|cmd')).toBe("'|cmd");
  });

  it('baştaki boşluk / NBSP / Unicode boşluk sonrası tehlikeli karakteri yakalar', () => {
    expect(escapeFormulaCell(' =1+1')).toBe("' =1+1");
    expect(escapeFormulaCell('\u00a0=CMD')).toBe("'\u00a0=CMD");
    expect(escapeFormulaCell('\u2003=A1')).toBe("'\u2003=A1");
    expect(escapeFormulaCell('\ufeff+1')).toBe("'\ufeff+1");
    expect(needsFormulaEscape(' =1+1')).toBe(true);
    expect(needsFormulaEscape('\u00a0=CMD')).toBe(true);
  });

  it('fullwidth = + - @ karakterlerini kaçırır', () => {
    expect(escapeFormulaCell('＝A1')).toBe("'＝A1");
    expect(escapeFormulaCell('＋1')).toBe("'＋1");
    expect(escapeFormulaCell('－1')).toBe("'－1");
    expect(escapeFormulaCell('＠SUM')).toBe("'＠SUM");
    expect(escapeFormulaCell(' ＝A1')).toBe("' ＝A1");
  });

  it('saf sayıları sayı tipinde bırakır (negatif dahil)', () => {
    expect(escapeFormulaCell(-12.5)).toBe(-12.5);
    expect(escapeFormulaCell(0)).toBe(0);
    expect(escapeFormulaCell(42)).toBe(42);
    expect(needsFormulaEscape(-12.5)).toBe(false);
  });

  it('metin olarak gelen negatifleri kaçırır', () => {
    expect(escapeFormulaCell('-5')).toBe("'-5");
    expect(escapeFormulaCell('-12.5')).toBe("'-12.5");
    expect(needsFormulaEscape('-5')).toBe(true);
  });

  it('güvenli metinleri değiştirmez', () => {
    expect(escapeFormulaCell('Ürün Adı')).toBe('Ürün Adı');
    expect(escapeFormulaCell('12.5')).toBe('12.5');
    expect(escapeFormulaCell('')).toBe('');
    expect(escapeFormulaCell(' normal')).toBe(' normal');
    expect(escapeFormulaCell('\tGizli')).toBe('\tGizli'); // tab atlanır, G güvenli
  });

  it('stripLeadingSpaces yardımcı', () => {
    expect(stripLeadingSpaces('  x')).toBe('x');
    expect(stripLeadingSpaces('\u00a0\u3000y')).toBe('y');
  });

  it('boolean ve boş değerleri doğru işler', () => {
    expect(escapeFormulaCell(true)).toBe(true);
    expect(escapeFormulaCell(false)).toBe(false);
    expect(escapeFormulaCell(null)).toBe('');
    expect(escapeFormulaCell(undefined)).toBe('');
  });

  it('NaN / Infinity metin olarak stringleşir', () => {
    expect(escapeFormulaCell(Number.NaN)).toBe('NaN');
    expect(escapeFormulaCell(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });

  it('satır ve kayıt yardımcıları çalışır', () => {
    expect(escapeFormulaRow(['ok', '=A1', -3])).toEqual(['ok', "'=A1", -3]);
    expect(escapeFormulaRecord({ a: '+1', b: 5, c: 'x' })).toEqual({
      a: "'+1",
      b: 5,
      c: 'x',
    });
  });
});
