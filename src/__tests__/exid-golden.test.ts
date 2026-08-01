import { describe, expect, it } from 'vitest';
import { createExidFromState, type ExidState } from '../exid.js';

/**
 * Port-fidelity oracle. Every other test in this suite is invariant under a mangled PRF:
 * the bijection test round-trips permute3 → unpermute3 through the SAME prf, so a symmetric
 * change still round-trips, and the encodeBody goldens never reach prf at all. Coverage does
 * not help either — it proves the line ran, not that it produced the same bytes.
 *
 * These strings were minted by the pre-extraction implementation (inventtech/ex,
 * packages/exid) before that package was deleted. They are the only assertion that pins
 * `prf()`, `ROUNDS`, the branch schedule and the digit layout simultaneously.
 */
describe('golden vectors from the pre-extraction implementation', () => {
  it('should reproduce the reference stream for the documented fixed state', () => {
    const state: ExidState = {
      k: new Int32Array([0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c]),
      boot1: 123_456_789_012,
      boot2: 987_654_321_098,
      counter: 0,
    };
    expect(Array.from({ length: 8 }, createExidFromState('svy', state))).toEqual([
      'svy_peohwudd1gbm6wanm0u40hnl',
      'svy_duybrtuu97t4yt3ff4r03t3z',
      'svy_rtfm94s37qcqzpmqqwyemjqw',
      'svy_sbbgryho4hupnv1s5zykyak9',
      'svy_fr1vd4maxsrac9as4wfmv4hw',
      'svy_q1oshex7qoyifj2s0ia5x5c3',
      'svy_ikyoebxz6kq3huthggt0ft1e',
      'svy_d22gca8gqhesmxgq0ii9pv1q',
    ]);
  });

  it('should reproduce the reference stream at key extremes and a high counter', () => {
    // int32 min/max key words + a counter far from zero — pins the sign handling in prf().
    const state: ExidState = {
      k: new Int32Array([-1, 2147483647, -2147483648, 42]),
      boot1: 1,
      boot2: 2,
      counter: 999_999,
    };
    expect(Array.from({ length: 4 }, createExidFromState('usr', state))).toEqual([
      'usr_ccgx55qbazbbc5khqg2ui4qx',
      'usr_d8dss1og2m2ro3rgqynx1l3y',
      'usr_kdy33wu4ypjenpj1l9arke6s',
      'usr_hzhwdk0p3jq2ejxmmf9bywum',
    ]);
  });
});
