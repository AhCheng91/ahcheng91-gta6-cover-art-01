// Entry program for the gta6-cover-art-01 entry. Plain TypeScript that Node 22
// runs directly: no build step, no install, standard library plus the vendored
// make.fun library only. It stages what the entry hands in (app/ and
// screenshots/) into one output directory and writes the dossier describing it.
//
//   MAKEFUN_OUTPUT_DIR=/tmp/r6out node main.ts
//
// Every path is resolved from this file's own location, never from
// process.cwd(): the grader runs with its working directory at / and a
// read-only /bot.

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000
};

const appSource = join(here, 'app');
if (!existsSync(appSource) || !statSync(appSource).isDirectory()) {
  throw new Error(`app/ is missing: expected a directory at ${appSource} beside main.ts`);
}

mkdirSync(out, { recursive: true });

cpSync(appSource, join(out, 'app'), { recursive: true });

const shotsSource = join(here, 'screenshots');
if (existsSync(shotsSource)) {
  cpSync(shotsSource, join(out, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(out, CAPS);
const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);

console.log(`wrote ${dossierPath} (${dossier.length} bytes)`);
