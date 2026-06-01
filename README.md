# Alumni PP Al-Fatah - Standalone Static Web Version

Ini adalah versi web mandiri murni statis (*purely static serverless web version*) dari aplikasi **Alumni PP Al-Fatah**. 

Versi ini tidak membutuhkan server Node.js lokal sama sekali. Seluruh data terhubung secara serverless dan langsung ke Cloud Firestore. Anda dapat langsung mengunggah folder ini ke hosting web statis gratis mana pun (seperti Netlify, Vercel, Firebase Hosting, atau GitHub Pages) untuk melayani ribuan pengguna sekaligus tanpa biaya hosting!

---

## 🚀 Cara Menjalankan

### 1. Dijalankan Secara Lokal di PC (Mendukung Google Sign-In)
Keamanan Google OAuth melarang otentikasi melalui berkas lokal langsung (`file://`). Untuk menguji aplikasi secara lokal dengan fungsionalitas Google Sign-In penuh:
1. Klik ganda berkas **`jalankan-aplikasi.bat`** di dalam folder ini.
2. Skrip pintar ini secara otomatis akan mendeteksi Python, Node.js, atau PHP di komputer Anda, menjalankan server statis ringan pada port `3000`, dan membuka browser pada alamat **`http://localhost:3000`**.
3. *Catatan*: Jika Anda hanya ingin melihat tampilan atau menggunakan email & password, Anda tetap dapat mengklik ganda berkas HTML langsung.

### 2. Diunggah ke Hosting Gratis (GitHub Pages, Netlify, Vercel)
Aplikasi ini murni statis dan serverless, sehingga sangat mudah untuk di-deploy secara instan dan gratis:
* **Netlify / Vercel**: Drag-and-drop folder `alumni web` ini ke dashboard Netlify Anda.
* **GitHub Pages**: Buat repositori baru di GitHub, unggah seluruh berkas di dalam folder ini, lalu aktifkan fitur GitHub Pages pada tab Settings repositori.

> [!IMPORTANT]
> **PENTING: Konfigurasi Google Login untuk Domain Hosting Anda**:
> Agar fitur masuk dengan Google dapat berfungsi pada domain deployment Anda (seperti `username.github.io`), Anda **wajib mengotorisasi domain tersebut** di Firebase Console proyek Anda:
> 1. Masuk ke **[Firebase Console](https://console.firebase.google.com/)** -> pilih proyek **reuniakbar**.
> 2. Di bilah menu kiri, buka bagian **Authentication** -> klik tab **Settings** di kanan atas.
> 3. Gulir ke bawah ke panel **Authorized Domains** (Domain Terotorisasi), lalu klik tombol **Add Domain**.
> 4. Masukkan domain Anda (misal: <code class="bg-indigo-950/60 border border-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-300 font-mono font-bold select-all">username.github.io</code> — tanpa https:// atau nama subfolder) lalu klik **Save**.

---

## 📦 Fitur yang Disesuaikan pada Versi Web Statis:
1. **Pembersihan Node.js & Baileys**: Seluruh modul Node.js server, pemindaian QR code WhatsApp, dan pengiriman broadcast massal otomatis via bot internal dihapus demi menjaga kebersihan berkas dan kinerja browser.
2. **Direct WhatsApp Chat (Tetap Aktif)**: Ikon chat WhatsApp di samping nama alumni tetap aktif! Mengkliknya akan langsung mengarahkan Anda ke tautan resmi `https://wa.me/62...` untuk memulai chat secara personal lewat WhatsApp Web atau aplikasi HP secara langsung.
3. **Firestore Serverless**: Seluruh data alumni, donasi, rundown, panitia, logistik, dan tugas disimpan dan disinkronkan secara langsung ke database Firebase Firestore di Cloud secara aman.
4. **Cetak PDF & Excel**: Fitur cetak E-Ticket PDF, Kwitansi Donasi PDF, Ekspor Laporan Excel, LPJ Resmi, dan Laporan Wilayah tetap aktif 100% menggunakan pustaka klien di browser.
