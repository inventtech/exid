# WSL Development Rules

> **Platform-conditional — NOT in `.claude/rules/`.** This file lives in
> `.claude/platform/` so it does NOT auto-load every session. The
> `SessionStart` hook `hooks/session-start-wsl.sh` injects it as context
> **only when running under WSL** (detected via `/proc/version`). On
> macOS/Linux it is never loaded.

Apply when running Claude Code on Windows via WSL (Windows Subsystem for Linux).

## Two session modes — check which one you're in FIRST

- **WSL-native session** (the common case here): the harness runs INSIDE WSL — cwd is
  `/home/...`, Bash is real bash, file tools use Linux paths. **Everything below about
  UNC paths / PowerShell / `wsl.exe` does NOT apply** — run commands directly.
  Only §Quoting hazards and §Don'ts still matter.
- **Windows-host session** (Claude Code on Windows attached to a WSL repo over UNC):
  the sections below describe your world.

## Path Translation (Windows-host sessions)

Claude Code on Windows sees WSL paths as UNC: `\\wsl.localhost\<distro>\home\...`.
The Bash tool runs inside PowerShell on the Windows side — it does NOT execute inside
WSL by default.

| Tool | Runs where | Path format |
|------|-----------|-------------|
| Read, Write, Edit, Glob, Grep | Windows (UNC) | `\\wsl.localhost\ubuntu-24.04\home\...` |
| PowerShell | Windows | `\\wsl.localhost\...` or drive letters |
| Bash | Windows (PowerShell wrapper) | Needs explicit `wsl` or `bash -c` prefix |

## Running commands (Windows-host sessions)

```powershell
# git — fastest path, avoids WSL process startup
git -C "\\wsl.localhost\<distro>\home\<user>\projects\exid" status

# anything else — run inside WSL
wsl -d <distro> -- bash -c 'cd /home/<user>/projects/exid && bun run test'
```

**PATH pollution:** `bash -lc` inherits Windows PATH entries containing spaces
(`C:\Program Files\...`), which breaks `export` lines. Use `bash -c` with an explicit
clean PATH.

## Quoting & Interactive-Shell Hazards (`wsl.exe -- bash …`)

- **`bash -ic`/`-lc` exec zsh on some machines** — inline strings then hit zsh glob/parse
  rules: `(parens)` and `[brackets]` abort with "no matches found" (`feat(core):` in a
  `-m` message), and a `->` inside a message acts as a redirect. Don't retry with
  different quoting — move the payload into a file.
- **Multiline / special-char payloads never go inline.** Commit messages and PR bodies:
  write to `/tmp/<file>.md`, then `git commit -F <file>` / `gh pr create --body-file <file>`.
- **`-i` shells can outlive their command** and linger as zombie background tasks. Prefer
  `bash -lc` for git/gh. If `-ic` is unavoidable, check the Background-tasks panel
  afterwards and `TaskStop` any shell that didn't exit.

## File Permissions

WSL mounts Windows files with 777 permissions. Shell scripts (`.sh`) committed from WSL
may show as modified on Windows due to permission metadata — don't stage `.sh` files
unless their content changed.

## Don'ts

- Don't use `cd /home/...` in PowerShell — use UNC paths or a `wsl` prefix
- Don't run `bun`/`node` from Windows PowerShell directly — they're WSL binaries here
- Don't use `bash -lc` for command scripts — PATH pollution breaks them
- Don't leave `bash -ic` shells unchecked — they linger as zombie background tasks
- Don't inline commit messages / PR bodies with special chars — temp file + `-F` / `--body-file`
