import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'src/apps/app-a/index.js');
const entriesPath = path.join(root, 'src/entries/portal.js');

function replaceAllVersions(source) {
  return source
    .replaceAll('portal.appA.v059.', 'portal.appA.v0510.')
    .replaceAll('portal.appA.v058.', 'portal.appA.v0510.')
    .replaceAll('Portal v0.5.9 | Design by Fredi', 'Portal v0.5.10 | Design by Fredi')
    .replaceAll('Portal v0.5.8 | Design by Fredi', 'Portal v0.5.10 | Design by Fredi');
}

if (!fs.existsSync(indexPath)) {
  throw new Error('v0.5.10 gagal: frontend App A tidak ditemukan.');
}

let source = fs.readFileSync(indexPath, 'utf8');
source = replaceAllVersions(source);
fs.writeFileSync(indexPath, source);

if (fs.existsSync(entriesPath)) {
  let entries = fs.readFileSync(entriesPath, 'utf8');
  entries = replaceAllVersions(entries);
  fs.writeFileSync(entriesPath, entries);
}

console.log('v0.5.10 editor validation hardening applied.');
