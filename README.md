# StoreSage Multi-Tenant Inventory 📊🛒

Selamat datang di **StoreSage**, platform Software-as-a-Service (SaaS) manajemen inventaris multi-tenant yang dirancang khusus untuk pelaku UMKM. Aplikasi ini menyediakan sistem pencatatan stok, produk, visualisasi data, pengawasan billing, dan notifikasi pembayaran yang aman dan terisolasi secara menyeluruh antar-penyewa (tenant) menggunakan Firebase Authentication dan Firestore Security Rules.

---

## 🛠️ Solusi Masalah `auth/invalid-credential`

Jika Anda atau pengguna mengalami error **"Firebase: Error (auth/invalid-credential)"**, hal tersebut umumnya terjadi karena:
1. **Kredensial Belum Terdaftar**: Email & password yang dimasukkan belum terdaftar pada Firebase Auth.
2. **Kombinasi Salah/Stale**: Salah mengetik password atau salah memasukkan kombinasi email.

### Langkah Perbaikan yang Telah Diimplementasikan:
* **Form Pendaftaran Mandiri**: Kami telah menambahkan fungsionalitas registrasi langsung di layar autentikasi utama. Cukup klik **"Belum punya akun? Daftar Tenant Baru di sini"** untuk langsung mendaftarkan UMKM baru, nama owner, beserta email secara real-time.
* **Auto-Bootstrap Super Admin**: Khusus untuk Anda sebagai pemilik email `admin@storesage.com` atau `ridhowicaksono@storesage.com`, jika Anda masuk menggunakan Google Login atau mendaftar secara manual menggunakan email tersebut, sistem akan otomatis mengidentifikasi dan menaikkan tingkat akses Anda menjadi **Super-Admin** tingkat tinggi dengan akses ke panel kontrol pengawasan billing.
* **UI Feedback Lebih Ramah**: Pesan error telah disesuaikan untuk membimbing pengguna agar beralih ke tombol register jika belum memiliki akun, atau menggunakan tombol **Uji Coba Instan** / **Masuk dengan Google**.

---

## 💎 Fitur Utama Aplikasi

### 1. Isolasi Data Multi-Tenant (Tingkat Tinggi)
Setiap tenant memiliki ruang kerja dan database produk yang bersih dan terisolasi. Melalui Firestore Security Rules (`firestore.rules`), karyawan atau admin toko A **tidak akan pernah bisa membaca atau memodifikasi** data barang milik toko B.

### 2. Panel Pengawasan Billing & Simulasi Notifikasi H-2
Sebagai salah satu inovasi utama untuk pembimbing atau dosen penguji, sistem menyertakan simulator log notifikasi otomatis:
* **Deteksi H-2**: Ketika masa aktif tenant bersisa kurang dari atau sama dengan 2 hari (48 jam), banner peringatan kuning yang mencolok akan muncul di bagian atas dasbor tenant untuk mengingatkan pembayaran.
* **Skenario Simulasi**: Melalui Panel Super Admin, Anda dapat mempercepat sisa masa aktif tenant menjadi 5 menit (Demo Kedaluwarsa) atau 2 hari (Demo H-2) dengan sekali klik.
* **Log Simulator Email**: Menyediakan visualisasi antrean email keluar (`SENDER: billing@storesage.com`) untuk mencontohkan bagaimana pengiriman email dikirim ke pemilik UMKM saat mendeteksi tenggat waktu kritis.

### 3. Manajemen Inventaris Lengkap
Mulai dari pencatatan produk dengan harga modal, harga jual, kuantitas stok terintegrasi, fitur penyesuaian stok manual, kalkulasi valuasi aset, hingga filter kategori dinamis.

---

## 🚀 Panduan Penggunaan Akun Uji Coba

Untuk mendemonstrasikan keseluruhan sistem secara instan, Anda dapat menggunakan opsi berikut di layar autentikasi:

1. **Uji Coba Sebagai Pemilik Toko A (Aktif)**
   * Klik tombol simulasi **Warung Makan Ibu Aminah**.
   * Anda akan masuk ke dasbor yang penuh dengan statistik aset, stok dinamis, dan produk siap pakai dengan masa berlangganan premium aktif.
2. **Uji Coba Sebagai Karyawan Toko B (Hampir Expired/H-2)**
   * Klik tombol simulasi **Kopi Sedap Malam (Staff)**.
   * Anda akan melihat banner peringatan kuning menyala di atas dasbor, mengarahkan staf untuk berkoordinasi melakukan perpanjangan paket.
3. **Mendaftar UMKM Baru Secara Bebas**
   * Klik **"Belum punya akun? Daftar Tenant Baru di sini"**.
   * Masukkan nama Anda, nama UMKM, email, dan kata sandi baru (minimal 6 karakter) lalu klik Daftar. Anda akan langsung memiliki workspace inventaris kosong yang siap diacak-acak.
4. **Masuk Sebagai Super Admin**
   * Gunakan email administrator `admin@storesage.com` atau `ridhowicaksono@storesage.com`.
   * Di sebelah kiri bawah menu navigasi, Anda akan melihat tombol **"⚙️ Panel Super Admin"** (bisa dibuka juga menggunakan Passkey super rahasia: `storesageadmin2026`). Di dalam panel ini, Anda dapat memantau seluruh tenant terdaftar, menghapusnya dari database, mengirim simulasi email bantuan, atau memperpanjang masa aktif dalam hitungan detik.

---

## 📂 Struktur Folder Utama

* `src/App.tsx` - File shell aplikasi utama, penampung state otentikasi global, detektor masa aktif periodik, dan navigasi utama.
* `src/components/AdminCreateTenantView.tsx` - Panel administrator tertinggi untuk manajemen tenant, kalibrasi billing, dan simulator pengiriman email keluar.
* `src/components/BillingExpiredView.tsx` - Tampilan penangguhan sistem (SaaS Lockdown) saat billing mendeteksi bahwa waktu berlangganan telah habis.
* `src/hooks/useAuth.tsx` - Custom React Hook yang menangani logika Firebase Auth, bootstrapping otomatis akun super admin, registrasi tenant baru, dan penulisan dokumen metadata ke Firestore.
* `firestore.rules` - Aturan keamanan yang dideploy di Firestore guna menjamin integritas multi-tenant.
* `firebase-blueprint.json` - Struktur pemetaan database awal untuk validasi fungsional runtime.
