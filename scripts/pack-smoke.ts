/**
 * Installs the real npm tarball into a throwaway project and mints an id through BOTH
 * `import` and `require`. This is the only check that exercises the published `exports`
 * map — a broken condition or a missing `.d.ts` passes every unit test and fails on the
 * first consumer.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const ID_RE = /^usr_[a-z][a-z0-9]{23}$/;

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

const work = mkdtempSync(join(tmpdir(), 'exid-pack-'));
try {
  const tarball = join(ROOT, run('npm', ['pack', '--silent'], ROOT).split('\n').pop() ?? '');
  console.log(`pack-smoke: built ${tarball}`);

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'exid-pack-smoke', version: '1.0.0', private: true }, null, 2));
  run('npm', ['install', '--silent', '--no-audit', '--no-fund', tarball], work);

  writeFileSync(
    join(work, 'esm.mjs'),
    [
      'import { createExid, EXID_BODY_LEN } from "exid";',
      'const id = createExid("usr")();',
      'console.log(JSON.stringify({ id, EXID_BODY_LEN }));',
    ].join('\n'),
  );
  writeFileSync(
    join(work, 'cjs.cjs'),
    [
      'const { createExid, EXID_BODY_LEN } = require("exid");',
      'const id = createExid("usr")();',
      'console.log(JSON.stringify({ id, EXID_BODY_LEN }));',
    ].join('\n'),
  );

  for (const [label, entry] of [
    ['import', 'esm.mjs'],
    ['require', 'cjs.cjs'],
  ] as const) {
    const parsed = JSON.parse(run('node', [entry], work)) as { id: string; EXID_BODY_LEN: number };
    if (!ID_RE.test(parsed.id)) throw new Error(`pack-smoke(${label}): minted id '${parsed.id}' does not match ${ID_RE}`);
    if (parsed.EXID_BODY_LEN !== 24) throw new Error(`pack-smoke(${label}): EXID_BODY_LEN was ${parsed.EXID_BODY_LEN}, expected 24`);
    console.log(`pack-smoke: ${label} -> ${parsed.id} ✓`);
  }

  rmSync(tarball, { force: true });
  console.log('pack-smoke: OK');
} finally {
  rmSync(work, { recursive: true, force: true });
}
