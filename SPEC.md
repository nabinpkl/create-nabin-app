# create-nabin-app: SPEC

Technical shape. Product intent: [PRD.md](PRD.md). Flag-level contract: `create-nabin-app
--help` (source: `src/cli.ts`). Decisions and their reasons: [docs/adr/](docs/adr/).

## Pipeline

```
argv --parseArgs--> Options --resolvePlan--> Plan --buildTree--> FileTree --scaffold--> disk
                    (cli.ts)                (plan.ts)           (scaffold.ts)
```

1. `resolvePlan` is pure: it validates flags, applies stack defaults, and returns a
   `WebPlan` or `PythonPlan`, or throws `UsageError` (exit 2, nothing written).
2. `buildTree` assembles every output file in memory, so `--dry-run` lists exactly what a
   real run writes.
3. `scaffold` writes the tree, then runs `pnpm install` / `uv sync` and `git init` plus
   an initial commit unless disabled. A failing step throws `StepError` (exit 1) naming
   the step; files already written stay.

## Stack resolution

| Flags            | Frontend      | Backend                    | Default features    |
| ---------------- | ------------- | -------------------------- | ------------------- |
| none             | Vite + React  | none                       | none                |
| `--routes`       | Next.js       | none                       | shadcn, zod         |
| `--api`          | Vite + React  | Hono on Bun + shared Zod   | tanstack-query, zod |
| `--routes --api` | Next.js       | Hono on Bun + shared Zod   | all four above      |
| `--python`       | none          | none (uv package)          | n/a                 |

`--with` and `--without` adjust features. zustand and tanstack-virtual are never
defaults. `--api` requires zod.

## File tree assembly

Layers are copied in order and later layers overwrite earlier ones:

1. `templates/base` to the root: CLAUDE.md, PRD.md, ADR 0001, docs/plans.
2. `templates/web-vite` or `templates/web-next` to the web root (`.` or `apps/web`).
3. `templates/shadcn-vite` or `templates/shadcn-next`, when shadcn is on. Vendored
   upstream output; overwrites the plain stylesheet with shadcn's tokens.
4. With `--api`: `templates/api-hono` to `apps/api`, `templates/shared` to
   `packages/shared`.
5. Python: `templates/python`, with `__module__` path segments renamed.

Then the generators in `src/generate/` add everything plan-dependent: package manifests,
`pnpm-workspace.yaml`, `biome.json`, `.gitignore`, providers, start page (blank for
Next.js), API client, API status component (Vite only), Vite/Next config,
`pyproject.toml`, AGENTS.md, README.md, justfile, and `docs/adr/0002-stack.md` (which
records the invocation).

## Generated project invariants

- Installs with pnpm 11 under a minimumReleaseAge policy (ranges in `src/versions.ts`).
- `just check`, `just build` and `just dev` work without edits and leave the git tree
  clean. Next.js projects ship the agent-rules block `next dev` would otherwise write.
- Light, dark and system theming in every web project; system is the default.
- Web AGENTS.md states responsive-first layout and lists a favicon TODO.
- With `--api`: `just dev` serves the web app, which proxies `/api` to the Hono server.
  The web app calls it through `hc<AppType>`; the Vite start page also shows
  `/api/health`, parsed with the shared schema.
  `API_PORT` and `API_URL` are set by the justfile, and both apps fail fast without them.

## Verification

- `just check`: unit tests over plan resolution and tree assembly.
- `just e2e`: eight stack combinations, each scaffolded, installed, checked and built for
  real. Web cases then boot `just dev` and fetch the start page; API cases also fetch
  `/api/health` through the web proxy. The git tree must still be clean afterwards.
