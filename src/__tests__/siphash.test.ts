import { describe, expect, it } from 'vitest';

import { siphash24, siphash24F53 } from '../siphash.js';

/**
 * Official SipHash-2-4 64-bit vectors from the reference implementation
 * (github.com/veorq/SipHash vectors.h, vectors_sip64): key = 00..0f, message i = bytes 00..i-1.
 * Stored as [hi, lo] u32 pairs of the little-endian 8-byte output.
 */
const VECTORS: ReadonlyArray<readonly [number, number]> = [
  [0x726fdb47, 0xdd0e0e31],
  [0x74f839c5, 0x93dc67fd],
  [0x0d6c8009, 0xd9a94f5a],
  [0x85676696, 0xd7fb7e2d],
  [0xcf2794e0, 0x277187b7],
  [0x18765564, 0xcd99a68d],
  [0xcbc9466e, 0x58fee3ce],
  [0xab0200f5, 0x8b01d137],
  [0x93f5f579, 0x9a932462],
  [0x9e0082df, 0x0ba9e4b0],
  [0x7a5dbbc5, 0x94ddb9f3],
  [0xf4b32f46, 0x226bada7],
  [0x751e8fbc, 0x860ee5fb],
  [0x14ea5627, 0xc0843d90],
  [0xf723ca90, 0x8e7af2ee],
  [0xa129ca61, 0x49be45e5],
  [0x3f2acc7f, 0x57c29bdb],
  [0x699ae9f5, 0x2cbe4794],
  [0x4bc1b3f0, 0x968dd39c],
  [0xbb6dc91d, 0xa77961bd],
  [0xbed65cf2, 0x1aa2ee98],
  [0xd0f2cbb0, 0x2e3b67c7],
  [0x93536795, 0xe3a33e88],
  [0xa80c038c, 0xcd5ccec8],
  [0xb8ad50c6, 0xf649af94],
  [0xbce192de, 0x8a85b8ea],
  [0x17d835b8, 0x5bbb15f3],
  [0x2f2e6163, 0x076bcfad],
  [0xde4daaac, 0xa71dc9a5],
  [0xa6a25066, 0x87956571],
  [0xad87a353, 0x5c49ef28],
  [0x32d892fa, 0xd841c342],
  [0x7127512f, 0x72f27cce],
  [0xa7f32346, 0xf95978e3],
  [0x12e0b01a, 0xbb051238],
  [0x15e034d4, 0x0fa197ae],
  [0x314dffbe, 0x0815a3b4],
  [0x027990f0, 0x29623981],
  [0xcadcd4e5, 0x9ef40c4d],
  [0x9abfd876, 0x6a33735c],
  [0x0e3ea96b, 0x5304a7d0],
  [0xad0c42d6, 0xfc585992],
  [0x187306c8, 0x9bc215a9],
  [0xd4a60abc, 0xf3792b95],
  [0xf935451d, 0xe4f21df2],
  [0xa9538f04, 0x19755787],
  [0xdb9acddf, 0xf56ca510],
  [0xd06c98cd, 0x5c0975eb],
  [0xe612a3cb, 0x9ecba951],
  [0xc766e62c, 0xfcadaf96],
  [0xee64435a, 0x9752fe72],
  [0xa192d576, 0xb245165a],
  [0x0a8787bf, 0x8ecb74b2],
  [0x81b3e73d, 0x20b49b6f],
  [0x7fa8220b, 0xa3b2ecea],
  [0x245731c1, 0x3ca42499],
  [0xb78dbfaf, 0x3a8d83bd],
  [0xea1ad565, 0x322a1a0b],
  [0x60e61c23, 0xa3795013],
  [0x6606d7e4, 0x46282b93],
  [0x6ca4ecb1, 0x5c5f91e1],
  [0x9f626da1, 0x5c9625f3],
  [0xe51b3860, 0x8ef25f57],
  [0x958a324c, 0xeb064572],
];

const KEY = Uint8Array.from({ length: 16 }, (_, i) => i);

describe('siphash24 (reference byte path)', () => {
  it('should reproduce all 64 official SipHash-2-4 vectors', () => {
    const results = VECTORS.map((_, len) =>
      siphash24(
        KEY,
        Uint8Array.from({ length: len }, (_, i) => i),
      ),
    );
    expect(results).toEqual(VECTORS.map(([hi, lo]) => [hi, lo]));
  });

  it('should reject a key that is not 16 bytes', () => {
    expect(() => siphash24(new Uint8Array(8), new Uint8Array(0))).toThrow(TypeError);
  });
});

describe('siphash24F53 (fixed 16-byte hot path)', () => {
  const fold = ([hi, lo]: readonly [number, number]): number => hi * 0x200000 + (lo >>> 11);

  const messageBytes = (m0l: number, m0h: number, m1l: number, m1h: number): Uint8Array => {
    const bytes = new Uint8Array(16);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, m0l >>> 0, true);
    view.setUint32(4, m0h >>> 0, true);
    view.setUint32(8, m1l >>> 0, true);
    view.setUint32(12, m1h >>> 0, true);
    return bytes;
  };

  it('should match the official vector for the 16-byte sequential message', () => {
    const m = messageBytes(0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c);
    expect(siphash24F53(0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c, 0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c)).toBe(
      fold(siphash24(KEY, m)),
    );
  });

  it('should equal the byte path under a key with negative int32 words (production readInt32LE shape)', () => {
    // Production keys come from readInt32LE and are negative ~50% of the time; the reference KEY's words are all positive.
    const key = Uint8Array.from({ length: 16 }, (_, i) => 0xf0 + i);
    const view = new DataView(key.buffer);
    const [k0l, k0h, k1l, k1h] = [view.getInt32(0, true), view.getInt32(4, true), view.getInt32(8, true), view.getInt32(12, true)];
    const words: [number, number, number, number][] = [
      [0x89abcdef | 0, 0x000003ff, 0xfedcba98 | 0, 0x0100_0000 | 0x2ff],
      [-1, 0x3ff, -2147483648, 0x0500_0012],
    ];
    for (const [m0l, m0h, m1l, m1h] of words) {
      expect(siphash24F53(k0l, k0h, k1l, k1h, m0l, m0h, m1l, m1h)).toBe(fold(siphash24(key, messageBytes(m0l, m0h, m1l, m1h))));
    }
  });

  it('should equal the byte path across structured Feistel-shaped inputs', () => {
    // deterministic sweep over the value shapes prf() actually emits (x, y < 2^42 + round tag)
    const words = [0, 1, 0xffffffff, 0x000003ff, 0x12345678, 0x00000200];
    const mismatches: string[] = [];
    for (const m0l of words) {
      for (const m0h of [0, 0x3ff, 0x12]) {
        for (const m1h of [0, 0x0100_0000 | 0x3ff, 0x0500_0012]) {
          const m1l = (m0l ^ 0x9e3779b9) >>> 0;
          const expected = fold(siphash24(KEY, messageBytes(m0l, m0h, m1l, m1h)));
          const actual = siphash24F53(0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c, m0l, m0h, m1l, m1h);
          if (actual !== expected) mismatches.push(`${m0l}/${m0h}/${m1l}/${m1h}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
