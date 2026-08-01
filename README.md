# exid

**Collision-free public ids, with zero database round-trips.**

Most id generators promise ids that are *unlikely* to collide. Within one `exid` generator, collisions are **structurally impossible** — not improbable, impossible — because ids are a keyed bijection applied to a monotonic counter. Two different counter values cannot map to the same id, the same way two different inputs cannot map to the same output of any permutation.

```
usr_kf3x9dq0m2vplt7hz84wnc6b
└┬┘ └───────────┬───────────┘
prefix      24-char body
```

```bash
npm i exid
```

```ts
import { createExid } from 'exid';

const userId = createExid('usr'); // create ONCE, reuse forever

userId(); // 'usr_kf3x9dq0m2vplt7hz84wnc6b'
userId(); // 'usr_b8n2wq7lc0fdz13ymx5v9pkt'
```

- **Zero dependencies**, zero database, zero network, zero clock.
- **Runs everywhere** — Node 18+, Bun, Deno, Cloudflare Workers, Vercel Edge, browsers. One Web Crypto call at boot, none afterwards.
- **Dual ESM + CJS** with real type definitions for both.
- **~1.3M ids/sec** single-threaded.

---

## Why another id generator?

| | exid | nanoid | cuid2 | uuid v4 | uuid v7 |
|---|---|---|---|---|---|
| Same-generator collisions | **impossible** | improbable | improbable | improbable | improbable |
| Needs a database round-trip | no | no | no | no | no |
| Leaks creation time | no | no | no | no | **yes** |
| Lexicographically sortable | no | no | no | no | yes |
| URL-safe, double-click-selectable | yes | `-`/`_` | yes | `-` | `-` |
| Runtime dependencies | **0** | 0 | 1 | 0 | 0 |
| Edge/browser ready | yes | yes | yes | yes | yes |
| Throughput (this machine) | 1.3M/s | 8.0M/s | 0.14M/s | 15.4M/s | — |

**Pick exid** when ids are public-facing identifiers in URLs and APIs, you want a readable `prefix_body` shape, and you want the uniqueness argument to be a proof rather than a probability.

**Pick something else** when you need time-sortable keys (uuid v7), or when you mint ids so fast that 1.3M/sec is the bottleneck — which is roughly 1000× faster than any database will accept the rows.

---

## Guarantees, by layer

| Scope | Guarantee | Why |
|---|---|---|
| One generator, up to 2.8×10¹² ids | **Zero collisions. Structural.** | The counter is fed through a keyed bijection on `D1 × D2 × D3`; distinct counters ⇒ distinct outputs, by definition of a permutation |
| One generator, past 2.8×10¹² ids | CSPRNG-grade | The counter space is exhausted, so the generator reseeds a fresh identity and key and the guarantee resets |
| Two generators in one process | CSPRNG-grade | Each `createExid()` draws its own boot identity **and** its own key |
| Different processes / machines / workers | CSPRNG-grade | Same reason. There is no shared state to coordinate, and none is needed |

"CSPRNG-grade" means: for any two ids minted by different generators, the probability they are equal is **1 / (26 · 36²³) ≈ 6 × 10⁻³⁸**. You would expect the first collision after about **5 × 10¹⁸ ids** — five quintillion.

> **One generator per prefix, created once.** `createExid()` is what owns the counter, so calling it inside a request handler throws away the structural guarantee (and the boot cost). Create it at module scope.

---

## How it works

Three ingredients, no clock and no coordination:

1. **A per-generator identity.** At boot, `exid` draws a 128-bit SipHash key plus two random domain values (`boot1`, `boot2`) from the CSPRNG. This is the only entropy it ever consumes.
2. **A monotonic counter.** Every mint increments it. Nothing else changes.
3. **A keyed bijection.** The triple `(boot1, boot2, counter)` is run through a 6-round Feistel network on the domain `D1 × D2 × D3`, where each round mixes one branch with a **SipHash-2-4** PRF of the other two. A Feistel network built from modular addition is invertible by construction — `exid` ships the inverse and tests it — which is exactly what makes it collision-free.

The permuted triple is then written as base36. `D1 = 26 · 36⁷` pins the first character to `a–z`, so a body never starts with a digit and the id is always a valid identifier.

```
(boot1, boot2, counter)  ──Feistel(SipHash-2-4, 6 rounds)──▶  (a, b, c)  ──base36──▶  kf3x9dq0m2vplt7hz84wnc6b
      ▲                                                                                        ▲
  counter++ each mint                                                            distinct counters ⇒ distinct ids
```

Total body space is `26 · 36²³ ≈ 1.6 × 10³⁷` (~2¹²³·⁶) — comparable to a UUIDv4's 122 random bits, in 24 characters instead of 36.

### Why not just hash the counter?

A hash is not injective. Two counters can hash to the same value, which puts you right back at "improbable". A **permutation** cannot — that is the entire trick.

---

## Collision math

For a body of `L` characters the space is `26 · 36^(L-1)`, and the first collision between *independent* generators is expected after roughly `1.25 · √space` ids:

