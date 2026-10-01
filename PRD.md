# create-nabin-app: PRD

A scaffolder like create-next-app, sized to the requirement: a project gets only the
libraries its requirements call for, with sensible defaults for the full-stack case.
Technical shape: [SPEC.md](SPEC.md).

## Problem

Starting a project means re-deciding the same stack and re-wiring the same tooling
(Tailwind v4, Biome, theming, shadcn on Base UI, TanStack Query, a typed API). Upstream
generators each cover one slice, prompt interactively, and default to tools this owner
does not use (npm, ESLint, Prettier, Radix). Most invocations come from coding agents,
which cannot answer prompts and need the result to be correct without a human looking.

## Goals

- One non-interactive command produces a project that installs, passes its own
  `just check`, builds, and runs.
- Requirements choose the stack: routing selects Next.js over Vite, a typed backend adds a
  Hono on Bun API with shared Zod contracts, Python work gets a uv project.
- Optional libraries (zustand, TanStack Query, TanStack Virtual, zod, shadcn) appear only
  when the requirement or an explicit flag asks for them.
- Agents can discover everything from `--help`, preview with `--dry-run --json`, and act on
  machine-readable results and exit codes.
- Every project starts with AGENTS.md, PRD.md, ADRs and a justfile, so the next agent
  knows the conventions.

## Non-goals

- Interactive prompts.
- Choosing between competing libraries for the same job (one stack, one way).
- Deployment, CI, auth, or database setup.

## Users

The owner, and coding agents acting for the owner.

## Open questions

- Publish to npm as `create-nabin-app` (enables `pnpm create nabin-app`), or keep it
  local via `pnpm link --global`?
- Should the Python stack grow AI-specific options (an LLM SDK, FastAPI, notebooks)?
