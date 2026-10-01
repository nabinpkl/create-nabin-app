import { FEATURES, hasFeature, type Plan, type WebPlan } from "../plan.ts"
import { pythonVersions } from "../versions.ts"
import { lines } from "./text.ts"

// AGENTS.md, README.md, the justfile and the stack ADR: the files that tell the
// next agent what this project is and how to drive it.

export type Provenance = { version: string; invocation: string; date: string }

// Verbatim copy of the block `next dev` upserts into AGENTS.md when it detects a
// coding agent (next/dist/server/lib/generate-agent-files.js). Shipping it keeps
// the tree clean after the first `just dev`; if Next changes the text, `just e2e`
// fails on the dirty tree.
export const NEXT_AGENT_RULES = `<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` (resolved from this file's directory; in monorepos the \`next\` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by \`next dev\` — verify at \`node_modules/next/dist/server/lib/generate-agent-files.js\`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->`

export function agentsMd(plan: Plan): string {
  return lines(
    "# AGENTS.md",
    "",
    `Conventions for anyone, human or agent, working in ${plan.name}. Product intent is in`,
    "[PRD.md](PRD.md); the stack and why it was chosen is in",
    "[docs/adr/0002-stack.md](docs/adr/0002-stack.md).",
    "",
    "## Commands",
    "",
    "All tasks go through the [justfile](justfile); run `just` to list them.",
    "",
    ...commandLines(plan),
    "",
    "## Layout",
    "",
    ...layoutLines(plan),
    "",
    "## Conventions",
    "",
    ...conventionLines(plan),
    "- Decisions: load-bearing choices get a numbered record in `docs/adr/`; work in",
    "  progress gets a plan in `docs/plans/`.",
    ...todoLines(plan),
    plan.kind === "web" && plan.framework === "next" && !plan.api && "",
    plan.kind === "web" &&
      plan.framework === "next" &&
      !plan.api &&
      NEXT_AGENT_RULES
  )
}

// Scaffold gaps the next agent should close. Tick an item by deleting it.
function todoLines(plan: Plan): string[] {
  if (plan.kind !== "web") return []
  const web = plan.api ? "apps/web/" : ""
  const favicon =
    plan.framework === "next"
      ? `- [ ] Favicon: add \`${web}app/icon.svg\`; Next.js serves and links it automatically.`
      : `- [ ] Favicon: add \`${web}public/favicon.svg\` and link it in \`${web}index.html\` with\n  \`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />\`.`
  return ["", "## TODO", "", favicon]
}

function commandLines(plan: Plan): string[] {
  if (plan.kind === "python") {
    return [
      "- `just install`: create `.venv` and install dependencies (`uv sync`).",
      `- \`just dev\`: run the \`${plan.name}\` entry point.`,
      "- `just check`: Ruff lint and format check, ty typecheck, pytest. Must pass before a commit.",
      "- `just fix`: apply Ruff fixes and formatting.",
    ]
  }
  return [
    "- `just install`: install dependencies with pnpm.",
    plan.api
      ? "- `just dev`: run the web app and the API together."
      : "- `just dev`: run the app with hot reload.",
    `- \`just check\`: Biome lint and format check, TypeScript typecheck${plan.api ? ", API tests" : ""}. Must pass before a commit.`,
    "- `just fix`: apply Biome's safe fixes and formatting.",
    "- `just build`: production build.",
  ]
}

function layoutLines(plan: Plan): string[] {
  if (plan.kind === "python") {
    return [
      `- \`src/${plan.module}/\`: the package. \`main()\` in \`__init__.py\` is the \`${plan.name}\` command.`,
      "- `tests/`: pytest tests, named `test_*.py`.",
    ]
  }
  const web = plan.api ? "apps/web/" : ""
  const src = plan.framework === "vite" ? `${web}src/` : web
  const frontend =
    plan.framework === "vite"
      ? [
          `- \`${src}App.tsx\`: the start page. \`${src}main.tsx\` mounts it inside \`${src}components/providers.tsx\`.`,
        ]
      : [
          `- \`${web}app/\`: routes (App Router). \`${web}app/layout.tsx\` wraps every page in \`${web}components/providers.tsx\`.`,
        ]
  return [
    ...(plan.api
      ? [
          `- \`apps/web/\`: the frontend (${plan.framework === "vite" ? "Vite + React" : "Next.js"}).`,
          "- `apps/api/`: Hono on Bun. Routes in `src/app.ts`, server entry in `src/index.ts`,",
          "  tests beside the code as `*.test.ts` (`bun test`).",
          "- `packages/shared/`: Zod schemas and types that both apps import.",
          ...(plan.framework === "next"
            ? [
                "- `apps/web/AGENTS.md`: Next.js's own agent rules, maintained by `next dev`.",
              ]
            : []),
        ]
      : []),
    ...frontend,
    `- \`${src}components/\`: app components${hasFeature(plan, "shadcn") ? `; \`${src}components/ui/\` holds shadcn components` : ""}.`,
    `- \`${src}lib/\`: non-UI helpers. \`cn()\` lives in \`${src}lib/utils.ts\`.`,
    ...(hasFeature(plan, "zustand")
      ? [
          `- \`${src}stores/\`: Zustand stores, one file per concern (create it with the first store).`,
        ]
      : []),
  ]
}

