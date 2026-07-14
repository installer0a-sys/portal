# Portal V3 Test Checklist

## Deployment
- [ ] `npm run build` berhasil
- [ ] `clasp push` berhasil bila backend berubah
- [ ] GitHub Actions hijau
- [ ] Portal production terbuka
- [ ] App A standalone terbuka

## Authentication
- [ ] login valid berhasil
- [ ] login salah ditolak
- [ ] rate limit bekerja
- [ ] logout tampilan instan
- [ ] sesi backend direvoke
- [ ] password/token tidak muncul di log

## Permission
- [ ] portal role terbaca
- [ ] app role terbaca
- [ ] backend menolak permission tidak valid
- [ ] elemen sensitif default hidden
- [ ] admin logout lalu user login tidak melihat UI admin

## Cache
- [ ] logout tidak menghapus static cache
- [ ] logout menghapus runtime user state
- [ ] cache user memakai user ID
- [ ] cache user memakai permission signature
- [ ] data admin tidak terbaca user lain

## Navigation
- [ ] Portal ke App A tanpa reload
- [ ] App A ke Dashboard tanpa reload
- [ ] back browser tidak merusak state
- [ ] App A standalone tidak memuat Portal
- [ ] event tidak ganda setelah pindah route

## Diagnostics
- [ ] route terlihat
- [ ] pending request kembali ke 0
- [ ] error terakhir terlihat
- [ ] API duration terlihat
- [ ] service worker status terlihat
- [ ] user/role terlihat tanpa token/password
