# Arsitektur Frontend POS

React 18 + Vite 6 (JavaScript/JSX). Routing memakai react-router 7. State global ada di Redux Toolkit (`user`, `cart`, `customer`), data server di React Query, dan komunikasi API lewat axios dengan cookie (`withCredentials`). Styling memakai Tailwind, realtime memakai Socket.IO.

## Struktur

```text
src/
├── main.jsx                 Entry: <AppProviders><App/></AppProviders>
├── app/                     Penyusun aplikasi (tanpa logika bisnis fitur)
│   ├── App.jsx              BrowserRouter + hook realtime
│   ├── router/AppRoutes.jsx Route, ProtectedRoute, loader sesi
│   ├── layouts/Header.jsx   Header (logo, navigasi dashboard, logout)
│   ├── providers/           Redux + notistack + React Query
│   ├── queryClient.js       Polling 15 dtk (VITE_QUERY_REFETCH_INTERVAL_MS), tanpa retry untuk 401
│   ├── realtime/            Event Socket.IO → invalidasi query
│   └── store.js             Redux store (user, cart, customer)
├── features/
│   ├── auth/       Login, sesi (useLoadSession), logout (useLogout), userSlice
│   ├── home/       Halaman beranda: ringkasan hari ini, menu populer, order terbaru
│   ├── orders/     Halaman pesanan, OrderCard, filter tanggal, metrik order (HPP, uang diterima)
│   ├── pos/        Halaman menu kasir: katalog, harga, keranjang (cartSlice), QRIS
│   ├── inventory/  Stok barang, COGS, belanja (purchase), supplier
│   ├── settings/   Pengaturan platform order online (+ supplier dari inventory)
│   └── dashboard/  Halaman dashboard: tab-tab yang menyusun fitur lain
├── shared/
│   ├── api/        client axios + backendUrl
│   ├── lib/        format (rupiah, input nominal) dan tanggal Asia/Jakarta
│   └── ui/         BackButton, BottomNav, FullScreenLoader, CreatableSelect2
└── (lama) components/, redux/slices/, https/, utils/   lihat "Lapisan kompatibilitas"
tests/
├── setup.js, renderWithProviders.jsx
├── unit/          reducer Redux
└── integration/   alur halaman (login, routing, orders, POS, stok, belanja)
```

Isi setiap fitur, dibuat hanya bila diperlukan:

| Folder/file | Isi |
|---|---|
| `pages/` | Halaman yang dipasang di route |
| `components/` | Komponen tampilan khusus fitur |
| `hooks/` | Logika yang butuh React: query, mutasi, state form |
| `utils/` | Fungsi murni untuk perhitungan dan transformasi; tesnya `*.test.js` di sebelahnya |
| `api.js` | Endpoint yang dipakai fitur |
| `index.js` | **API publik** fitur. Hanya ini yang boleh diimpor oleh `app/` dan fitur lain |

## Aturan dependensi

- `app` boleh memakai `features` (lewat `index.js`) dan `shared`.
- `features` boleh memakai `shared`, dan fitur lain hanya lewat `index.js` fitur tersebut. Contoh: `dashboard` → `inventory`, `settings`; `home` → `orders`.
- `shared` tidak boleh mengimpor `features` atau `app`.
- `features` tidak boleh mengimpor `app`.
- Di dalam satu fitur, impor modulnya langsung (`../utils/orderMetrics`), bukan lewat `index.js` fitur sendiri, agar tidak terjadi circular import.

## State dan data

- **Data server:** React Query. Query key yang dipakai: `orders`, `categories`, `menu-items`, `stock-items`, `purchases`, `shopping-suppliers`, `order-platforms`, `recaps`, `recap-meta`. Key-key ini juga dipakai `app/realtime/useRealtimeData.js`; mengganti nama key berarti memutus refresh realtime.
- **Redux:** sesi pengguna (`user`), keranjang (`cart`), dan data pelanggan/order yang sedang diisi (`customer`). Keranjang tidak disimpan ke storage: refresh browser mengosongkannya, sama seperti sebelumnya.
- **State lokal:** form, dialog, filter, dan pagination berada di komponen atau hook milik fitur. Pengecualian: draft form belanja disimpan di `usePurchaseForm` milik induk agar tidak hilang saat dialog ditutup (aturan di `SHOPPING.md`).

## Lapisan kompatibilitas (sementara)

