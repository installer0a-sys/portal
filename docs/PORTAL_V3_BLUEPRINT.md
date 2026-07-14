# Portal V3 Blueprint

## Tujuan

Portal V3 memakai GitHub Pages untuk frontend, Vite + Tailwind CSS untuk build/UI, Google Apps Script sebagai backend API, dan Google Spreadsheet sebagai data source.

Target utama: ringan, responsif, modular, aman, mudah dikembangkan, mudah di-debug, dan tidak membawa kode Engine V2.

## Arsitektur

```text
Browser / PWA
  +-- Portal utama: /portal/
  +-- App A standalone: /portal/app-a/
  +-- Frontend Core
        +-- Router
        +-- Store
        +-- Auth
        +-- Session
        +-- Cache
        +-- API Client
        +-- Logger
        +-- Diagnostics
        +-- Modal
        +-- Toast
        +-- PWA Manager
        +-- Module Loader
              +-- Dashboard
              +-- App A
              +-- App B
              +-- App C
              +-- App D
              +-- App E

Frontend -> HTTPS fetch -> Google Apps Script API -> Spreadsheet
```

## Prinsip

1. Portal adalah SPA modular. Buka App A dari Portal tidak reload halaman.
2. Standalone App A memakai modul bisnis yang sama dengan App A di Portal.
3. Backend tetap sumber keamanan. Frontend hanya mengatur tampilan.
4. Setiap aplikasi wajib memiliki `mount`, `refresh`, dan `unmount`.
5. Tidak ada `location.reload()` untuk navigasi aplikasi.
6. Tidak ada iframe Apps Script.
7. Tidak ada password plaintext atau token di log.
8. Cache user wajib memakai user ID dan permission signature.
9. Logout tidak menghapus static cache atau cache data yang sudah di-scope.
10. Semua milestone wajib build, test, commit, dan tag.

## Lifecycle Modul

```javascript
export async function mount(container, context) {
  // render shell
  // bind event
  // tampilkan cache bila ada
  // load data terbaru
}

export async function refresh(context) {
  // refresh tanpa remount
}

export async function unmount() {
  // hentikan timer
  // hapus subscription/listener lokal
  // jangan hapus cache data
}
```

## Role dan Permission

Role Portal terpisah dari role setiap aplikasi.

```text
Portal Role: ADMIN | USER | NONE
App Role: MANAGER | EDITOR | VIEWER | NONE
```

Contoh:

```text
User U001
Portal Role: ADMIN
App A Role: VIEWER
App B Role: MANAGER
```

Backend selalu memeriksa session token, status user, session version, app role, dan permission endpoint.

## Cache

### Static cache
HTML, CSS, JavaScript, ikon, manifest.

### Shared cache
Data umum yang aman untuk semua user.

### User-scoped cache

```text
appId:userId:permissionSignature:dataKey:version
```

Contoh:

```text
appA:U001:perm_a12b:schedule:v1
```

### Runtime UI state
Dihapus saat logout: user aktif, permission aktif, route sensitif, modal, loading, hasil render user lama.

Tidak dihapus saat logout: static cache, shared cache, cache user lama yang sudah di-scope, service worker, IndexedDB.

## API

Request:

```json
{
  "requestId": "uuid",
  "action": "appA.getData",
  "payload": {},
  "sessionToken": "token"
}
```

Response sukses:

```json
{
  "ok": true,
  "data": {},
  "message": "",
  "meta": {
    "requestId": "",
    "durationMs": 0,
    "version": ""
  }
}
```

## PWA

Portal utama:

```text
https://installer0a-sys.github.io/portal/
```

App A standalone:

```text
https://installer0a-sys.github.io/portal/app-a/
```

Standalone app tetap login, langsung membuka app, dan tidak memuat Dashboard/sidebar Portal/app lain.
