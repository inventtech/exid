import { afterEach, describe, expect, it } from 'vitest';
import { D1, D2 } from '../exid.js';
import { randomBelow, randomKey } from '../random.js';

const realCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true, writable: true });
});

describe('randomKey', () => {
  it('should return four int32 words', () => {
    const key = randomKey();
    expect(key).toBeInstanceOf(Int32Array);
    expect(key.length).toBe(4);
  });

  it('should draw a different key each call', () => {
    // 128 bits per key — a repeat across 50 draws is ~2^-121, far below any flake budget.
    const seen = new Set(Array.from({ length: 50 }, () => randomKey().join(',')));
    expect(seen.size).toBe(50);
  });
});

describe('randomBelow', () => {
  it('should reject a max outside [1, 2^48]', () => {
    for (const bad of [0, -1, 1.5, 2 ** 48 + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => randomBelow(bad)).toThrow(RangeError);
    }
  });

  it('should always return 0 for max = 1', () => {
    expect(Array.from({ length: 100 }, () => randomBelow(1)).every((v) => v === 0)).toBe(true);
  });

  it('should stay inside [0, max) for the exid domains', () => {
    for (let i = 0; i < 2_000; i++) {
      const a = randomBelow(D1);
      const b = randomBelow(D2);
      expect(a >= 0 && a < D1 && Number.isInteger(a)).toBe(true);
      expect(b >= 0 && b < D2 && Number.isInteger(b)).toBe(true);
    }
  });

  it('should reach every residue of a small modulus', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 5_000; i++) seen.add(randomBelow(7));
    expect(seen.size).toBe(7);
  });

  it('should stay uniform under a chi-square probe on a non-dividing modulus', () => {
    // 2^48 mod 10 = 6, so a bare `draw % 10` would over-represent low residues — this is
    // the case the rejection band exists for. df = 9, χ² > 43.8 is p < 1e-6.
    const buckets = new Array<number>(10).fill(0);
    const n = 60_000;
    for (let i = 0; i < n; i++) buckets[randomBelow(10)]++;
    const expected = n / 10;
    const chi2 = buckets.reduce((acc, observed) => acc + (observed - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(43.8);
  });

  it('should consume more than one draw when the first lands in the reject band', () => {
    // limit for max = 3 is floor(2^48/3)*3, so the top two 48-bit values are rejected.
    // Feed one rejected draw, then a good one, and assert both were consumed.
    const rejected = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const accepted = new Uint8Array([0x02, 0, 0, 0, 0, 0]);
    const queue = [rejected, accepted];
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: (target: Uint8Array) => {
          target.set(queue.shift() ?? accepted);
          return target;
        },
      },
      configurable: true,
      writable: true,
    });
    expect(randomBelow(3)).toBe(2);
    expect(queue.length).toBe(0);
  });
});

describe('missing Web Crypto', () => {
  it('should throw an actionable error when globalThis.crypto is absent', () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    expect(() => randomKey()).toThrow(/Web Crypto/);
    expect(() => randomBelow(10)).toThrow(/globalThis.crypto.getRandomValues/);
  });

  it('should throw when globalThis.crypto lacks getRandomValues', () => {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true, writable: true });
    expect(() => randomKey()).toThrow(/Web Crypto/);
  });
});
