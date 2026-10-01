import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { biomeJson } from "../src/generate/web.ts"
import { type Options, resolvePlan } from "../src/plan.ts"
import { buildTree } from "../src/scaffold.ts"

const provenance = {
  version: "0.0.0-test",
  invocation: "x",
  date: "2026-01-01",
}

function tree(overrides: Partial<Options>) {
  return buildTree(
    resolvePlan({
      dir: "demo",
      name: undefined,
      routes: false,
      api: false,
      python: false,
      with: [],
      without: [],
      install: false,
      git: false,
      ...overrides,
    }),
    provenance
  )
}

test("the repo's biome.json is the generated config", async () => {
  const repo = await readFile(new URL("../biome.json", import.meta.url), "utf8")
  assert.equal(repo, biomeJson(true))
})

test("a bare Vite app carries no optional libraries", async () => {
  const files = await tree({})
  const manifest = JSON.parse(files.get("package.json") ?? "{}")
  const deps = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })
  for (const optional of [
    "zustand",
    "zod",
    "@tanstack/react-query",
    "@base-ui/react",
    "next",
  ]) {
    assert.ok(!deps.includes(optional), `${optional} should not be installed`)
  }
  assert.ok(files.has("src/App.tsx"))
  assert.ok(!files.has("components.json"))
})

test("--routes --api lays out the workspace with shadcn in apps/web", async () => {
  const files = await tree({ routes: true, api: true })
  for (const path of [
    "pnpm-workspace.yaml",
    "apps/web/app/page.tsx",
    "apps/web/components/ui/button.tsx",
    "apps/web/lib/api.ts",
    "apps/api/src/app.ts",
    "packages/shared/src/index.ts",
    "docs/adr/0002-stack.md",
  ]) {
    assert.ok(files.has(path), `missing ${path}`)
  }
  assert.ok(!files.has("apps/web/components/api-status.tsx"))
  assert.match(
    files.get("apps/web/app/page.tsx") ?? "",
    /return <main className="min-h-svh" \/>/
  )
  const web = JSON.parse(files.get("apps/web/package.json") ?? "{}")
  assert.equal(web.dependencies["@demo/shared"], "workspace:*")
  assert.match(files.get("apps/api/src/app.ts") ?? "", /from "@demo\/shared"/)
})

test("no placeholder survives substitution", async () => {
  for (const overrides of [{}, { routes: true, api: true }, { python: true }]) {
    for (const [path, content] of await tree(overrides)) {
      assert.doesNotMatch(content, /\{\{(name|module|date|python)\}\}/, path)
      assert.doesNotMatch(path, /__(module)__/, path)
    }
  }
})

test("--python builds an importable package", async () => {
  const files = await tree({ python: true })
  assert.ok(files.has("src/demo/__init__.py"))
  assert.match(files.get("pyproject.toml") ?? "", /demo = "demo:main"/)
  assert.match(
    files.get("tests/test_greeting.py") ?? "",
    /from demo import greeting/
  )
})

test("web AGENTS.md carries the favicon TODO and responsive-first rule", async () => {
  for (const overrides of [{}, { routes: true }, { routes: true, api: true }]) {
    const agents = (await tree(overrides)).get("AGENTS.md") ?? ""
    assert.match(agents, /## TODO\n\n- \[ \] Favicon/)
    assert.match(agents, /Responsive first/)
  }
  const python = (await tree({ python: true })).get("AGENTS.md") ?? ""
  assert.doesNotMatch(python, /Favicon|Responsive/)
})
