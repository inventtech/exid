# Documentation Templates

Structured templates for the doc types `exid` actually has. There is no `docs/` directory and no
ADR log — the surfaces are the root markdown files, the executable examples, and the Claude config
(see [`doc-surfaces.md`](../../update-docs/references/doc-surfaces.md)).

---

## 1. Invariant Entry (this repo's ADR analogue)

Use when: a decision is hard to reverse, surprising without context, and the result of a real
trade-off. Goes in **`CONTRIBUTING.md` §The rules that matter** AND, in short form, in
**`.claude/rules/invariants.md`** — both files or neither.

**`CONTRIBUTING.md` form** (prose, matches the existing entries' voice):

```markdown
- **{The rule, stated as an imperative}.** {What the tempting alternative is — name it, because
  someone will propose it again.} {Why it fails, concretely — and if the failure is SILENT, say so
  explicitly; that's the whole reason the rule exists.} {What is true today that makes the current
  design safe.} {If it could ever be allowed: what would have to be built first.}
```

**`.claude/rules/invariants.md` form** (heading + 2–4 lines):

```markdown
## {Rule as a heading}

{One paragraph: the constraint and the failure mode it prevents.}

{Optional: what enforces it — a gate, a test, a CI job. If nothing enforces it, say that too;
an unenforced invariant is a comment, and reviewers need to know they're the enforcement.}
```

**Quality bar:** an entry that only says *what* the rule is has failed. The existing entries all
answer "why would a reasonable person break this, and what happens when they do?"

---

## 2. README API Section

Use when: documenting an export from `src/index.ts`.

````markdown
### `functionName(arg: Type, options?: Options): ReturnType`

{One sentence: what it does. Lead with the answer.}

```ts
import { functionName } from 'exid';

const result = functionName('usr');
//    ^? ReturnType
```

| Param | Type | Default | Description |
|---|---|---|---|
| `arg` | `Type` | — | {what it controls} |
| `options.x` | `number` | `24` | {what it controls} |

**Throws** `{ErrorType}` when {condition}.

{Any subtlety a caller must know — e.g. "call this ONCE per prefix at module scope; the returned
function owns the counter." State the constraint, not just the signature.}
````

**Rules:**
- Must match `src/index.ts` exactly — an undocumented export is as wrong as a documented non-export
- Every sample must run. Lift from `examples/` where possible (those are CI-executed)
- If behaviour is a semver commitment worth flagging, flag it inline

---

## 3. Guarantee / Scope Statement

Use when: writing or editing any sentence about collision-freedom. This is the highest-risk prose in
the repo — treat it as a template, not free writing.

```markdown
Ids minted by **a single generator** are structurally unique: distinct calls map to distinct ids by
construction, not by probability. {Mechanism in one clause — e.g. "the counter is pushed through a
bijection, so two calls cannot land on the same body."}

Two **separate** generators — a second `createExid()` call, another process, another machine —
{state the actual relationship: independent random keys, collision probability bounded by X}.
```

**Never write:** "exid never collides" · "collisions are virtually impossible" · "collision-resistant"
· anything implying ids are unguessable or secret.

---

## 4. Security Note (`SECURITY.md`)

Use when: the entropy source, key derivation, or guessability story changes.

```markdown
## {Topic}

**What exid guarantees:** {precise, narrow statement}

**What it does NOT guarantee:** {the boundary — say it plainly; this section is the point of the file}

**Entropy source:** {e.g. Web Crypto `getRandomValues`, drawn once per generator, N bits}

**If you need {the stronger property}:** {what to use instead}
```

Ids are identifiers, not secrets. Any doc that implies otherwise is a defect.

---

## 5. Benchmark Table

Use when: quoting performance numbers anywhere.

```markdown
| Library | ops/sec | relative |
|---|---:|---:|
| `exid` | X,XXX,XXX | 1.00× |
| `nanoid` | X,XXX,XXX | X.XX× |
| `@paralleldrive/cuid2` | X,XXX,XXX | X.XX× |

Measured with `bun run bench` on {CPU}, {runtime + version}, {date}. Numbers move with hardware —
re-run before citing them.
```

**Rule:** no benchmark number ships without the command, the hardware, and the date. A figure
inherited from an older README with no provenance gets deleted, not carried forward.

---

## 6. CHANGELOG

**There is no template — do not write one.** `CHANGELOG.md` is generated and committed by
semantic-release from the commit messages (`.releaserc.json`). The way to write a good changelog
entry is to write a good commit subject.
