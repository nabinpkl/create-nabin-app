# AGENTS.md

Repo conventions for anyone (human or agent) working here. Product intent lives in
[PRD.md](PRD.md); technical shape will live in SPEC.md once scoping is final.

## Commands

All tasks go through the [justfile](justfile). Run `just` to list recipes.

- `just check`: lint, typecheck, and test. Must pass before a commit.
- `just dev`: run the project locally.

No stack is chosen yet, so both recipes fail loud until they are wired to real tooling.
Wire them in the same change that introduces the stack.

## Layout

- `docs/adr/`: architecture decision records. Numbered `NNNN-kebab-title.md`, one per
  load-bearing decision. Immutable once accepted; supersede with a new record instead of
  editing. Format is in [0001](docs/adr/0001-record-architecture-decisions.md).
- `docs/plans/`: working plans for in-progress or upcoming work. Delete or mark done when
  the work lands; the code and ADRs are the record after that.

## Rules

- One home per fact. Link between these files instead of copying content across them.
- Environment-dependent values (URLs, ports, paths, credentials) go through config, never
  literals. Secrets live in `.env`, which is gitignored.
- If the project grows a UI, theming supports light, dark, and system from the start.
