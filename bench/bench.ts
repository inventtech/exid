/**
 * Usage: bun bench/bench.ts   (or `bun run bench`)
 *
 * Throughput of exid against the id generators people actually reach for. Numbers land in
 * the README together with this methodology: 30k warm-up iterations, then a timed run of
 * 500k mints per generator, single-threaded, no I/O.
 *
 * `legacy randomInt×24` is the shape exid replaced (one CSPRNG draw per character) — kept
 * as the reference point that motivated the design.
 */
import { createId as cuid2 } from '@paralleldrive/cuid2';
import { nanoid } from 'nanoid';
import { createExid } from '../src/exid.js';

const ALPHA36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const bytes = new Uint8Array(24);

function legacyPerCharCsprng(): string {
  crypto.getRandomValues(bytes);
  let body = '';
  for (let i = 0; i < 24; i++) body += ALPHA36[bytes[i] % 36];
  return `svy_${body}`;
}

function bench(fn: () => string, iterations: number): number {
  for (let i = 0; i < 30_000; i++) fn();
  const started = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  return (iterations / (Number(process.hrtime.bigint() - started) / 1e6)) * 1000;
}

if (import.meta.main) {
  const n = 500_000;
  const contenders: [label: string, fn: () => string][] = [
    ['exid', createExid('svy')],
    ['nanoid', () => nanoid()],
    ['cuid2', () => cuid2()],
    ['crypto.randomUUID', () => crypto.randomUUID()],
    ['legacy randomInt×24', legacyPerCharCsprng],
  ];

  const results = contenders.map(([label, fn]) => [label, bench(fn, n)] as const);
  const exidRate = results.find(([label]) => label === 'exid')?.[1] ?? 1;
  const width = Math.max(...results.map(([label]) => label.length));

  console.log(`${n.toLocaleString()} ids per generator, single thread\n`);
  for (const [label, rate] of results) {
    const ratio = rate / exidRate;
    const relative = label === 'exid' ? '' : `  (${ratio >= 1 ? `${ratio.toFixed(2)}× faster` : `${(1 / ratio).toFixed(2)}× slower`} than exid)`;
    console.log(`${label.padEnd(width)} : ${Math.round(rate).toLocaleString().padStart(12)} ids/s${relative}`);
  }
}
