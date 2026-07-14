# Portal V3 Architecture Rules

1. Tidak ada `location.reload()` untuk navigasi aplikasi.
2. Tidak ada iframe Apps Script.
3. Tidak ada password plaintext.
4. Tidak ada token di log.
5. Tidak ada role dipercaya dari frontend.
6. Tidak ada cache sensitif tanpa user scope.
7. Tidak ada event listener global tanpa cleanup.
8. Tidak ada aplikasi yang mengontrol Portal shell langsung.
9. Tidak ada request kecil berlebihan.
10. Tidak ada write Spreadsheet per sel dalam loop.
11. Semua API memakai request ID.
12. Semua API memakai format response seragam.
13. Semua loading memakai `try/finally`.
14. Semua app wajib memiliki `mount`, `refresh`, dan `unmount`.
15. Semua milestone wajib build, test, commit, dan tag.
