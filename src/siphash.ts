/**
 * SipHash-2-4 in 32-bit pair arithmetic (no BigInt on the hot path).
 * Keyed PRF backing the exid Feistel rounds; validated against the reference
 * vectors from https://github.com/veorq/SipHash (see siphash.test.ts).
 */

// 64-bit state as u32 pairs (module-scope: reference byte path only — the hot path uses locals)
let s0l = 0;
let s0h = 0;
let s1l = 0;
let s1h = 0;
let s2l = 0;
let s2h = 0;
let s3l = 0;
let s3h = 0;

function initState(k0l: number, k0h: number, k1l: number, k1h: number): void {
  s0l = (0x70736575 ^ k0l) >>> 0;
  s0h = (0x736f6d65 ^ k0h) >>> 0;
  s1l = (0x6e646f6d ^ k1l) >>> 0;
  s1h = (0x646f7261 ^ k1h) >>> 0;
  s2l = (0x6e657261 ^ k0l) >>> 0;
  s2h = (0x6c796765 ^ k0h) >>> 0;
  s3l = (0x79746573 ^ k1l) >>> 0;
  s3h = (0x74656462 ^ k1h) >>> 0;
}

function sipRound(): void {
  let t = s0l + s1l;
  s0l = t >>> 0;
  s0h = (s0h + s1h + (t > 0xffffffff ? 1 : 0)) >>> 0;
  let u = ((s1h << 13) | (s1l >>> 19)) >>> 0;
  s1l = ((s1l << 13) | (s1h >>> 19)) >>> 0;
  s1h = u;
  s1l = (s1l ^ s0l) >>> 0;
  s1h = (s1h ^ s0h) >>> 0;
  u = s0l;
  s0l = s0h;
  s0h = u;
  t = s2l + s3l;
  s2l = t >>> 0;
  s2h = (s2h + s3h + (t > 0xffffffff ? 1 : 0)) >>> 0;
  u = ((s3h << 16) | (s3l >>> 16)) >>> 0;
  s3l = ((s3l << 16) | (s3h >>> 16)) >>> 0;
  s3h = u;
  s3l = (s3l ^ s2l) >>> 0;
  s3h = (s3h ^ s2h) >>> 0;
  t = s0l + s3l;
  s0l = t >>> 0;
  s0h = (s0h + s3h + (t > 0xffffffff ? 1 : 0)) >>> 0;
  u = ((s3h << 21) | (s3l >>> 11)) >>> 0;
  s3l = ((s3l << 21) | (s3h >>> 11)) >>> 0;
  s3h = u;
  s3l = (s3l ^ s0l) >>> 0;
  s3h = (s3h ^ s0h) >>> 0;
  t = s2l + s1l;
  s2l = t >>> 0;
  s2h = (s2h + s1h + (t > 0xffffffff ? 1 : 0)) >>> 0;
  u = ((s1h << 17) | (s1l >>> 15)) >>> 0;
  s1l = ((s1l << 17) | (s1h >>> 15)) >>> 0;
  s1h = u;
  s1l = (s1l ^ s2l) >>> 0;
  s1h = (s1h ^ s2h) >>> 0;
  u = s2l;
  s2l = s2h;
  s2h = u;
}

function compress(ml: number, mh: number): void {
  s3l = (s3l ^ ml) >>> 0;
  s3h = (s3h ^ mh) >>> 0;
  sipRound();
  sipRound();
  s0l = (s0l ^ ml) >>> 0;
  s0h = (s0h ^ mh) >>> 0;
}

function finalize(): void {
  s2l = (s2l ^ 0xff) >>> 0;
  sipRound();
  sipRound();
  sipRound();
  sipRound();
}

/**
 * SipHash-2-4 of a fixed 16-byte message (two u64 words as u32 pairs), folded to a
 * 53-bit float-safe integer: hi·2^21 + top 21 bits of lo. The exid Feistel hot path.
 *
 * Everything stays in SIGNED int32 representation (`| 0`, majority-function carries) —
 * a u32 ≥ 2^31 is a heap double in JS engines and one double-typed argument was measured
 * to deopt the mint path ~12×. Bit-equivalence with the reference byte path (itself
 * validated against all 64 official vectors) is asserted in siphash.test.ts.
 */
