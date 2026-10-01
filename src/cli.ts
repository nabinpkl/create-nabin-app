#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { basename, relative } from "node:path"
import { parseArgs } from "node:util"
import type { Provenance } from "./generate/docs.ts"
import {
  FEATURES,
  type Options,
  type Plan,
  resolvePlan,
  UsageError,
} from "./plan.ts"
import { buildTree, StepError, scaffold } from "./scaffold.ts"
import { isMissingOrEmpty } from "./tree.ts"

const EXIT_FAILURE = 1
const EXIT_USAGE = 2

const featureRows = Object.entries(FEATURES)
  .map(
    ([name, info]) =>
      `  ${name.padEnd(18)}${info.summary}\n  ${"".padEnd(18)}default: ${info.defaultWhen}`
  )
  .join("\n")

const HELP = `create-nabin-app: scaffold a project sized to its requirements.
Never prompts. Every choice is a flag, so agents and scripts can drive it.

Usage
  create-nabin-app <dir> [flags]

Pick the smallest stack that meets the requirement. With no stack flag you get
a Vite + React single-page app with Tailwind and nothing else.

Stack flags
  --routes          The app needs multiple routes/pages or server rendering.
                    -> Next.js (App Router) instead of Vite.
  --api             The app needs a backend that shares types with the client.
                    -> pnpm workspace: apps/web, apps/api (Hono on Bun),
                       packages/shared (Zod schemas both sides import).
  --python          Python project (AI, data, scripts): uv, Ruff, ty, pytest.
                    Cannot be combined with any other stack or feature flag.

Feature flags (comma-separated or repeated; defaults depend on stack flags)
  --with <list>     Add features.
  --without <list>  Remove features a stack flag added by default.

${featureRows}

  Every web project also gets React 19, TypeScript 7, Tailwind CSS 4, Biome,
  pnpm, cn(), and light/dark/system theming.
  Every project gets AGENTS.md, CLAUDE.md, PRD.md, README.md, a justfile
  (install, dev, check, fix, build), and docs/adr with the stack recorded.

Behavior flags
  --name <name>     Package name. Default: the directory's basename.
  --dry-run         Resolve the plan and list the files; write nothing.
  --json            Print one JSON object on stdout. Progress goes to stderr.
  --no-install      Skip \`pnpm install\` / \`uv sync\`.
  --no-git          Skip \`git init\` and the initial commit.
  --force           Write into a non-empty directory, overwriting clashes.
  -h, --help        Show this help.
  -v, --version     Show the version.

Exit codes
  0 success, 1 a step failed (files may already be written; the error names
  the step), 2 usage error (nothing written).

Examples
  create-nabin-app spa
  create-nabin-app next-frontend --routes --with zustand,tanstack-virtual
  create-nabin-app fullstack --routes --api
  create-nabin-app tool --api --without tanstack-query
  create-nabin-app evals --python
  create-nabin-app x --routes --api --dry-run --json

After scaffolding: cd <dir> && just dev. \`just check\` must pass before commits.
`

type ParsedArgs = Options & {
  force: boolean
  dryRun: boolean
  json: boolean
  help: boolean
  version: boolean
}

function parse(argv: string[]): ParsedArgs {
  let parsed: ReturnType<typeof parseWith>
  try {
    parsed = parseWith(argv)
  } catch (error) {
    throw new UsageError(
      `${(error as Error).message}. Run create-nabin-app --help for usage.`
    )
  }
  const { values, positionals } = parsed
  if (positionals.length > 1) {
    throw new UsageError(
      `Expected one target directory, got ${positionals.length}: ${positionals.join(" ")}`
    )
  }
  return {
    dir: positionals[0],
    name: values.name,
    routes: values.routes,
    api: values.api,
    python: values.python,
    with: values.with,
    without: values.without,
    install: values.install,
    git: values.git,
    force: values.force,
    dryRun: values["dry-run"],
    json: values.json,
    help: values.help,
    version: values.version,
  }
}

