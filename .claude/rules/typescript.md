# TypeScript Rules

Full `strict: true`, plus `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`,
`isolatedModules`. Target `es2022`, `module: nodenext`. `tsc` is **typecheck-only** (`noEmit`) — the
build is `scripts/build.mjs`.

No `any` (use `unknown`). Explicit return types on exported functions. `interface` for objects, `type`
for unions. Generics with constraints. Optional chaining, nullish coalescing, type guards.

## `verbatimModuleSyntax` — type imports must say so

`import type { Foo } from './foo'` / `import { type Foo, bar }`. A value-import of a type is an error,
not a warning — the compiler emits the import verbatim and CJS output breaks at runtime.

## Hot-path style (`src/exid.ts`, `src/siphash.ts`)

This is arithmetic, not application code. Local conventions that override general preference:

- **Explicit `| 0` / `>>> 0` coercions stay.** They are the type contract of the 32-bit lanes, not
  redundant noise. Don't "simplify" them away.
- **Scratch buffers are module-scope and fully rewritten per call** — that is deliberate (it's what
  makes dual ESM/CJS loading harmless, see `invariants.md`). Never add module-scope state that
  *persists* across calls.
- **No allocation in the mint path.** No `.map`/`.slice`/spread/template-literal chains where a
  preallocated buffer and index arithmetic will do. Readability loses to the allocation budget here;
  pay for it with a comment instead.

## Comments — short by default

- **Comment block (consecutive `//` lines or one `/* */`) ≤ 3 lines; aim for 1. File headers ≤ 5 lines.**
  Longer rationale goes in `CONTRIBUTING.md` or the PR body, with a one-line link in code.
- Say WHY (constraint, gotcha, non-obvious choice) — never narrate what the next line does, restate the
  PR, or recap history (git blame has it).
- **Exception: the math.** A non-obvious algebraic step (why a constant is odd, why a rotation count,
  why a bound is exclusive) earns its comment even if long — a future reader cannot re-derive it from
  the code. Keep it about the math, not about the change.
- Trim pre-existing long comments **only when already touching the file** — no comment-only PRs.

## Lint & Format

**Biome 2.4.16**. Config: `biome.json` (lineWidth 150, single quotes, trailing commas all, semicolons).

```bash
bun run lint            # biome check --error-on-warnings .   (a WARNING fails, like CI)
bun run lint:fix        # biome check --write .
bun run typecheck       # tsc -p tsconfig.json  (noEmit)
```

- **Zero-warning policy**: `--error-on-warnings` means `noUnusedImports` (warn) and `noConsole` (warn)
  fail the gate exactly like errors. `console` is allowed only in `__tests__/`, `bench/`, `scripts/`,
  `examples/` (biome `overrides`).
- Suppress with `// biome-ignore lint/<rule>: reason` — **always with a reason**. Prefer satisfying the rule.
- **🔴 A wrong suppression is SILENT, not an error.** A malformed category (`// biome-ignore rule:`
  without `lint/`) and leftover `// eslint-disable-next-line` are both no-ops — the rule still fires,
  or worse, you believe it's suppressed when it never was. Verify by deleting the suppression and
  confirming the rule actually fires.
- **Never put comments in `biome.json`** — Biome prints a parse diagnostic then falls back to its
  DEFAULT config, so the whole repo reports as mis-formatted while looking like ordinary lint errors.
  Keep it strict JSON; rationale lives here.
- `files.includes` negations hide source from every rule silently (`dist`, `coverage`, `*.md`, `*.json`,
  `*.yml` are already excluded). Adding one is a decision to re-justify, not a default.

## Auto-fix hook

`.claude/hooks/biome-auto-fix.sh` runs `biome check --write` on every Write/Edit of a
`.ts/.js/.css/.json` file. Formatting drift should never reach a commit — but it fixes format and
safe lint only, so `bun run lint` can still fail on real findings.

## Don'ts

- `any`, `@ts-ignore`, `@ts-nocheck`, implicit any, unvalidated type assertions
- A `node:*` import anywhere under `src/` (see `invariants.md`)
- A runtime `dependencies` entry
- Emitting from `tsc` — `scripts/build.mjs` owns the build