export function siphash24F53(k0l: number, k0h: number, k1l: number, k1h: number, m0l: number, m0h: number, m1l: number, m1h: number): number {
  m0l |= 0;
  m0h |= 0;
  m1l |= 0;
  m1h |= 0;
  let v0l = 0x70736575 ^ k0l;
  let v0h = 0x736f6d65 ^ k0h;
  let v1l = 0x6e646f6d ^ k1l;
  let v1h = 0x646f7261 ^ k1h;
  let v2l = 0x6e657261 ^ k0l;
  let v2h = 0x6c796765 ^ k0h;
  let v3l = 0x79746573 ^ k1l;
  let v3h = 0x74656462 ^ k1h;
  // phases 0-2 compress m0, m1, then the 16-byte-length padding block; phase 3 finalizes
  for (let phase = 0; phase < 4; phase++) {
    let ml = 0;
    let mh = 0;
    if (phase === 0) {
      ml = m0l;
      mh = m0h;
    } else if (phase === 1) {
      ml = m1l;
      mh = m1h;
    } else if (phase === 2) {
      mh = 0x10000000; // length byte 16 << 56
    }
    if (phase < 3) {
      v3l ^= ml;
      v3h ^= mh;
    } else {
      v2l ^= 0xff;
    }
    const rounds = phase < 3 ? 2 : 4;
    for (let r = 0; r < rounds; r++) {
      let t = (v0l + v1l) | 0;
      v0h = (v0h + v1h + (((v0l & v1l) | ((v0l | v1l) & ~t)) >>> 31)) | 0;
      v0l = t;
      let u = (v1h << 13) | (v1l >>> 19);
      v1l = (v1l << 13) | (v1h >>> 19);
      v1h = u;
      v1l ^= v0l;
      v1h ^= v0h;
      u = v0l;
      v0l = v0h;
      v0h = u;
      t = (v2l + v3l) | 0;
      v2h = (v2h + v3h + (((v2l & v3l) | ((v2l | v3l) & ~t)) >>> 31)) | 0;
      v2l = t;
      u = (v3h << 16) | (v3l >>> 16);
      v3l = (v3l << 16) | (v3h >>> 16);
      v3h = u;
      v3l ^= v2l;
      v3h ^= v2h;
      t = (v0l + v3l) | 0;
      v0h = (v0h + v3h + (((v0l & v3l) | ((v0l | v3l) & ~t)) >>> 31)) | 0;
      v0l = t;
      u = (v3h << 21) | (v3l >>> 11);
      v3l = (v3l << 21) | (v3h >>> 11);
      v3h = u;
      v3l ^= v0l;
      v3h ^= v0h;
      t = (v2l + v1l) | 0;
      v2h = (v2h + v1h + (((v2l & v1l) | ((v2l | v1l) & ~t)) >>> 31)) | 0;
      v2l = t;
      u = (v1h << 17) | (v1l >>> 15);
      v1l = (v1l << 17) | (v1h >>> 15);
      v1h = u;
      v1l ^= v2l;
      v1h ^= v2h;
      u = v2l;
      v2l = v2h;
      v2h = u;
    }
    if (phase < 3) {
      v0l ^= ml;
      v0h ^= mh;
    }
  }
  const hi = (v0h ^ v1h ^ v2h ^ v3h) >>> 0;
  const lo = (v0l ^ v1l ^ v2l ^ v3l) >>> 0;
  return hi * 0x200000 + (lo >>> 11);
}

function readLE32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

/** Reference SipHash-2-4 over arbitrary bytes → [hi, lo] u32 pair. Used by tests + vectors. */
export function siphash24(key: Uint8Array, msg: Uint8Array): [number, number] {
  if (key.length !== 16) {
    throw new TypeError(`SipHash key must be 16 bytes, got ${key.length}`);
  }
  initState(readLE32(key, 0), readLE32(key, 4), readLE32(key, 8), readLE32(key, 12));
  const wholeBlocks = msg.length - (msg.length % 8);
  for (let i = 0; i < wholeBlocks; i += 8) {
    compress(readLE32(msg, i), readLE32(msg, i + 4));
  }
  let ml = 0;
  let mh = 0;
  for (let j = 0; j < (msg.length & 7); j++) {
    const byte = msg[wholeBlocks + j];
    if (j < 4) ml |= byte << (8 * j);
    else mh |= byte << (8 * (j - 4));
  }
  mh = (mh | ((msg.length & 0xff) << 24)) >>> 0;
  compress(ml >>> 0, mh);
  finalize();
  return [(s0h ^ s1h ^ s2h ^ s3h) >>> 0, (s0l ^ s1l ^ s2l ^ s3l) >>> 0];
}
