# 3. Vendored template layers, not upstream generators at scaffold time

- Status: Accepted
- Date: 2026-10-01

## Context

create-next-app, create-vite and `shadcn create` each produce part of the stack, but they
prompt, use npm, add ESLint and Prettier, and their output changes between releases.
Calling them at scaffold time makes runs slow, network-bound, and non-deterministic.

## Decision

Projects are assembled from static layers in `templates/` plus small generators for
plan-dependent files. The shadcn layers are the exception that proves the rule: they are
upstream output, regenerated on demand by `scripts/refresh-shadcn.sh` (Base UI, nova
preset, a fixed component set) with three scripted edits, and never hand-edited.

## Consequences

- Scaffolding is a file copy plus one install, and the same flags give the same files.
- Upstream improvements arrive only when someone runs `just refresh-shadcn` or bumps
  `src/versions.ts`. `just e2e` is the gate for both.