function conventionLines(plan: Plan): string[] {
  if (plan.kind === "python") {
    return [
      "- Dependencies: uv only. `uv add <pkg>` or `uv add --dev <pkg>`; never pip.",
      `- Python ${pythonVersions.python}, pinned in \`.python-version\`.`,
      "- Type hints on every function signature; `ty` checks them (ty is in beta, so a",
      "  false positive is possible: confirm before contorting code to satisfy it).",
      "- Ruff owns linting, import order and formatting.",
    ]
  }
  return webConventions(plan)
}

function webConventions(plan: WebPlan): string[] {
  const has = (feature: keyof typeof FEATURES) => hasFeature(plan, feature)
  const web = plan.api ? "apps/web/" : ""
  const css =
    plan.framework === "vite" ? `${web}src/index.css` : `${web}app/globals.css`
  const theme =
    plan.framework === "vite"
      ? `\`${web}src/components/theme-provider.tsx\``
      : "next-themes"
  return [
    "- Package manager: pnpm. Never npm or yarn.",
    `- Styling: Tailwind CSS v4, configured in CSS (\`${css}\`). There is no tailwind.config.`,
    "- Responsive first: every screen and component works from a 360px phone up. Write",
    "  base classes for the narrowest width and layer `sm:`, `md:`, `lg:` on top; use",
    "  fluid widths (`w-full`, `max-w-*`, `min-w-0`) instead of fixed ones, wrap or scroll",
    "  long content inside its container, and never scroll the page sideways. Check phone",
    "  and desktop widths before calling UI work done.",
    `- Theming: light, dark and system (the default) through ${theme}. Style dark mode`,
    "  with `dark:` variants or theme CSS variables. Pressing d toggles it in the browser.",
    "- Class names: compose with `cn()` from `@/lib/utils`.",
    "- Lint and format: Biome only (`biome.json`). Do not add ESLint or Prettier.",
    has("shadcn") &&
      "- UI primitives: shadcn/ui on Base UI (not Radix). Add components with\n  `pnpm dlx shadcn@latest add <name>`; `components.json` already selects Base UI.\n  Generated components are owned code: edit them freely.",
    has("tanstack-query") &&
      "- Server state: TanStack Query (`useQuery`, `useMutation`). Do not copy server data\n  into component or global state.",
    has("zustand") &&
      `- Client state: Zustand, only for state shared across distant components. One store\n  per concern in the stores folder.${has("tanstack-query") ? " Server data stays in TanStack Query." : ""}`,
    has("tanstack-virtual") &&
      "- Long lists and tables: virtualize with `useVirtualizer` from `@tanstack/react-virtual`\n  once rows reach the hundreds.",
    has("zod") &&
      "- Validation: Zod at trust boundaries (form input, API responses, env). Derive types\n  with `z.infer` instead of writing parallel types.",
    plan.api &&
      "- API contract: routes chain on one Hono expression in `apps/api/src/app.ts`; the web\n  app calls them through the typed `hc<AppType>` client in its `lib/api.ts`. Shapes\n  that cross the wire are Zod schemas in `packages/shared`.",
    plan.api &&
      "- Config: `API_PORT` and `API_URL` have dev defaults in the justfile; export them to\n  override. Both apps fail at startup when they are missing.",
    "- Adding a library later: `pnpm add <pkg>`" +
      (plan.api ? " with `--filter <package>`" : "") +
      ", then note the convention here.",
  ].filter((line): line is string => typeof line === "string")
}

