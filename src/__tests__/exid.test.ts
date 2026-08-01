import { describe, expect, it } from 'vitest';
import type { ExidState } from '../exid.js';
import { createExid, createExidFromState, D1, D2, D3, EXID_BODY_LEN, encodeBody, freshState, permute3, unpermute3 } from '../exid.js';

/** Fixed key + identity → every assertion below is fully deterministic (no CSPRNG in the hot assertions). */
const fixedState = (counter = 0): ExidState => ({
  k: new Int32Array([0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c]),
  boot1: 123_456_789_012,
  boot2: 987_654_321_098,
  counter,
});

const BODY_RE = /^[a-z][a-z0-9]{23}$/;

describe('permute3 / unpermute3', () => {
  it('should round-trip every point of a deterministic sweep (bijection witness)', () => {
    const k = fixedState().k;
    let mismatches = 0;
    // 30k deterministic lattice points spread across the three domains
    for (let i = 0; i < 30_000; i++) {
      const a = (i * 67_867_967) % D1;
      const b = (i * 94_418_953) % D2;
      const c = (i * 33_554_467) % D3;
      const [x, y, z] = permute3(a, b, c, k);
      const [ia, ib, ic] = unpermute3(x, y, z, k);
      if (ia !== a || ib !== b || ic !== c) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('should keep every branch inside its domain across a deterministic sweep', () => {
    const k = fixedState().k;
    let escapes = 0;
    for (let i = 0; i < 1_000; i++) {
      const [x, y, z] = permute3((i * 104_729) % D1, (i * 224_737) % D2, (i * 350_377) % D3, k);
      if (!(x >= 0 && x < D1 && Number.isInteger(x)) || !(y >= 0 && y < D2 && Number.isInteger(y)) || !(z >= 0 && z < D3 && Number.isInteger(z)))
        escapes++;
    }
    expect(escapes).toBe(0);
  });
});

describe('encodeBody', () => {
  it('should emit 24 chars with a leading letter for domain-edge triples', () => {
    const encoded = [encodeBody(0, 0, 0), encodeBody(D1 - 1, D2 - 1, D3 - 1)];
    expect(encoded.map((b) => BODY_RE.test(b) && b.length === EXID_BODY_LEN)).toEqual([true, true]);
  });

  it('should match golden vectors pinning the exact digit layout (injectivity witness)', () => {
    // Catches DROPPED/TRANSPOSED DIGITS — a mutation duplicating one digit slot passes the shape,
    // uniqueness, and chi-square suites (verified by mutation); only an exact-layout pin fails it.
    // Values verified against an independent BigInt digit oracle.
    expect([
      encodeBody(0, 0, 0),
      encodeBody(D1 - 1, D2 - 1, D3 - 1),
      encodeBody(78_365_398_663, 1_679_705, 78_364_164_131),
      // all 24 body positions distinct — discriminates every digit slot including out[1..3]
      encodeBody(550_852_095_535, 647_128_068_567, 1_291_953_190_271),
    ]).toEqual(['a00000000000000000000000', 'zzzzzzzzzzzzzzzzzzzzzzzz', 'b000qglj0001002h1000000z', 'h123456789abcdefghijklmn']);
  });
});

describe('createExidFromState (deterministic)', () => {
  it('should mint zero duplicates across 500,000 consecutive counters', { timeout: 30_000 }, () => {
    const mint = createExidFromState('svy', fixedState());
    const seen = new Set<string>();
    const n = 500_000;
    for (let i = 0; i < n; i++) seen.add(mint());
    expect(seen.size).toBe(n);
  });

  it('should mint ids matching the documented shape', () => {
    const mint = createExidFromState('svy', fixedState());
    let bad = 0;
    for (let i = 0; i < 10_000; i++) {
      if (!/^svy_[a-z][a-z0-9]{23}$/.test(mint())) bad++;
    }
    expect(bad).toBe(0);
  });

  it('should stay uniform per position (chi-square smoke on a fixed stream)', () => {
    const mint = createExidFromState('svy', fixedState());
    const counts: number[][] = Array.from({ length: EXID_BODY_LEN }, () => new Array(36).fill(0));
    const n = 200_000;
    for (let i = 0; i < n; i++) {
      const body = mint().slice(4);
      for (let p = 0; p < EXID_BODY_LEN; p++) {
        const code = body.charCodeAt(p);
        counts[p][code >= 97 ? code - 87 : code - 48]++;
      }
    }
    const chi = (row: number[], buckets: number): number => {
      const expected = n / buckets;
      return row.reduce((sum, v) => sum + (v - expected) ** 2 / expected, 0);
    };
    // deterministic stream → fixed values; 99.9% crit is 52.6 (df 25) / 66.6 (df 35)
    const first = chi(counts[0].slice(10), 26);
    let worst = 0;
    for (let p = 1; p < EXID_BODY_LEN; p++) worst = Math.max(worst, chi(counts[p], 36));
    expect({ firstOk: first < 52.6, restOk: worst < 66.6 }).toEqual({ firstOk: true, restOk: true });
  });

  it('should reseed at counter wrap without repeating or malforming ids', () => {
    const state = fixedState(D3 - 2);
    const mint = createExidFromState('svy', state);
    const ids = [mint(), mint(), mint(), mint()]; // crosses the wrap after 2 mints
    const wellFormed = ids.every((id) => /^svy_[a-z][a-z0-9]{23}$/.test(id));
    // post-wrap identity is CSPRNG-fresh; overlap odds with the 2 pre-wrap ids ≈ 2^-122 — negligible flake bound
    expect({
      wellFormed,
      distinct: new Set(ids).size,
      counterReset: state.counter <= 2,
      rekeyed: state.boot1 !== fixedState().boot1 || state.boot2 !== fixedState().boot2,
    }).toEqual({
      wellFormed: true,
      distinct: 4,
      counterReset: true,
      rekeyed: true,
    });
  });

  it('should reject prefixes outside the id alphabet', () => {
    const bad = ['', 'Svy', '1vy', 'svy_', 'a-b', 'verylongprefix'];
    expect(
      bad.filter((p) => {
        try {
          createExidFromState(p, fixedState());
          return false;
        } catch {
          return true;
        }
      }),
    ).toEqual(bad);
  });
});

describe('createExid (CSPRNG boot identity)', () => {
  it('should mint disjoint streams from two independent factories', () => {
    // real per-factory CSPRNG identity is the property under test; overlap odds ≈ 10k²/2^124 ≈ 4e-30
    const a = createExid('usr');
    const b = createExid('usr');
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      seen.add(a());
      seen.add(b());
    }
    expect(seen.size).toBe(20_000);
  });

  it('should honor freshState counters starting at zero', () => {
    expect(freshState().counter).toBe(0);
  });
});

describe('shared module scratch state', () => {
  it('should produce identical streams whether generators run isolated or interleaved', () => {
    // encodeBody and permuteInto write to module-scope scratch buffers shared by EVERY
    // generator in the module instance. Minting is synchronous so a call can never be
    // pre-empted mid-way — this pins that invariant instead of trusting it.
    const stateA = (): ExidState => ({ k: new Int32Array([1, 2, 3, 4]), boot1: 11, boot2: 22, counter: 0 });
    const stateB = (): ExidState => ({ k: new Int32Array([9, 8, 7, 6]), boot1: 333, boot2: 444, counter: 0 });

    const isolatedA = Array.from({ length: 500 }, createExidFromState('usr', stateA()));
    const isolatedB = Array.from({ length: 500 }, createExidFromState('usr', stateB()));

    const genA = createExidFromState('usr', stateA());
    const genB = createExidFromState('usr', stateB());
    const interleavedA: string[] = [];
    const interleavedB: string[] = [];
    for (let i = 0; i < 500; i++) {
      interleavedA.push(genA());
      interleavedB.push(genB());
    }

    expect(interleavedA).toEqual(isolatedA);
    expect(interleavedB).toEqual(isolatedB);
  });

  it('should keep every id unique across three interleaved generators sharing a prefix', () => {
    const gens = [createExid('usr'), createExid('usr'), createExid('usr')];
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) for (const gen of gens) seen.add(gen());
    expect(seen.size).toBe(30_000);
  });
});
