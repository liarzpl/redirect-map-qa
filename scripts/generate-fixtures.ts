/**
 * Test fixture dosyaları üretir. Gerçek kişisel veri yok.
 * Çalıştır: npm run fixtures
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { MAX_ROWS } from '../src/config';

// Node ortamında dosya yazımı için
XLSX.set_fs(fs);

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'test',
  'fixtures',
);
fs.mkdirSync(dir, { recursive: true });

function writeAoa(name: string, aoa: unknown[][], sheet = 'Data'): void {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const out = path.join(dir, name);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  fs.writeFileSync(out, buf);
  console.info('yazildi', name);
}

// Geçerli örnek
writeAoa('gecerli.xlsx', [
  ['Ürün Adı', 'Adet', 'Fiyat', 'Kategori'],
  ['Mavi Kalem', 10, 12.5, 'Kırtasiye'],
  ['Defter A5', 3, -2.5, 'Kırtasiye'],
  ['USB Bellek', 1, 199.9, 'Elektronik'],
]);

// CSV
const csv = [
  'Ürün Adı,Adet,Fiyat',
  'Silgi,5,4.5',
  'Cetvel,2,8',
  'Kalemtraş,7,3.25',
].join('\n');
fs.writeFileSync(path.join(dir, 'gecerli.csv'), '\ufeff' + csv, 'utf8');
console.info('yazildi', 'gecerli.csv');

// Formül enjeksiyon örnekleri (zararsız test dizeleri)
writeAoa('formul.xlsx', [
  ['Ürün Adı', 'Adet', 'Fiyat', 'Not'],
  ['Test A', 1, 10, '=HYPERLINK("http://example.invalid")'],
  ['Test B', 2, 20, "=cmd|'/c calc'!A0"],
  ['Test C', 3, 30, '+1+1'],
  ['Test D', 4, 40, '@SUM(A1:A2)'],
  ['Test E', 5, 50, '\tGizli'],
  ['Test F', 6, -12.5, 'Normal metin'],
]);

// Bozuk / boş
fs.writeFileSync(path.join(dir, 'bozuk.xlsx'), Buffer.from('bu-excel-degil'));
console.info('yazildi', 'bozuk.xlsx');
fs.writeFileSync(path.join(dir, 'bos.csv'), '');
console.info('yazildi', 'bos.csv');

// Yanlış uzantı içeriği
fs.writeFileSync(path.join(dir, 'yanlis.pdf'), '%PDF-fake');
console.info('yazildi', 'yanlis.pdf');

// Büyük satır (MAX_ROWS + 10) — testte sınır kontrolü
const headers = ['Ürün Adı', 'Adet', 'Fiyat'];
const bigRows = Array.from({ length: MAX_ROWS + 10 }, (_, i) => [
  `Ornek Urun ${i}`,
  i % 100,
  (i % 50) + 0.5,
]);
writeAoa('buyuk-satir.xlsx', [headers, ...bigRows]);

// Normalize başlık varyantı
writeAoa('baslik-varyant.xlsx', [
  ['ürün_adı', 'ADET', 'FİYAT'],
  ['Kupa', 4, 75],
]);

console.info('fixtures tamam', dir);
