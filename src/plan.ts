import { basename, resolve } from "node:path"

// Turns requirement flags into a concrete stack. Pure: no filesystem, no processes.

export const FEATURES = {
  shadcn: {
    summary: "shadcn/ui on Base UI: 14 components, cn, lucide icons",
    defaultWhen: "--routes",
  },
  "tanstack-query": {
    summary: "Server-state fetching and caching",
    defaultWhen: "--api",
  },
  zod: {
    summary: "Schema validation at boundaries",
    defaultWhen: "--routes or --api (required by --api)",
  },
  zustand: {
    summary: "Global client state",
    defaultWhen: "never",
  },
  "tanstack-virtual": {
    summary: "Virtualized long lists and tables",
    defaultWhen: "never",
  },
} as const

export type Feature = keyof typeof FEATURES

const FEATURE_NAMES = Object.keys(FEATURES) as Feature[]

export type Options = {
  dir: string | undefined
  name: string | undefined
  routes: boolean
  api: boolean
  python: boolean
  with: string[]
  without: string[]
  install: boolean
  git: boolean
}

type Common = {
  name: string
  dir: string
  install: boolean
  git: boolean
}

export type WebPlan = Common & {
  kind: "web"
  framework: "vite" | "next"
  api: boolean
  features: Feature[]
}

export type PythonPlan = Common & {
  kind: "python"
  module: string
}

export type Plan = WebPlan | PythonPlan

export class UsageError extends Error {}

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

export function resolvePlan(options: Options): Plan {
  if (!options.dir) {
    throw new UsageError("Missing target directory: create-nabin-app <dir>")
  }
  const dir = resolve(options.dir)
  const name = options.name ?? basename(dir)
  if (!NAME_PATTERN.test(name) || name.length > 214) {
    throw new UsageError(
      `Invalid name "${name}": use lowercase letters, digits, ".", "_" or "-", starting with a letter or digit. Pass --name to set it explicitly.`
    )
  }
  const common = { name, dir, install: options.install, git: options.git }

  if (options.python) {
    const conflicting = [
      options.routes && "--routes",
      options.api && "--api",
      options.with.length > 0 && "--with",
      options.without.length > 0 && "--without",
    ].filter(Boolean)
    if (conflicting.length > 0) {
      throw new UsageError(
        `--python cannot be combined with ${conflicting.join(", ")}; those flags shape web projects.`
      )
    }
    const module = name.replace(/[.-]/g, "_")
    if (/^[0-9]/.test(module)) {
      throw new UsageError(
        `Python module name "${module}" cannot start with a digit. Pass --name to choose another.`
      )
    }
    return { kind: "python", ...common, module }
  }

  const added = parseFeatures(options.with, "--with")
  const removed = parseFeatures(options.without, "--without")
  const both = added.filter((feature) => removed.includes(feature))
  if (both.length > 0) {
    throw new UsageError(
      `${both.join(", ")} passed to both --with and --without.`
    )
  }
  if (options.api && removed.includes("zod")) {
    throw new UsageError(
      "--api requires zod: packages/shared holds the Zod schemas both apps import."
    )
  }

  const features = new Set<Feature>(added)
  for (const feature of defaultFeatures(options)) {
    if (!removed.includes(feature)) features.add(feature)
  }

  return {
    kind: "web",
    ...common,
    framework: options.routes ? "next" : "vite",
    api: options.api,
    features: FEATURE_NAMES.filter((feature) => features.has(feature)),
  }
}

function defaultFeatures(options: Options): Feature[] {
  const defaults: Feature[] = []
  if (options.routes) defaults.push("shadcn", "zod")
  if (options.api) defaults.push("tanstack-query", "zod")
  return defaults
}

function parseFeatures(values: string[], flag: string): Feature[] {
  const names = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value !== "")
  const unknown = names.filter(
    (value) => !FEATURE_NAMES.includes(value as Feature)
  )
  if (unknown.length > 0) {
    throw new UsageError(
      `Unknown feature for ${flag}: ${unknown.join(", ")}. Valid: ${FEATURE_NAMES.join(", ")}.`
    )
  }
  return names as Feature[]
}

export function hasFeature(plan: WebPlan, feature: Feature): boolean {
  return plan.features.includes(feature)
}
