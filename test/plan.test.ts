import assert from "node:assert/strict"
import { test } from "node:test"
import { type Options, resolvePlan, UsageError } from "../src/plan.ts"

function options(overrides: Partial<Options> = {}): Options {
  return {
    dir: "my-app",
    name: undefined,
    routes: false,
    api: false,
    python: false,
    with: [],
    without: [],
    install: false,
    git: false,
    ...overrides,
  }
}

function webPlan(overrides: Partial<Options> = {}) {
  const plan = resolvePlan(options(overrides))
  assert.equal(plan.kind, "web")
  return plan
}

test("no stack flags is a bare Vite app", () => {
  const plan = webPlan()
  assert.equal(plan.framework, "vite")
  assert.equal(plan.api, false)
  assert.deepEqual(plan.features, [])
  assert.equal(plan.name, "my-app")
})

test("--routes picks Next.js with shadcn and zod", () => {
  const plan = webPlan({ routes: true })
  assert.equal(plan.framework, "next")
  assert.deepEqual(plan.features, ["shadcn", "zod"])
})

test("--api adds the workspace with tanstack-query and zod", () => {
  const plan = webPlan({ api: true })
  assert.equal(plan.framework, "vite")
  assert.equal(plan.api, true)
  assert.deepEqual(plan.features, ["tanstack-query", "zod"])
})

test("--with adds and --without removes, comma-separated or repeated", () => {
  const plan = webPlan({
    routes: true,
    with: ["zustand,tanstack-virtual"],
    without: ["shadcn"],
  })
  assert.deepEqual(plan.features, ["zod", "zustand", "tanstack-virtual"])
})

test("--api cannot drop zod", () => {
  assert.throws(
    () => resolvePlan(options({ api: true, without: ["zod"] })),
    UsageError
  )
})

test("unknown features are rejected with the valid list", () => {
  assert.throws(
    () => resolvePlan(options({ with: ["redux"] })),
    /Unknown feature for --with: redux\. Valid: shadcn/
  )
})

test("a feature in both --with and --without is rejected", () => {
  assert.throws(
    () => resolvePlan(options({ with: ["zustand"], without: ["zustand"] })),
    UsageError
  )
})

test("--python excludes web flags", () => {
  assert.throws(
    () => resolvePlan(options({ python: true, routes: true })),
    /--python cannot be combined with --routes/
  )
})

test("--python derives an importable module name", () => {
  const plan = resolvePlan(options({ python: true, dir: "eval-harness" }))
  assert.equal(plan.kind, "python")
  assert.equal(plan.module, "eval_harness")
})

test("names must be npm-safe", () => {
  assert.throws(() => resolvePlan(options({ dir: "My App" })), UsageError)
  assert.equal(
    resolvePlan(options({ dir: "My App", name: "my-app" })).name,
    "my-app"
  )
})

test("a missing directory is a usage error", () => {
  assert.throws(() => resolvePlan(options({ dir: undefined })), UsageError)
})
