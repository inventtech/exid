/**
 * Dual ESM + CJS build. Plain .mjs on purpose — `prepublishOnly` runs under whatever
 * package manager publishes, so the build must not require bun.
 *
 * The `type` markers written at the end are what let Node read dist/esm as ESM and
 * dist/cjs as CommonJS despite the root package.json declaring `"type": "module"`.
 */
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
// TypeScript 7 does not expose ./bin/tsc through its `exports` map, so resolve the
// package manifest (which is exported) and walk to the shim from there.
const tsc = new URL('bin/tsc', pathToFileURL(require.resolve('typescript/package.json')));
const root = new URL('..', import.meta.url);

rmSync(new URL('dist', root), { recursive: true, force: true });

for (const project of ['tsconfig.build.json', 'tsconfig.build.cjs.json']) {
  execFileSync(process.execPath, [tsc.pathname, '-p', project], { cwd: root.pathname, stdio: 'inherit' });
  console.log(`build: emitted ${project}`);
}

for (const [dir, type] of [
  ['dist/esm', 'module'],
  ['dist/cjs', 'commonjs'],
]) {
  writeFileSync(new URL(`${dir}/package.json`, root), `${JSON.stringify({ type }, null, 2)}\n`);
  console.log(`build: ${dir}/package.json -> { "type": "${type}" }`);
}