Delapan file berikut berisi perubahan pengguna yang belum di-commit ketika refactor dimulai, sehingga **tidak diubah**:
- `components/dashboard/{MenuManagement,Metrics,RecapManagement}.jsx`
- `components/invoice/Invoice.jsx`
- `components/menu/{Bill,CustomerInfo}.jsx`
- `redux/slices/customerSlice.js`
- `https/index.js`

Agar path import mereka tetap berfungsi, path lama berisi re-export satu baris:

| Path lama | Mengarah ke |
|---|---|
| `utils/index.js` | `shared/lib/*` dan `features/orders` |
| `https/axiosWrapper.js`, `https/backendUrl.js` | `shared/api/*` |
| `components/shared/CreatableSelect2.jsx` | `shared/ui/CreatableSelect2` |
| `components/menu/NonCashPaymentModal.jsx` | `features/pos` |
| `redux/slices/cartSlice.js` | `features/pos/cartSlice` |

Definisi endpoint masih berada di `https/index.js`; setiap `features/*/api.js` me-re-export endpoint yang dipakai fiturnya.

`utils/printReceipt.js` (dipakai `Bill`/`Invoice`) dan `utils/rawbtPrint.js` (dirujuk oleh import yang di-comment di `Invoice.jsx`) dibiarkan di tempatnya.

Setelah perubahan tersebut di-commit:
1. Pindahkan file-file itu ke fiturnya: Metrics/Recap/MenuManagement ke dashboard atau fitur baru, Invoice ke orders, Bill/CustomerInfo/customerSlice ke pos.
2. Pindahkan definisi endpoint ke `features/*/api.js`.
3. Hapus shim di atas.

## Menambah fitur

1. Buat `src/features/<nama>/` dengan subfolder yang memang dibutuhkan.
2. Taruh endpoint di `api.js` fitur. Bila memakai query baru yang perlu realtime, tambahkan invalidasinya di `app/realtime/useRealtimeData.js`.
3. Perhitungan murni masuk ke `utils/` beserta tesnya.
4. Ekspor yang dibutuhkan pihak luar lewat `index.js`. Pasang halaman di `app/router/AppRoutes.jsx`.
5. Komponen hanya masuk ke `shared/ui` bila dipakai oleh dua fitur atau lebih dan tidak berisi aturan bisnis.

## Pengujian

| Perintah | Keterangan |
|---|---|
| `npm test` | Vitest + Testing Library (jsdom); API di-mock, tidak menyentuh backend |
| `npm run test:watch` | Mode watch |
| `npx vitest run src/features/orders` | Satu folder |
| `npm run lint` | ESLint |
| `npm run build` | Build produksi |

Aturan `react/prop-types` dinonaktifkan karena project ini tidak memakai PropTypes (paketnya tidak terpasang, dan React 19 menghapusnya).

## Pekerjaan yang belum selesai

- **Migrasi 8 file WIP** beserta penghapusan shim (lihat di atas). File-file ini juga yang terbesar: RecapManagement 2.1rb baris, MenuManagement 2.1rb, Metrics 1.5rb, Invoice 1.2rb, Bill 845.
- **Komponen besar yang belum dipecah:** `OrderCard` (479 baris), `SettingsManagement` (330), `PopularDishes` (241).
- **Lint lama:** 47 error dan 46 warning, didominasi `no-unused-vars` dan `react-hooks/exhaustive-deps`, termasuk di file WIP.

**Bug lama yang ditemukan tetapi tidak diperbaiki** (perbaikannya mengubah perilaku):

| Bug | Lokasi | Dampak |
|---|---|---|
| `enqueueSnackbar` dipanggil saat render bila query error | `OrdersPage`, `StockManagement`, `RecentOrders` | Notifikasi bisa muncul berulang setiap render |
| Form belanja mengirim `unitPrice = total / max(qty, 1)` | `inventory/utils/shopping.js` (`unitPriceFromTotal`) | Untuk qty < 1, backend menyimpan total yang salah. Contoh: 0,5 × Rp 15.000 = Rp 7.500, padahal yang diketik Rp 15.000 |
| Kalimat ganda "…dari harga total. otomatis." | Form belanja | Hanya teks |
| Kolom pencarian Header tidak berfungsi | Header | Hanya tampilan |
| `Register.jsx` tidak dipasang di route mana pun, sementara endpoint register di backend masih terbuka | auth | Lihat keputusan D1 di laporan backend |