| Body length | Space | Expected first collision |
|---|---|---|
| 5 | 4.4 × 10⁷ | ~8 thousand ids |
| 8 | 2.0 × 10¹² | ~2 million ids |
| 12 | 3.4 × 10¹⁸ | ~2.3 billion ids |
| **24 (exid's fixed length)** | **1.6 × 10³⁷** | **~5 × 10¹⁸ ids** |

Within a single generator none of this applies — the count is exactly zero until the counter wraps at 2.8 × 10¹² ids.

---

## Security model

- **The algorithm is public; the key is not.** Every generator draws its own 128-bit SipHash-2-4 key from the CSPRNG at boot, and the key never leaves process memory. Publishing this source weakens nothing (Kerckhoffs's principle) — an attacker who can read your process memory has already won.
- **The adversary model is output-only.** An observer sees minted ids. They do not get to choose inputs or query the permutation, which is what lets 6 Feistel rounds suffice.
- **Ids are unguessable, but they are not authentication tokens.** Do not use an id as a bearer credential, a password-reset token, or a capability. Authorize the request, then look up the id.
- **SipHash-2-4 is validated against the reference vectors** from [veorq/SipHash](https://github.com/veorq/SipHash) — all 64 of them, plus a bit-equivalence check between the fast 53-bit path and the reference byte path.

Found a security issue? See [SECURITY.md](./SECURITY.md).

---

## API

### `createExid(prefix): () => string`

Creates a generator. `prefix` must match `/^[a-z][a-z0-9]{0,11}$/` — lowercase, starts with a letter, at most 12 characters. Throws `TypeError` otherwise.

```ts
const surveyId = createExid('svy');
surveyId(); // 'svy_p2m9x0wqc7ltvb43zdnk8fhj'
```

### `EXID_BODY_LEN: 24`

The body length, exported so you can size a database column: `prefix.length + 1 + 24`.

### `freshState(): ExidState` · `createExidFromState(prefix, state): () => string`

Advanced. Lets you inject a fixed identity so a generator becomes deterministic — useful for snapshot tests and golden fixtures. Never use a hard-coded state in production; the whole cross-process argument rests on that state being random.

```ts
import { createExidFromState, type ExidState } from 'exid';

const state: ExidState = { k: new Int32Array([1, 2, 3, 4]), boot1: 11, boot2: 22, counter: 0 };
const deterministic = createExidFromState('tst', state);
deterministic(); // same value on every run
```

---

## Examples

### Node — ESM and CommonJS

```ts
// ESM
import { createExid } from 'exid';
export const newOrderId = createExid('ord');
```

```js
// CommonJS
const { createExid } = require('exid');
module.exports.newOrderId = createExid('ord');
```

### One generator per entity type

```ts
// ids.ts — module scope, created once, imported everywhere
import { createExid } from 'exid';

export const ids = {
  user: createExid('usr'),
  order: createExid('ord'),
  invoice: createExid('inv'),
};

ids.user(); // 'usr_...'
```

### Prisma

```prisma
model User {
  id       Int    @id @default(autoincrement())
  publicId String @unique @db.VarChar(28)
}
```

```ts
const user = await prisma.user.create({ data: { publicId: ids.user() } });
```

Keep the surrogate integer key for joins and use `publicId` in URLs and API payloads — the public id never has to be a primary key.

### Drizzle

```ts
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  publicId: varchar('public_id', { length: 28 }).notNull().unique().$defaultFn(ids.user),
});
```

### Cloudflare Workers / Vercel Edge

No configuration — `exid` uses Web Crypto, which both provide natively.

```ts
import { createExid } from 'exid';

const requestId = createExid('req');

export default {
  fetch(): Response {
    return new Response(JSON.stringify({ requestId: requestId() }));
  },
};
```

> On serverless platforms every cold start is a new generator with a new identity. That is fine — the cross-generator guarantee is the CSPRNG-grade one above, which is the same guarantee nanoid and uuid v4 give you for *every* id.

### Browser

```ts
import { createExid } from 'exid';

const draftId = createExid('drf');
localStorage.setItem('draft', draftId());
```

---

## Benchmarks

```bash
bun run bench
```

500,000 ids per generator, single thread, 30,000 warm-up iterations, no I/O. Measured on an AMD WSL2 workstation, Node 24 / Bun 1.3:

```
exid                :    1,357,600 ids/s
nanoid              :    8,071,861 ids/s   (5.95× faster than exid)
cuid2               :      137,606 ids/s   (9.87× slower than exid)
crypto.randomUUID   :   15,397,218 ids/s   (11.34× faster than exid)
```

`exid` pays for its guarantee: six SipHash-2-4 rounds per id instead of one CSPRNG draw. At 1.3M ids/sec that cost is ~0.74 µs per id — irrelevant next to the database write the id is destined for. The mint path allocates nothing and consumes no entropy; the CSPRNG is touched only at boot.

---

## FAQ

**Are ids sortable?** No, by design. Sortable ids leak creation order and volume. Use a `createdAt` column.

**Do ids encode a timestamp?** No. Nothing in the body derives from the clock, so the length never grows and a clock change can never break uniqueness.

**What happens after 2.8 × 10¹² ids from one generator?** It reseeds a fresh identity and key and starts over. No id is ever repeated within the stream; the pre- and post-reseed streams relate to each other at CSPRNG-grade odds.

**Is it safe with `worker_threads` / clustering?** Yes. Each thread or process loads its own module instance and draws its own identity — that is the cross-generator case, and it needs no coordination.

**What if my bundler loads both the ESM and CJS build?** Also fine: you get two independent generators, which is again the cross-generator case.

**Why 24 characters?** It is the point where the space (~2¹²³·⁶) matches UUIDv4's entropy while staying short enough to read aloud. A `length` option is [planned](https://github.com/inventtech/exid/issues).

**Can I use uppercase or longer prefixes?** Prefixes are lowercase alphanumeric, up to 12 characters, starting with a letter. Keeping the whole id in one case makes it case-insensitively unique, which saves you from a class of database and URL bugs.

---

## License

[MIT](./LICENSE) © Invent Technology
