/**
 * Universal CSPRNG access. Uses Web Crypto (`globalThis.crypto`), which is native on
 * Node 18+, Bun, Deno, Cloudflare Workers, Vercel Edge and browsers — no polyfill, no
 * `node:crypto` import, no bundler shim. Entropy is drawn only when a generator boots
 * (and on counter wrap), never on the mint hot path, so the source costs no throughput.
 */

/** Structural type for the one Web Crypto method exid needs — keeps the package free of DOM/node lib types. */
interface WebCryptoLike {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

const MAX_48 = 281474976710656; // 2^48 — the widest draw that stays an exact JS integer in one multiply-free sum

function webCrypto(): WebCryptoLike {
  const candidate = (globalThis as { crypto?: WebCryptoLike }).crypto;
  if (!candidate || typeof candidate.getRandomValues !== 'function') {
    throw new Error(
      'exid requires Web Crypto (globalThis.crypto.getRandomValues), which is native on Node 18+, Bun, Deno, ' +
        'Cloudflare Workers and browsers. On an older runtime, assign a compatible implementation to globalThis.crypto before importing exid.',
    );
  }
  return candidate;
}

/** 16 CSPRNG bytes as four signed int32 words — the per-generator SipHash key. */
export function randomKey(): Int32Array {
  const bytes = new Uint8Array(16);
  webCrypto().getRandomValues(bytes);
  const view = new DataView(bytes.buffer);
  return new Int32Array([view.getInt32(0, true), view.getInt32(4, true), view.getInt32(8, true), view.getInt32(12, true)]);
}

/**
 * Uniform integer in [0, max) for `max <= 2^48`, by rejection sampling over 48 drawn bits.
 * A bare `draw % max` would over-represent the low residues whenever max does not divide
 * 2^48 — exid's domains (26·36^7 and 36^8) never do, so the reject band is load-bearing.
 */
export function randomBelow(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > MAX_48) {
    throw new RangeError(`exid randomBelow: max must be an integer in [1, 2^48], got ${max}`);
  }
  const limit = Math.floor(MAX_48 / max) * max;
  const bytes = new Uint8Array(6);
  const crypto = webCrypto();
  for (;;) {
    crypto.getRandomValues(bytes);
    const draw = bytes[0] + bytes[1] * 0x100 + bytes[2] * 0x10000 + bytes[3] * 0x1000000 + bytes[4] * 0x100000000 + bytes[5] * 0x10000000000;
    if (draw < limit) return draw % max;
  }
}
