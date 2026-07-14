# Portal V3 Foundation

Frontend: GitHub Pages + Vite + Tailwind CSS + PWA.
Backend: Google Apps Script terikat ke spreadsheet Portal.
URL target: `https://USERNAME.github.io/portal/`.

## Urutan setup singkat
1. Buat spreadsheet baru dan buka Extensions > Apps Script.
2. Catat Script ID, lalu buat `apps-script/.clasp.json` dari contoh di tutorial.
3. Jalankan `npx clasp push`, lalu jalankan fungsi `setupPortalSheets` sekali.
4. Deploy Apps Script sebagai Web App dan masukkan URL `/exec` ke `frontend/src/core/config.js`.
5. Buat repository GitHub bernama `portal`, push proyek, lalu aktifkan Pages melalui GitHub Actions.

Jangan membuat user produksi sebelum modul hashing password dan session selesai pada fase autentikasi.
