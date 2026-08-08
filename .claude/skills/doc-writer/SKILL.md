---
name: doc-writer
description: |
  Technical documentation writer with Mermaid diagram generation, structured templates,
  and code-to-doc sync. Use when:
  (1) updating README / CONTRIBUTING / SECURITY,
  (2) writing API reference sections or invariant entries,
  (3) syncing code changes to downstream docs,
  (4) verifying doc claims against the codebase.
  NOT for code changes — only documentation output.
---

# Doc Writer Skill

Write clear, structured technical documentation with diagrams, tables, and proper cross-references.

## 🔴 The claim comes first

`exid`'s headline is a **mathematical** claim: same-generator collisions are *structurally
impossible, not merely improbable*. Before anything else, any doc you write or edit must keep that
claim exactly as strong as it actually is:

- **Keep the scope.** The guarantee holds **within one generator instance**. "exid never collides"
  is false and is the single most likely defect in a doc PR here.
- **Don't hedge it either.** "virtually impossible", "astronomically unlikely", "collision-resistant"
  — that's the cuid2/nanoid claim, and using it throws away the whole reason the package exists.
- **Ids are not secrets.** Never imply unguessability; `SECURITY.md` owns that boundary.
- **Numbers need sources.** Benchmark figures require an actual `bun run bench` + stated hardware.

## Core Capabilities

### 1. Mermaid Diagram Generation

Generate diagrams from code analysis. Syntax reference and templates:
- **[mermaid-patterns.md](references/mermaid-patterns.md)**

**Useful diagram types here:**
- **Flowchart** — the mint pipeline (counter → permutation → encoding → prefixed id)
- **Sequence** — generator construction vs. per-id mint (what happens once vs. every call)
- **State** — none needed; this package has no entity lifecycle
- **Class** — module structure (`index` → `exid` → `siphash` / `random`)

### 2. Doc Templates

- **[doc-templates.md](references/doc-templates.md)** — README API section, invariant entry,
  security note, benchmark table

### 3. Code-to-Doc Sync

When code changes, downstream docs must update:

| Code source | Downstream docs |
|---|---|
| `src/index.ts` (exports) | `README.md` API section · `examples/*` |
| `EXID_BODY_LEN`, the body regex | `README.md` id-shape prose · `SECURITY.md` if entropy-relevant |
| `src/random.ts` (entropy source) | `SECURITY.md` · `README.md` "how it works" |
| A new structural rule / rejected design | `CONTRIBUTING.md` §The rules that matter **+** `.claude/rules/invariants.md` (both, always) |
| `package.json` `exports` / `files` / `engines` | `README.md` install + import section |
| `.github/workflows/ci.yml` matrix | `README.md` supported-runtimes claim |
| A new gate script | `CONTRIBUTING.md` §Getting started · `CLAUDE.md` · `.claude/skills/test/SKILL.md` |
| `CHANGELOG.md` | **nothing — it is semantic-release-owned; never hand-edit** |

### 4. Claim Verification

Verify every concrete claim against the real codebase:

```bash
cat src/index.ts                                  # public API surface
grep -n 'EXID_BODY_LEN' src/exid.ts               # id shape
jq '.dependencies // {} | length' package.json    # zero-dependency claim → must be 0
grep -n '"engines"' -A3 package.json              # declared runtime floor
grep -n "node:" .github/workflows/ci.yml          # the matrix that actually tests it
bun run build && bun run examples                 # every sample runs
```

---

## Workflow

### When Called Directly

1. **Understand scope** — which surface? (`doc-surfaces.md` has the 7 tiers)
2. **Read the code** — never document from memory or from a comment; comments drift too
3. **Choose template** — from `doc-templates.md`
4. **Generate diagrams** — where they add clarity, not decoration
5. **Write** — follow the template, keep it concise, cross-reference instead of duplicating
6. **Verify** — run the claim-verification commands above

### When Called From `/update-docs`

- Generating diagrams for a changed flow
- Writing an invariant entry (both files, in lockstep)
- Verifying claim accuracy

---

## Writing Guidelines

### General
- **Concise** — lead with the answer, not the context
- **Scannable** — tables, bullet lists, headers
- **Code examples** — always, when documenting an API. Lift them from `examples/` where possible;
  those are CI-executed and cannot silently rot
- **Cross-references** — link to related docs, don't duplicate content. The one deliberate exception
  is the `CONTRIBUTING.md` ↔ `invariants.md` pair, which is mirrored on purpose
- **English** for doc content, Thai for communication with the user

### Mermaid Diagrams
- **Diagram-first:** any flow, pipeline, or progression → a Mermaid diagram. **Never** ASCII box-art
  in a code fence, **never** a standalone arrow-text line as the primary representation. Full rule +
  house style: [mermaid-patterns.md](references/mermaid-patterns.md).
- Keep diagrams **focused** — one concept per diagram
- **Descriptive node labels**, not IDs; `·` as the in-label separator, `<br/>` for multi-line
- Pair every diagram with a **one-line prose caption** (survives non-render + aids skimming)
- **Quote edge labels** (`-->|"label"|`) so `+`/`(`/`:` don't break the parser
- Use `%%` comments for complex diagrams

### Tables
- Structured data: exports, options, runtime support, benchmark results
- API docs: Name · Signature · Description · Since
- Comparison tables (vs uuid/nanoid/cuid2): **every cell needs a source** — this is the most
  over-claim-prone region of the README

### README API section
- Must match `src/index.ts` **exactly** — an undocumented export is as wrong as a documented
  non-export
- Each entry: signature, params, return, one runnable example
- Mark the semver commitment explicitly where behaviour is subtle
