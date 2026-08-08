# Naming Conventions

## Files

| Type | Convention | Example |
|------|------------|---------|
| Source modules | camelCase / lowercase, one concept per file | `exid.ts`, `siphash.ts`, `random.ts` |
| Tests | mirror the module + `.test.ts` | `src/__tests__/siphash.test.ts` |
| Scripts | kebab-case | `scripts/check-universal.ts` |

## Prefix-based naming for sibling files (REQUIRED)

When 2+ files share a topic, **prefix them with the same concept word** so `ls <dir>` clusters them
alphabetically. Scanning a directory should reveal related files side-by-side.

Already applied here: `exid.test.ts` + `exid-golden.test.ts` — the golden vectors sort next to the
suite they pin, not under `g`. A `golden-exid.test.ts` would have been wrong.

**Rule:** the leading concept word must match. Qualifiers, modifiers, suffixes go after.

**When renaming for this rule:** `git mv` (preserves blame), then grep + update all references.

## Code Naming

- **Variables**: camelCase (`bodyLen`, `scratchKey`)
- **Constants**: SCREAMING_SNAKE_CASE (`EXID_BODY_LEN`) — the domain sizes `D1`/`D2`/`D3` are an
  established exception; they are algebra, and the paper-style short names are the point
- **Functions**: camelCase, verb-first (`createExid`, `encodeBody`, `randomBelow`)
- **Booleans**: `is/has/can/should` prefix (`isValidPrefix`)
- **Interfaces / types**: PascalCase noun (`ExidState`, `ExidOptions`)
- **Type aliases**: PascalCase for unions/primitives
- **Generics**: `T`, `TState`
- **Paired inverses share a stem**: `permute3` / `unpermute3`, `encodeBody` / `decodeBody` — never
  `permute3` / `reverse3`. The inverse must be greppable from the forward name.

## Naming in a published package

An exported name is a semver commitment (`invariants.md`). Get it right before the first release that
ships it — renaming later is a breaking change, not a refactor.
