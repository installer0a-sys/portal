import fs from 'node:fs';
import path from 'node:path';

const routerPath = path.join(process.cwd(), '..', 'apps-script', 'ApiRouter.gs');
if (!fs.existsSync(routerPath)) throw new Error('ApiRouter.gs tidak ditemukan.');

let source = fs.readFileSync(routerPath, 'utf8');
source = source.replace(
  "return appAScheduleList_(context, payload);",
  "return appAScheduleListV061_(context, payload);"
);
fs.writeFileSync(routerPath, source);
console.log('v0.6.1 schedule route parity applied.');