function parseWith(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    strict: true,
    options: {
      routes: { type: "boolean", default: false },
      api: { type: "boolean", default: false },
      python: { type: "boolean", default: false },
      with: { type: "string", multiple: true, default: [] },
      without: { type: "string", multiple: true, default: [] },
      name: { type: "string" },
      install: { type: "boolean", default: true },
      git: { type: "boolean", default: true },
      force: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  })
}

// The invocation recorded in the generated ADR: requirement flags only, no local paths.
function invocation(args: ParsedArgs, plan: Plan): string {
  return [
    basename(plan.dir),
    args.name !== undefined && `--name ${args.name}`,
    args.routes && "--routes",
    args.api && "--api",
    args.python && "--python",
    args.with.length > 0 && `--with ${args.with.join(",")}`,
    args.without.length > 0 && `--without ${args.without.join(",")}`,
  ]
    .filter(Boolean)
    .join(" ")
}

function stackSummary(plan: Plan) {
  return plan.kind === "python"
    ? { kind: plan.kind, module: plan.module }
    : { kind: plan.kind, framework: plan.framework, api: plan.api }
}

async function packageVersion(): Promise<string> {
  const manifest = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8"
  )
  return (JSON.parse(manifest) as { version: string }).version
}

async function main(argv: string[]): Promise<number> {
  const wantsJson = argv.includes("--json")
  const emit = (value: unknown) =>
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
  const log = (message: string) => process.stderr.write(`${message}\n`)

  try {
    const args = parse(argv)
    const version = await packageVersion()
    if (args.help) {
      process.stdout.write(HELP)
      return 0
    }
    if (args.version) {
      process.stdout.write(`${version}\n`)
      return 0
    }

    const plan = resolvePlan(args)
    const provenance: Provenance = {
      version,
      invocation: invocation(args, plan),
      date: new Date().toISOString().slice(0, 10),
    }
    const tree = await buildTree(plan, provenance)
    const files = [...tree.keys()]
    const displayDir = relative(process.cwd(), plan.dir) || "."
    const summary = {
      dir: plan.dir,
      name: plan.name,
      stack: stackSummary(plan),
      features: plan.kind === "web" ? plan.features : [],
    }

    if (args.dryRun) {
      if (args.json) emit({ ok: true, dryRun: true, ...summary, files })
      else {
        log(describe(plan))
        log(`Would write ${files.length} files to ${displayDir}:`)
        for (const file of files) log(`  ${file}`)
      }
      return 0
    }

    if (!args.force && !(await isMissingOrEmpty(plan.dir))) {
      throw new UsageError(
        `${displayDir} exists and is not empty. Choose another directory or pass --force.`
      )
    }

    if (!args.json) log(describe(plan))
    const steps = await scaffold(plan, tree, log)
    const next = [
      `cd ${displayDir}`,
      ...(plan.install ? [] : ["just install"]),
      "just dev",
    ]
    if (args.json)
      emit({ ok: true, dryRun: false, ...summary, files, steps, next })
    else log(`\nDone. Next:\n${next.map((step) => `  ${step}`).join("\n")}`)
    return 0
  } catch (error) {
    const kind =
      error instanceof UsageError
        ? "usage"
        : error instanceof StepError
          ? "step"
          : "internal"
    const message = (error as Error).message
    if (wantsJson) {
      emit({
        ok: false,
        error: {
          kind,
          ...(error instanceof StepError ? { step: error.step } : {}),
          message,
        },
      })
    } else log(`error: ${message}`)
    return kind === "usage" ? EXIT_USAGE : EXIT_FAILURE
  }
}

function describe(plan: Plan): string {
  if (plan.kind === "python")
    return `Python project ${plan.name} (uv, Ruff, ty, pytest)`
  const frontend = plan.framework === "next" ? "Next.js" : "Vite + React"
  const backend = plan.api ? " + Hono API on Bun + shared Zod package" : ""
  const features = plan.features.length > 0 ? plan.features.join(", ") : "none"
  return `Web project ${plan.name}: ${frontend}${backend}. Features: ${features}`
}

process.exitCode = await main(process.argv.slice(2))
