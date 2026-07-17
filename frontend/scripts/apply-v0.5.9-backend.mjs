import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routerPath = path.join(root, '..', 'apps-script', 'ApiRouter.gs');
if (!fs.existsSync(routerPath)) {
  console.log('v0.5.9 backend router patch dilewati saat frontend build.');
  process.exit(0);
}

let source = fs.readFileSync(routerPath, 'utf8');
const marker = "case 'appA.schedule.editor.validate':";

if (!source.includes(marker)) {
  const anchor = "case 'appA.schedule.editor.save': {";
  if (!source.includes(anchor)) {
    throw new Error('v0.5.9 gagal: route editor save tidak ditemukan.');
  }

  source = source.replace(anchor,
`case 'appA.schedule.editor.validate': {
      const context = validateSession_(sessionToken);
      return appAScheduleEditorValidate_(context, payload);
    }
    case 'appA.schedule.editor.save': {`);
}

source = source.replace(
  "return appAScheduleEditorSave_(context, payload, requestId);",
  "return appAScheduleEditorSaveV059_(context, payload, requestId);"
);

fs.writeFileSync(routerPath, source);
console.log('v0.5.9 backend router applied.');
