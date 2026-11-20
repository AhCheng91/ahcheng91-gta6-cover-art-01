// Entry program for gta6-cover-art-01. Plain TypeScript that Node 22 runs as-is:
// no build, no install, standard library only. It stages what the bounty hands in
// (app/, screenshots/) into one directory and writes the dossier that describes it.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Every path comes from this file's own location, never from process.cwd(): the
// grader runs with its working directory at / and a read-only /bot.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-app.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });

const appSource = join(root, 'app');
if (!existsSync(appSource)) throw new Error(`no app/ beside main.ts (looked in ${root})`);
cpSync(appSource, join(out, 'app'), { recursive: true });

const shotsSource = join(root, 'screenshots');
const shotsTarget = join(out, 'screenshots');
mkdirSync(shotsTarget, { recursive: true });
if (existsSync(shotsSource)) cpSync(shotsSource, shotsTarget, { recursive: true });

const dossier = buildDossier(out, CAPS);
const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);

console.log(`wrote ${dossierPath} (${dossier.length} bytes)`);
