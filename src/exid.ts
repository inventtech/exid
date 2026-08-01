/**
 * exid — collision-free public-id bodies with zero database dependency.
 * Per-boot CSPRNG identity + monotonic counter through a keyed Feistel bijection:
 * collisions within one generator are structurally impossible; across generators
 * (other processes, machines, workers) the guarantee stays CSPRNG-grade.
 */
import { randomBelow, randomKey } from './random.js';
import { siphash24F53 } from './siphash.js';

const P4 = 36 ** 4;
const P7 = 36 ** 7;

/** Branch domains. D1 pins the leading body char to a-z; total space = 26·36^23 (~2^123.6). */
export const D1 = 26 * P7;
export const D2 = 36 ** 8;
export const D3 = 36 ** 8;

/** Minted body length (24) — `<a-z><23 × base36>`; the layout is fixed, no length option. */
export const EXID_BODY_LEN = 24;

/**
 * Feistel rounds — each branch is mixed twice by a SipHash-2-4 PRF of the other two.
 * Adversary model is output-only (no permutation oracle); see the README §Security model.
 */
const ROUNDS = 6;

const TWO_32 = 4294967296;

function prf(x: number, y: number, round: number, k: Int32Array): number {
  // message = x ‖ (y + round tag in the top byte); x, y < 2^42 so bit 24+ of the hi words is free.
  // Everything is passed in signed-int32 form — a double-typed argument deopts the PRF ~10×.
  return siphash24F53(k[0], k[1], k[2], k[3], x | 0, Math.floor(x / TWO_32), y | 0, Math.floor(y / TWO_32) | (round << 24));
}

// permutation results land here — the mint hot path allocates nothing
let pA = 0;
let pB = 0;
let pC = 0;

function permuteInto(a: number, b: number, c: number, k: Int32Array): void {
  for (let r = 0; r < ROUNDS; r++) {
    const branch = r % 3;
    if (branch === 0) a = (a + (prf(b, c, r, k) % D1)) % D1;
    else if (branch === 1) b = (b + (prf(c, a, r, k) % D2)) % D2;
    else c = (c + (prf(a, b, r, k) % D3)) % D3;
  }
  pA = a;
  pB = b;
  pC = c;
}

/** Keyed bijection on D1 × D2 × D3 (allocating wrapper — tests/tools; the mint path uses permuteInto). */
export function permute3(a: number, b: number, c: number, k: Int32Array): [number, number, number] {
  permuteInto(a, b, c, k);
  return [pA, pB, pC];
}

/** Inverse of permute3 — exists to prove bijectivity; never used when minting. */
export function unpermute3(a: number, b: number, c: number, k: Int32Array): [number, number, number] {
  for (let r = ROUNDS - 1; r >= 0; r--) {
    const branch = r % 3;
    if (branch === 0) a = (a - (prf(b, c, r, k) % D1) + D1) % D1;
    else if (branch === 1) b = (b - (prf(c, a, r, k) % D2) + D2) % D2;
    else c = (c - (prf(a, b, r, k) % D3) + D3) % D3;
  }
  return [a, b, c];
}

const C36: number[] = Array.from('0123456789abcdefghijklmnopqrstuvwxyz', (ch) => ch.charCodeAt(0));
const out: number[] = new Array(EXID_BODY_LEN).fill(0);

function put4(v: number, at: number): void {
  // v < 36^4 fits int32 → 4 base36 digits with integer-only ops
  out[at + 3] = C36[v % 36];
  let q = (v / 36) | 0;
  out[at + 2] = C36[q % 36];
  q = (q / 36) | 0;
  out[at + 1] = C36[q % 36];
  out[at] = C36[(q / 36) | 0];
}

/** Encode a permuted (a, b, c) triple as the 24-char body — first char a-z by D1's construction. */
export function encodeBody(a: number, b: number, c: number): string {
  out[0] = 97 + Math.floor(a / P7);
  const rest = a % P7;
  const restHi = Math.floor(rest / P4); // restHi < 36^3 → 3 digits; 1296 = 36^2
  out[1] = C36[(restHi / 1296) | 0];
  out[2] = C36[((restHi / 36) | 0) % 36];
  out[3] = C36[restHi % 36];
  put4(rest % P4, 4);
  put4(Math.floor(b / P4), 8);
  put4(b % P4, 12);
  put4(Math.floor(c / P4), 16);
  put4(c % P4, 20);
  return String.fromCharCode(...out);
}

/** Per-generator minting state. Counter wrap triggers a full reseed — a counter value is never reused. */
export interface ExidState {
  /** SipHash-2-4 key as signed-int32 words [k0l, k0h, k1l, k1h] — never leaves process memory. */
  k: Int32Array;
  boot1: number;
  boot2: number;
  counter: number;
}

/** Draw a fresh boot identity + key from the CSPRNG — the only entropy exid ever consumes. */
export function freshState(): ExidState {
  return {
    k: randomKey(),
    boot1: randomBelow(D1),
    boot2: randomBelow(D2),
    counter: 0,
  };
}

const PREFIX_RE = /^[a-z][a-z0-9]{0,11}$/;

/** State-injectable factory — exported for deterministic tests; production callers use createExid(). */
export function createExidFromState(prefix: string, state: ExidState): () => string {
  if (!PREFIX_RE.test(prefix)) {
    throw new TypeError(`exid prefix must match ${PREFIX_RE}, got '${prefix}'`);
  }
  const head = `${prefix}_`;
  return (): string => {
    if (state.counter >= D3) {
      const fresh = freshState();
      state.k = fresh.k;
      state.boot1 = fresh.boot1;
      state.boot2 = fresh.boot2;
      state.counter = 0;
    }
    permuteInto(state.boot1, state.boot2, state.counter++, state.k);
    return head + encodeBody(pA, pB, pC);
  };
}

/**
 * Create a generator minting `<prefix>_<a-z><23 × base36>` ids (28 chars at a 3-char prefix).
 * Ids from ONE generator never collide for its whole lifetime; across generators the
 * collision probability is ~2^-124 per pair. Create it once and reuse it — see the README.
 */
export function createExid(prefix: string): () => string {
  return createExidFromState(prefix, freshState());
}
