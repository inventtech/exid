# Security Policy

## Reporting a vulnerability

Please report security issues privately through [GitHub Security Advisories](https://github.com/inventtech/exid/security/advisories/new). Do not open a public issue.

We aim to acknowledge a report within 3 business days.

## Scope

`exid` mints identifiers. Reports that fall in scope include:

- A way to predict future ids from observed ids **without** access to process memory.
- A collision within a single generator's stream before the counter wrap.
- A bias in the boot-identity draw that materially shrinks the effective space.
- Any path where the CSPRNG is bypassed or a fixed identity is used unintentionally.

## Explicitly out of scope

- **Ids used as bearer credentials.** Ids are unguessable, not secret. Using one as an authentication token, a password-reset link, or a capability is a misuse — authorize the request, then look up the id.
- Attacks that assume the attacker can read the generator's process memory, which holds the key.
- Chosen-input or permutation-oracle attacks. The adversary model is output-only: an observer sees minted ids and cannot query the permutation.

## Design notes for reviewers

- The keyed bijection is a 6-round Feistel network over `D1 × D2 × D3`, each round mixing one branch with a SipHash-2-4 PRF of the other two. Its inverse ships in `src/exid.ts` and is exercised by a round-trip test — bijectivity is the property the collision-freedom claim rests on.
- SipHash-2-4 is validated against all 64 reference vectors from [veorq/SipHash](https://github.com/veorq/SipHash), plus a bit-equivalence check between the fast 53-bit path and the reference byte path.
- Entropy comes from Web Crypto (`globalThis.crypto.getRandomValues`) and is drawn only at generator boot and on counter wrap. `randomBelow()` uses rejection sampling over 48 drawn bits; the exid domains do not divide 2⁴⁸, so the reject band is load-bearing and has its own test.
