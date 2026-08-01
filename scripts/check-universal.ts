/**
 * Fails if any Node built-in leaks into the published bundle. This is the property that
 * makes exid importable from Cloudflare Workers, Vercel Edge, Deno and browsers — a single
 * `node:crypto` import would break all four, and no unit test running under Node would notice.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname.replace(/\/$/, '');
const FORBIDDEN = /(?:from|require\()\s*['"](node:[a-z/]+|fs|path|crypto|os|util|buffer|stream)['"]/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const offenders: string[] = [];
for (const file of walk(DIST).filter((f) => f.endsWith('.js'))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(FORBIDDEN)) {
    offenders.push(`${file.slice(DIST.length + 1)}: ${match[0].trim()}`);
  }
}

if (offenders.length > 0) {
  console.error('check-universal: Node built-ins found in dist — exid must stay runtime-agnostic:');
  for (const offender of offenders) console.error(`  ${offender}`);
  process.exit(1);
}
console.log('check-universal: dist imports no Node built-ins ✓');
