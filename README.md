# Tarayıcı Excel/CSV Araç Şablonu

İstemci tarafında çalışan, **veriyi cihazdan çıkarmayan** Excel/CSV araçları için yeniden kullanılabilir başlangıç şablonu. Vite + vanilla TypeScript. Türkçe arayüz.

Belirli bir ürün fikri onaylandığında bu şablonu kopyalayıp 1–2 günde çalışan bir araç çıkarabilirsiniz.

## Hızlı başlangıç

**Node.js:** `^22.12` veya üzeri (Vitest 5 / temiz `npm audit` için). `.nvmrc` = 22.20.0

```bash
cd fikir-fabrikasi/sablon/tarayici-arac
npm ci
npm test
npm run build
npm run preview
```

Geliştirme sunucusu: `npm run dev`

Test fixture’larını yeniden üretmek: `npm run fixtures`

## Demo akışı

1. Dosya yükle (`.xlsx` / `.xls` / `.csv`)
2. Zorunlu kolonları **başlık adına göre** eşle (ör. `Ürün Adı`, `Adet`, `Fiyat`)
3. Eksik kolonları Türkçe hata olarak göster
4. Önizleme tablosu (textContent — `innerHTML` yok)
5. Formül kaçırması uygulanmış Excel/CSV indir

## Güvenlik kararları (kilitli)

1. **Tamamen istemci / statik site** — sunucu yok, analytics yok, üçüncü parti istek yok. Kullanıcı verisi hiçbir ağ isteğine girmez.
2. **SheetJS 0.20.3** — npm’deki eski `xlsx@0.18.5` (CVE’li) **kullanılmaz**. Resmi dağıtım: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Paket **build’e gömülür**; çalışma anında CDN’den script çekilmez.
3. **Formül enjeksiyonu koruması** — baştaki boşluk/NBSP/Unicode boşluk atlanır; `= + - @ |` ve fullwidth `＝＋－＠` ile başlayan metinlerin başına `'` eklenir. Saf `number` hücreler (ör. `-12.5`) sayı kalır. **Metin** `"-5"` ise başına `'` eklenir.
4. **Boyut / satır sınırı** — varsayılan 10 MB ve 50.000 satır (`src/config.ts`). Aşımda anlaşılır Türkçe hata. Bozuk/boş/yanlış uzantıda çökmez.
5. **Kolon eşleme** — sıra değil başlık adı; Türkçe İ/ı, Ş/ş, boşluk, büyük-küçük harf normalizasyonu.
6. **Sıkı CSP** — tek kaynak `shared/csp.mjs` (`style-src 'self'`, `font-src 'self'`, `worker-src 'self'`; `unsafe-inline` yok). `scripts/sync-csp.mjs` ile index.html / `_headers` / `netlify.toml` / `vercel.json` / Vite header hizalanır; `test/csp-align.test.ts` doğrular.
7. **Yerel saklama ve PWA varsayılan KAPALI** (`LOCAL_STORAGE_ENABLED`, `PWA_ENABLED`). IndexedDB / persist / yedek hatırlatması; `localStorage`’a hassas veri yok. PWA açılınca sürümlü SW cache (`tarayici-arac-v{version}`), eski cache silme, «Yenile» ipucu.
8. **Loglar** — konsola kullanıcı verisi yazılmaz (`src/lib/logger.ts`).

## Yeni projede ne değiştirilir?

| Dosya | Ne yapılır |
|-------|------------|
| `src/config.ts` | Uygulama adı, zorunlu kolonlar, boyut/satır sınırı, `LOCAL_STORAGE_ENABLED`, `PWA_ENABLED` |
| `src/main.ts` | İş kuralları, dönüşüm, ek UI adımları |
| `index.html` / `src/style.css` | Marka, metinler, düzen |
| `public/manifest.webmanifest` | PWA adı / ikon |
| `test/` | Yeni iş kuralları için birim testleri |

Dokunulmaması gerekenler (güvenlik kilidi): formül kaçırma, SheetJS kaynağı/sürümü, CSP iskeleti, logger’a kullanıcı verisi koymama, build’e harici runtime CDN eklememe.

## Teknoloji

- Vite 6 + TypeScript (React yok)
- Vitest
- SheetJS Community Edition **0.20.3** (vendor)

## Dağıtım

`npm run build` → `dist/`. Statik hosting (Vercel / Netlify / Cloudflare Pages / GitHub Pages). Header örnekleri repoda.

## Dist kontrolü

`dist/` içinde `http(s)://` geçen dizeler çoğunlukla SheetJS/OOXML **XML namespace** URI’leri ve telif notudur (`schemas.openxmlformats.org`, `www.w3.org`, `sheetjs.com` vb.). Çalışma anında CDN/analytics çağrısı yoktur; ağ istekleri CSP ile engellenir (`connect-src 'self'`).

## Lisans

MIT