export function readmeMd(plan: Plan): string {
  const requirements =
    plan.kind === "python"
      ? "[uv](https://docs.astral.sh/uv/) and [just](https://github.com/casey/just)"
      : `Node 24+, [pnpm](https://pnpm.io), [just](https://github.com/casey/just)${plan.api ? " and [Bun](https://bun.sh)" : ""}`
  return lines(
    `# ${plan.name}`,
    "",
    "What this is for: [PRD.md](PRD.md).",
    "",
    "## Getting started",
    "",
    `Requires ${requirements}.`,
    "",
    "```sh",
    "just install",
    "just dev",
    "```",
    "",
    "Conventions and every task are in [AGENTS.md](AGENTS.md). Decisions are recorded in",
    "[docs/adr/](docs/adr/)."
  )
}

export function justfile(plan: Plan): string {
  const header = ["# List recipes", "default:", "    @just --list", ""]
  if (plan.kind === "python") {
    return lines(
      ...header,
      "# Create .venv and install dependencies",
      "install:",
      "    uv sync",
      "",
      `# Run the ${plan.name} entry point`,
      "dev *args:",
      `    uv run ${plan.name} {{args}}`,
      "",
      "# Lint, format check, typecheck, test",
      "check:",
      "    uv run ruff check .",
      "    uv run ruff format --check .",
      "    uv run ty check",
      "    uv run pytest",
      "",
      "# Apply Ruff fixes and formatting",
      "fix:",
      "    uv run ruff check --fix .",
      "    uv run ruff format ."
    )
  }
  const each = plan.api ? "pnpm --recursive" : "pnpm"
  return lines(
    plan.api && "# Dev defaults; export either variable to override.",
    plan.api && 'export API_PORT := env("API_PORT", "3001")',
    plan.api &&
      'export API_URL := env("API_URL", "http://localhost:" + API_PORT)',
    plan.api && "",
    ...header,
    "# Install dependencies",
    "install:",
    "    pnpm install",
    "",
    plan.api
      ? "# Run the web app and the API"
      : "# Run the app with hot reload",
    "dev:",
    plan.api ? "    pnpm --recursive --parallel run dev" : "    pnpm run dev",
    "",
    `# Lint, format check, typecheck${plan.api ? ", test" : ""}`,
    "check:",
    "    pnpm exec biome check .",
    `    ${each} run typecheck`,
    plan.api && "    pnpm --recursive run test",
    "",
    "# Apply safe lint fixes and formatting",
    "fix:",
    "    pnpm exec biome check --write .",
    "",
    "# Production build",
    "build:",
    `    ${each} run build`
  )
}

export function stackAdr(plan: Plan, provenance: Provenance): string {
  return lines(
    "# 2. Stack",
    "",
    "- Status: Accepted",
    `- Date: ${provenance.date}`,
    "",
    "## Context",
    "",
    `Scaffolded with create-nabin-app ${provenance.version}:`,
    "",
    "```sh",
    `create-nabin-app ${provenance.invocation}`,
    "```",
    "",
    "## Decision",
    "",
    ...stackDecision(plan),
    "",
    "## Consequences",
    "",
    "- Libraries not listed were left out on purpose. Adding one is a decision: record it",
    "  in a new ADR and in AGENTS.md conventions."
  )
}

function stackDecision(plan: Plan): string[] {
  if (plan.kind === "python") {
    return [
      `- Python ${pythonVersions.python} managed by uv, packaged with uv_build.`,
      "- Ruff for lint and format, ty for type checking, pytest for tests.",
    ]
  }
  return [
    plan.framework === "next"
      ? "- Frontend: Next.js App Router, because the app needs routes (`--routes`)."
      : "- Frontend: Vite + React single-page app; no routing was required.",
    plan.api
      ? "- Backend: Hono on Bun in `apps/api`, sharing Zod contracts with the web app\n  through `packages/shared` in a pnpm workspace (`--api`)."
      : "- Backend: none.",
    ...plan.features.map(
      (feature) => `- ${feature}: ${FEATURES[feature].summary}.`
    ),
    "- Always: React 19, TypeScript 7, Tailwind CSS 4, Biome, pnpm, and light, dark and",
    "  system theming.",
  ]
}
