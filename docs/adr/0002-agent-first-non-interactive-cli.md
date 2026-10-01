# 2. Agent-first, non-interactive CLI

- Status: Accepted
- Date: 2026-10-01

## Context

Coding agents run nearly every invocation. They cannot answer prompts, and they need to
learn the options and check the outcome without a human.

## Decision

- No prompts at all. Every choice is a flag, parsed strictly by `node:util` `parseArgs`;
  an unknown flag is a usage error, not something to ignore.
- `--help` is the complete contract: stack flags described by requirement ("needs
  routes") rather than by tool, feature defaults, exit codes, and examples.
- `--dry-run` resolves the plan and lists files without writing. `--json` prints one
  object on stdout (`ok`, stack, features, files, steps, next, or `error.kind`/`step`)
  and keeps progress on stderr.
- Exit codes: 0 success, 1 a step failed (files may exist), 2 usage error (nothing
  written).
- No runtime dependencies.

## Consequences

- Humans get no guided mode; `--help` and `--dry-run` replace it.
- The JSON shape and exit codes are a contract: change them deliberately, in a new ADR.
