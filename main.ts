// The entry program (Node 22, standard library only). The app itself is this directory's app/
// folder — plain static files a desktop browser loads offline: app/index.html, its ES modules,
// CSS, the open-licence fonts and the sample photos. There is no build step and no network.
//
// This program hands the entry in: it checks the app and the screenshots exist, copies app/ and
// screenshots/ from beside this file to /output, and writes /output/dossier.json (the summary the
// judge reads) with the vendored make.fun library.
//
//   node main.ts                                  # writes to /output
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   node serve.ts --port 8080                     # then open http://localhost:8080

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const problems: string[] = [];
if (!existsSync(join(here, 'app', 'index.html'))) problems.push('app/index.html is missing');

const shotsDir = join(here, 'screenshots');
const shotCount = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name) && !name.startsWith('.')).length
  : 0;
if (shotCount < 3) problems.push(`screenshots/ holds ${shotCount} image${shotCount === 1 ? '' : 's'} (needs at least 3)`);

if (problems.length) {
  for (const problem of problems) console.error(`solaris-vice: ${problem}`);
  process.exit(1);
}

console.log(`solaris-vice: writing app/, screenshots/ and dossier.json to ${out}`);
mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than
// 993 files in app/ or 48 MiB of app files, in all, or a path under app/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
