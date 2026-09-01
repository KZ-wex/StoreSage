# StoreSage - Aplikasi SaaS Manajemen Inventaris & Kasir UMKM 📊🛒

**StoreSage** adalah platform Software-as-a-Service (SaaS) berbasis web yang dirancang khusus untuk mempermudah pemilik usaha kecil dan menengah (UMKM) dalam mengelola inventaris, produk barang, transaksi kasir, serta masa aktif berlangganan secara otomatis, aman, dan mandiri.

---

## 🎯 Tujuan & Manfaat Aplikasi
1. **Pencatatan Stok Praktis**: Memantau stok barang masuk dan keluar tanpa proses manual yang rumit.
2. **Kalkulasi Nilai Aset Real-Time**: Mengetahui total valuasi barang di toko dan estimasi potensi margin keuntungan.
3. **Peringatan Masa Tenggang (H-3)**: Mengingatkan pemilik UMKM sebelum paket langganan habis agar sistem kasir tidak terhenti mendadak.
4. **Isolasi Data Toko**: Setiap toko/UMKM memiliki ruang data pribadi yang aman dan terpisah dari toko lain (*Multi-Tenant Architecture*).

---

## 💡 Fitur Utama untuk Pemilik Toko (UMKM)

### 1. Manajemen Produk & Inventaris
* **Katalog Produk**: Menyimpan nama barang, kode SKU, kategori, harga modal, harga jual, dan jumlah stok.
* **Quick Stock Update**: Tombol cepat untuk menambah atau mengurangi stok barang secara langsung dari tabel.
* **Valuasi Aset & Statistik**: Ringkasan total produk aktif, total unit barang, dan nilai nominal seluruh inventaris.
* **Pencarian Cepat**: Filter produk berdasarkan nama atau kategori secara instan.

### 2. Notifikasi Otomatis Masa Tenggang (H-3)
* Ketika sisa masa aktif langganan toko menyentuh **≤ 3 hari (72 jam)**, banner peringatan otomatis muncul di bagian atas dashboard.
* Menampilkan informasi:
  * **Nama Paket Aktif** (e.g., *Paket Reguler 30 Hari*, *Paket Hemat 90 Hari*, *Paket Tahunan 365 Hari*).
  * **Indikator Sisa Waktu** (hari, jam, dan menit).
  * **Email Akun & Tanggal Berakhir**.
  * Panduan perpanjangan sebelum sistem terkunci.

### 3. Penguncian Otomatis Saat Kedaluwarsa (*SaaS Lockdown*)
* Jika masa aktif berlangganan habis (0 hari), sistem secara otomatis mengunci menu kasir & inventaris dan mengarahkan pengguna ke layar penangguhan akun dengan tombol panduan perpanjangan.

---

## 🛡️ Fitur Panel Pengawasan Super Admin

Bagi pengelola pusat / administrator sistem:

1. **Pendaftaran Toko (Tenant) Baru**:
   * Menambahkan akun pemilik toko baru lengkap dengan nama toko, email, kata sandi, dan pilihan durasi paket langganan (30 hari, 90 hari, 365 hari, atau paket uji coba).
2. **Tabel Pengawasan Seluruh UMKM**:
   * Memantau seluruh daftar toko, nama pemilik, email, jenis paket, tanggal kedaluwarsa, dan status sisa hari/jam.
3. **Antrean Notifikasi Otomatis**:
   * Sistem mendeteksi otomatis toko-toko yang berada dalam masa tenggang H-3 dan menampilkannya di log antrean peringatan.
4. **Tombol Simulasi & Kontrol**:
   * `Demo H-3` : Mengubah sisa masa aktif toko ke sisa < 3 hari untuk menguji banner peringatan.
   * `Demo 5 Menit` : Mengubah masa aktif menjadi 5 menit untuk menguji layar kedaluwarsa.
   * `Perpanjang +30 Hari` : Menambah masa aktif toko 30 hari secara instan.

---

## 🔑 Kredensial & Akses Cepat

* **Super Admin Email**: `admin@storesage.com` / `ridhowicaksono2604@gmail.com`
* **Passkey Panel Super Admin**: `storesageadmin2026`
* **Pilihan Uji Coba Demo**: Pada halaman login, tersedia tombol cepat untuk mencoba akun dengan status langganan aktif maupun akun dalam kondisi masa tenggang H-3.
