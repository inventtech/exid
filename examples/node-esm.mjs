// Run: node examples/node-esm.mjs   (after `bun run build`)
import { createExid, EXID_BODY_LEN } from '../dist/esm/index.js';

// Create each generator ONCE at module scope — that is what owns the counter.
const ids = {
  user: createExid('usr'),
  order: createExid('ord'),
};

console.log('body length :', EXID_BODY_LEN);
console.log('user        :', ids.user());
console.log('user        :', ids.user());
console.log('order       :', ids.order());

// Every id from one generator is distinct — structurally, not statistically.
const minted = new Set(Array.from({ length: 100_000 }, ids.user));
console.log(`minted ${minted.size.toLocaleString()} unique ids from one generator`);
