# StoreSage Multi-Tenant Inventory 📊🛒

Selamat datang di **StoreSage**, platform Software-as-a-Service (SaaS) manajemen inventaris dan kasir multi-tenant modern yang dirancang khusus untuk pelaku UMKM. Aplikasi ini menyediakan sistem pencatatan stok, katalog produk, kalkulasi valuasi aset, pengawasan billing berlangganan, serta sistem peringatan masa tenggang otomatis (H-3) yang terisolasi secara menyeluruh antar-penyewa (tenant) menggunakan Firebase Authentication dan Firestore Security Rules.

---

## ⚡ Pembaruan Terkini: Sistem Notifikasi Masa Tenggang Otomatis (H-3)

Sistem StoreSage kini telah dilengkapi dengan modul pemantauan siklus langganan komprehensif:

1. **Peringatan Masa Tenggang Otomatis (H-3 / Sisa ≤ 3 Hari)**
   * Sistem secara real-time memindai tanggal kedaluwarsa (`billing_period_end` / `subscriptionExpiresAt`).
   * Saat sisa masa aktif menyentuh 3 hari (72 jam) ke bawah, banner peringatan dinamis otomatis muncul pada dashboard Admin / Owner UMKM.
   * Banner menampilkan informasi detail: sisa waktu (hari, jam, menit), nama paket aktif, email akun, dan tanggal jatuh tempo.

2. **Panel Pengawasan Multi-Tenant & Simulator Notifikasi**
   * Super Admin dapat memantau seluruh UMKM yang terdaftar, status masa aktif, jenis paket berlangganan (30 hari, 90 hari, 365 hari, maupun paket uji coba), serta indikator sisa hari.
   * **Antrean Notifikasi Otomatis**: Daftar peringatan untuk tenant yang berada dalam masa tenggang H-3 tersaji secara otomatis di antrean log.
   * **Tombol Uji Coba Cepat**: Tersedia tombol simulasi *Demo H-3*, *Demo Kedaluwarsa (5 Menit)*, *Siarkan H-3*, dan *Perpanjang +30 Hari*.

3. **Database Tanpa Google Cloud Credits**
   * Arsitektur backend menggunakan **Firebase Firestore Spark Plan (Free Tier)** yang menyediakan jatah gratis harian (50.000 reads, 20.000 writes/hari) tanpa memerlukan saldo Google Cloud Credits.

---

## 💎 Fitur Utama Aplikasi

### 1. Isolasi Data Multi-Tenant (Tingkat Tinggi)
Setiap tenant memiliki ruang kerja dan database produk yang bersih dan terisolasi. Melalui Firestore Security Rules (`firestore.rules`), pengguna toko A **tidak dapat membaca atau memodifikasi** data inventaris, katalog, atau transaksi toko B.

### 2. Manajemen Inventaris & Valuasi Aset
* Pencatatan produk lengkap (kode SKU, nama, kategori, harga modal, harga jual, dan stok real-time).
* Fitur penyesuaian stok (tambah/kurang cepat) serta kalkulasi margin keuntungan dan total valuasi aset toko.
* Filter kategori dan pencarian instan.

### 3. Pengawasan Billing & Manajemen Paket Langganan
* Dukungan berbagai durasi langganan: Paket Reguler (30 Hari), Paket Hemat (90 Hari), Paket Tahunan (365 Hari), serta Paket Simulasi (3 Hari / H-3 dan 5 Menit).
* Layar penangguhan sistem otomatis (*SaaS Lockdown*) apabila masa langganan telah habis.

---

## 🚀 Panduan Penggunaan & Akun Uji Coba

Untuk mendemonstrasikan keseluruhan sistem secara instan, Anda dapat menggunakan opsi berikut di layar autentikasi:

1. **Uji Coba Sebagai Pemilik Toko A (Langganan Aktif)**
   * Klik tombol simulasi **Warung Makan Ibu Aminah**.
   * Masuk ke dashboard dengan statistik aset, stok dinamis, dan produk siap pakai dengan masa berlangganan premium aktif.
2. **Uji Coba Sebagai Toko B (Masa Tenggang H-3 / Peringatan)**
   * Klik tombol simulasi **Kopi Sedap Malam (Staff)**.
   * Anda akan melihat banner peringatan masa tenggang H-3 di atas dashboard dengan rincian paket dan sisa waktu aktif.
3. **Mendaftar UMKM Baru Secara Mandiri**
   * Klik **"Belum punya akun? Daftar Tenant Baru di sini"**.
   * Masukkan nama owner, nama toko/UMKM, email, dan kata sandi baru (minimal 6 karakter).
4. **Masuk Sebagai Super Admin**
   * Gunakan email administrator `admin@storesage.com` atau `ridhowicaksono@storesage.com`.
   * Klik menu **"⚙️ Panel Super Admin"** (Passkey pengaman: `storesageadmin2026`). Di dalam panel ini, Anda dapat memantau seluruh tenant, menambah tenant baru dengan durasi kustom, mengirim broadcast email simulasi, atau mereset masa aktif.

---

## 📂 Struktur File & Komponen

* `src/App.tsx` - Shell aplikasi utama, state otentikasi global, detektor masa aktif periodik, dan navigasi tab.
* `src/components/AdminCreateTenantView.tsx` - Panel Super Admin untuk monitoring tenant, kalibrasi durasi paket, simulasi log email, dan pembuatan tenant baru.
* `src/components/BillingExpiredView.tsx` - Tampilan penangguhan sistem (*SaaS Lockdown*) saat masa langganan habis.
* `src/components/StoresView.tsx` - Halaman profil toko dan detail status langganan tenant aktif.
* `src/components/ProductsView.tsx` - Manajemen katalog produk, penyesuaian stok, dan valuasi aset.
* `src/hooks/useAuth.tsx` - Custom React Hook autentikasi Firebase, otorisasi peran (Super Admin/Owner/Staff), dan sinkronisasi profil tenant.
* `firestore.rules` - Aturan keamanan Firestore multi-tenant berbasis store ID dan verifikasi peran.
