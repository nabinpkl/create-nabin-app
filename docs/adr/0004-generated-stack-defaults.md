# 4. Defaults baked into generated projects

- Status: Accepted
- Date: 2026-10-01

## Context

The owner's stack: pnpm, React, Next.js or Vite, Tailwind v4, shadcn on Base UI, `cn`,
Zod, TanStack Query and Virtual, Zustand, Biome, a typecheck step, Bun with TypeScript for
shared client/server code, and uv for Python.

## Decision

- TypeScript 7 (the native compiler). Checked against Next.js 16.3 builds and `tsc -b`
  for Vite on 2026-10-01. TS 7 has no stable JS API yet, so tools that need one will not
  work.
- Biome is the only linter and formatter. Its config matches shadcn's formatting style
  (no semicolons, double quotes, es5 trailing commas) so vendored components pass
  untouched. Three a11y/suspicious rules are relaxed for `components/ui/**` only.
- `cn` is shadcn's own `cn` package, which replaces clsx plus tailwind-merge.
- Backend for `--api`: Hono on Bun, typed client via `hc<AppType>`, contracts as Zod
  schemas in `packages/shared`, all in a pnpm workspace. Bun is the runtime only; pnpm
  installs.
- Python: uv with `uv_build`, Ruff, pytest, and ty. ty is beta (0.0.x): fast and part of
  the same Astral toolchain, but pyright is the stable fallback if ty misbehaves.
- Version ranges are `^major.minor.0`, because pnpm 11's `minimumReleaseAge` rejects a
  range whose only matches are too new.

## Consequences

- Any change to these defaults is a new ADR plus a `just e2e` run.
