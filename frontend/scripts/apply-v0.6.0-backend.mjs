import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routerPath = path.join(root, '..', 'apps-script', 'ApiRouter.gs');

if (!fs.existsSync(routerPath)) {
  throw new Error('ApiRouter.gs tidak ditemukan.');
}

let source = fs.readFileSync(routerPath, 'utf8');

if (!source.includes("case 'appA.schedule.generate.options':")) {
  const anchor = "case 'appA.config.get': {";
  if (!source.includes(anchor)) {
    throw new Error('Anchor appA.config.get tidak ditemukan.');
  }

  source = source.replace(anchor,
`case 'appA.schedule.generate.options': {
      const context = validateSession_(sessionToken);
      return appAGenerateOptions_(context, payload);
    }
    case 'appA.schedule.generate.preview': {
      const context = validateSession_(sessionToken);
      return appAGeneratePreview_(context, payload, requestId);
    }
    case 'appA.schedule.generate.apply': {
      const context = validateSession_(sessionToken);
      return appAGenerateApply_(context, payload, requestId);
    }
    ${anchor}`);
}

fs.writeFileSync(routerPath, source);
console.log('v0.6.0 backend routes applied.');
