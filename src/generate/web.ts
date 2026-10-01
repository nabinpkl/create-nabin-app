import { hasFeature, type WebPlan } from "../plan.ts"
import { addLayer, type FileTree, type Placeholders } from "../tree.ts"
import { type NpmPackage, npmVersions } from "../versions.ts"
import { NEXT_AGENT_RULES } from "./docs.ts"
import { importLines, json, lines } from "./text.ts"

// Builds every file of a web project: a single app at the root, or with --api a
// pnpm workspace of apps/web, apps/api and packages/shared.

export const WEB_ROOT = "apps/web"

export async function buildWebTree(
  plan: WebPlan,
  tree: FileTree,
  placeholders: Placeholders
): Promise<void> {
  const webDir = plan.api ? WEB_ROOT : ""
  const shadcn = hasFeature(plan, "shadcn")

  await addLayer(tree, `web-${plan.framework}`, webDir, placeholders)
  // Vendored upstream output: no placeholder substitution.
  if (shadcn) await addLayer(tree, `shadcn-${plan.framework}`, webDir)
  if (plan.api) {
    await addLayer(tree, "api-hono", "apps/api", placeholders)
    await addLayer(tree, "shared", "packages/shared", placeholders)
    tree.set("apps/api/package.json", apiPackageJson(plan))
    tree.set("packages/shared/package.json", sharedPackageJson(plan))
    tree.set(
      "package.json",
      json({
        name: plan.name,
        private: true,
        type: "module",
        devDependencies: pick("@biomejs/biome"),
      })
    )
  }

  const at = (path: string) => (webDir ? `${webDir}/${path}` : path)
  const src = plan.framework === "vite" ? "src/" : ""
  tree.set(at("package.json"), webPackageJson(plan))
  tree.set(at(`${src}components/providers.tsx`), providers(plan))
  if (plan.api) {
    tree.set(at(`${src}lib/api.ts`), apiClient(plan))
    if (plan.framework === "vite" && hasFeature(plan, "tanstack-query")) {
      tree.set(at(`${src}components/api-status.tsx`), apiStatus(plan))
    }
  }
  if (plan.framework === "vite") {
    tree.set(at("vite.config.ts"), viteConfig(plan))
    tree.set(at("src/App.tsx"), startPage(plan))
  } else {
    tree.set(at("next.config.ts"), nextConfig(plan))
    tree.set(at("app/page.tsx"), startPage(plan))
    // In a workspace `next dev` writes these into apps/web; single apps carry the
    // block in the root AGENTS.md instead (see agentsMd).
    if (plan.api) {
      tree.set(at("AGENTS.md"), `${NEXT_AGENT_RULES}\n`)
      tree.set(at("CLAUDE.md"), "@AGENTS.md\n")
    }
  }

  tree.set("pnpm-workspace.yaml", pnpmWorkspace(plan))
  tree.set("biome.json", biomeJson(shadcn))
  tree.set(".gitignore", WEB_GITIGNORE)
}

function pick(...packages: (NpmPackage | false)[]): Record<string, string> {
  const selected = packages.filter((name): name is NpmPackage => name !== false)
  return Object.fromEntries(
    selected.sort().map((name) => [name, npmVersions[name]])
  )
}

function webPackageJson(plan: WebPlan): string {
  const has = (feature: Parameters<typeof hasFeature>[1]) =>
    hasFeature(plan, feature)
  const vite = plan.framework === "vite"
  const shadcn = has("shadcn")

  const dependencies: Record<string, string> = pick(
    "react",
    "react-dom",
    "cn",
    vite ? "tailwindcss" : "next",
    vite && "@tailwindcss/vite",
    !vite && "next-themes",
    shadcn && "@base-ui/react",
    shadcn && "class-variance-authority",
    shadcn && "lucide-react",
    shadcn && "shadcn",
    shadcn && "sonner",
    shadcn && "tw-animate-css",
    shadcn && vite && "@fontsource-variable/geist",
    has("tanstack-query") && "@tanstack/react-query",
    has("tanstack-virtual") && "@tanstack/react-virtual",
    has("zod") && "zod",
    has("zustand") && "zustand",
    plan.api && "hono"
  )
  const devDependencies: Record<string, string> = pick(
    "typescript",
    "@types/node",
    "@types/react",
    "@types/react-dom",
    vite && "vite",
    vite && "@vitejs/plugin-react",
    !vite && "tailwindcss",
    !vite && "@tailwindcss/postcss",
    !plan.api && "@biomejs/biome"
  )
  if (plan.api) {
    dependencies[`@${plan.name}/shared`] = "workspace:*"
    devDependencies[`@${plan.name}/api`] = "workspace:*"
  }

  return json({
    name: plan.api ? `@${plan.name}/web` : plan.name,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: vite
      ? {
          dev: "vite",
          build: "tsc -b && vite build",
          preview: "vite preview",
          typecheck: "tsc -b",
        }
      : {
          dev: "next dev",
          build: "next build",
          start: "next start",
          typecheck: "tsc --noEmit",
        },
    dependencies: sortKeys(dependencies),
    devDependencies: sortKeys(devDependencies),
  })
}

function apiPackageJson(plan: WebPlan): string {
  return json({
    name: `@${plan.name}/api`,
    private: true,
    version: "0.0.0",
    type: "module",
    exports: { ".": "./src/app.ts" },
    scripts: {
      dev: "bun --hot src/index.ts",
      start: "bun src/index.ts",
      test: "bun test",
      typecheck: "tsc --noEmit",
    },
    dependencies: sortKeys({
      ...pick("hono"),
      [`@${plan.name}/shared`]: "workspace:*",
    }),
    devDependencies: pick("@types/bun", "typescript"),
  })
}

function sharedPackageJson(plan: WebPlan): string {
  return json({
    name: `@${plan.name}/shared`,
    private: true,
    version: "0.0.0",
    type: "module",
    exports: { ".": "./src/index.ts" },
    scripts: { typecheck: "tsc --noEmit" },
    dependencies: pick("zod"),
    devDependencies: pick("typescript"),
  })
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1))
  )
}

function pnpmWorkspace(plan: WebPlan): string {
  return lines(
    plan.api && "packages:",
    plan.api && "  - apps/*",
    plan.api && "  - packages/*",
    plan.api && "",
    "# pnpm 11 refuses dependency build scripts unless allowed here.",
    "allowBuilds:",
    "  '@biomejs/biome': true",
    plan.framework === "next" && "  sharp: true",
    "  esbuild: true"
  )
}

function providers(plan: WebPlan): string {
  const query = hasFeature(plan, "tanstack-query")
  const toaster = hasFeature(plan, "shadcn")
  const imports = importLines([
    query && [
      "@tanstack/react-query",
      'import { QueryClient, QueryClientProvider } from "@tanstack/react-query"',
    ],
    [
      "react",
      query
        ? 'import { type ReactNode, useState } from "react"'
        : 'import type { ReactNode } from "react"',
    ],
    [
      "@/components/theme-provider",
      'import { ThemeProvider } from "@/components/theme-provider"',
    ],
    toaster && [
      "@/components/ui/sonner",
      'import { Toaster } from "@/components/ui/sonner"',
    ],
  ])
  const content = query
    ? "      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>"
    : "      {children}"

  return lines(
    plan.framework === "next" && '"use client"',
    plan.framework === "next" && "",
    imports,
    "",
    "export function Providers({ children }: { children: ReactNode }) {",
    query && "  const [queryClient] = useState(() => new QueryClient())",
    query && "",
    !query && !toaster
      ? "  return <ThemeProvider>{children}</ThemeProvider>"
      : lines(
          "  return (",
          "    <ThemeProvider>",
          content,
          toaster && "      <Toaster />",
          "    </ThemeProvider>",
          "  )"
        ).trimEnd(),
    "}"
  )
}

function muted(plan: WebPlan): string {
  return hasFeature(plan, "shadcn")
    ? "text-muted-foreground"
    : "text-neutral-500 dark:text-neutral-400"
}

// Next.js starts blank; the Vite app keeps a small start page (and the API status
// check when --api brings TanStack Query).
function startPage(plan: WebPlan): string {
  if (plan.framework === "next") {
    return lines(
      "export default function Page() {",
      '  return <main className="min-h-svh" />',
      "}"
    )
  }
  const status = plan.api && hasFeature(plan, "tanstack-query")
  return lines(
    status && 'import { ApiStatus } from "@/components/api-status"',
    status && "",
    "export function App() {",
    "  return (",
    '    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 p-6">',
    `      <h1 className="font-semibold text-2xl">${plan.name}</h1>`,
    `      <p className="${muted(plan)}">`,
    "        Edit src/App.tsx to start. Press d to toggle dark mode.",
    "      </p>",
    status && "      <ApiStatus />",
    "    </main>",
    "  )",
    "}"
  )
}

function apiClient(plan: WebPlan): string {
  return lines(
    `import type { AppType } from "@${plan.name}/api"`,
    'import { hc } from "hono/client"',
    "",
    plan.framework === "vite"
      ? "// Same origin: the Vite dev server proxies /api to the Hono app (vite.config.ts)."
      : "// Same origin: Next.js rewrites /api to the Hono app (next.config.ts).",
    'export const api = hc<AppType>("/").api'
  )
}

// Vite only: the Next.js start page is blank.
function apiStatus(plan: WebPlan): string {
  const error = hasFeature(plan, "shadcn")
    ? "text-destructive"
    : "text-red-600 dark:text-red-400"
  return lines(
    importLines([
      [
        `@${plan.name}/shared`,
        `import { healthSchema } from "@${plan.name}/shared"`,
      ],
      [
        "@tanstack/react-query",
        'import { useQuery } from "@tanstack/react-query"',
      ],
      ["@/lib/api", 'import { api } from "@/lib/api"'],
    ]),
    "",
    "export function ApiStatus() {",
    "  const health = useQuery({",
    '    queryKey: ["health"],',
    "    queryFn: async () => {",
    "      const response = await api.health.$get()",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: emitted source code
    "      if (!response.ok) throw new Error(`API responded ${response.status}`)",
    "      return healthSchema.parse(await response.json())",
    "    },",
    "  })",
    "",
    "  if (health.isPending) {",
    returnParagraph("    ", muted(plan), "API: checking"),
    "  }",
    "  if (health.isError) {",
    returnParagraph("    ", error, "API: {health.error.message}"),
    "  }",
    returnParagraph("  ", muted(plan), "API: {health.data.status}"),
    "}"
  )
}

// `return <p className="...">text</p>`, wrapped the way Biome does past 80 columns.
function returnParagraph(indent: string, className: string, text: string) {
  const element = `<p className="${className}">${text}</p>`
  const single = `${indent}return ${element}`
  if (single.length <= 80) return single
  if (indent.length + 2 + element.length <= 80) {
    return [`${indent}return (`, `${indent}  ${element}`, `${indent})`].join(
      "\n"
    )
  }
  return [
    `${indent}return (`,
    `${indent}  <p className="${className}">`,
    `${indent}    ${text}`,
    `${indent}  </p>`,
    `${indent})`,
  ].join("\n")
}

function viteConfig(plan: WebPlan): string {
  const header = lines(
    'import { resolve } from "node:path"',
    'import tailwindcss from "@tailwindcss/vite"',
    'import react from "@vitejs/plugin-react"',
    'import { defineConfig } from "vite"',
    ""
  )
  if (!plan.api) {
    return lines(
      header,
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      "  resolve: {",
      "    alias: {",
      '      "@": resolve(import.meta.dirname, "./src"),',
      "    },",
      "  },",
      "})"
    )
  }
  return lines(
    header,
    "export default defineConfig(({ command }) => {",
    "  // `just dev` exports API_URL; the dev server proxies /api to it.",
    "  const apiUrl = process.env.API_URL",
    '  if (command === "serve" && !apiUrl) {',
    '    throw new Error("API_URL is not set. Start the app with `just dev`.")',
    "  }",
    "",
    "  return {",
    "    plugins: [react(), tailwindcss()],",
    "    resolve: {",
    "      alias: {",
    '        "@": resolve(import.meta.dirname, "./src"),',
    "      },",
    "    },",
    '    server: { proxy: apiUrl ? { "/api": apiUrl } : undefined },',
    "  }",
    "})"
  )
}

function nextConfig(plan: WebPlan): string {
  if (!plan.api) {
    return lines(
      'import type { NextConfig } from "next"',
      "",
      "const nextConfig: NextConfig = {}",
      "",
      "export default nextConfig"
    )
  }
  return lines(
    'import type { NextConfig } from "next"',
    "",
    "// `just dev` and `just build` export API_URL; /api is rewritten to it.",
    "const apiUrl = process.env.API_URL",
    "if (!apiUrl) {",
    '  throw new Error("API_URL is not set. Run through `just dev` or `just build`.")',
    "}",
    "",
    "const nextConfig: NextConfig = {",
    `  transpilePackages: ["@${plan.name}/shared"],`,
    "  async rewrites() {",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: emitted source code
    '    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }]',
    "  },",
    "}",
    "",
    "export default nextConfig"
  )
}

// shadcn components are upstream-owned patterns: a generic Label whose control the
// caller supplies, div role="group" fields, and index keys on a deduplicated error
// list. Those rules are relaxed for components/ui only.
const SHADCN_OVERRIDE = `,
  "overrides": [
    {
      "includes": ["**/components/ui/**"],
      "linter": {
        "rules": {
          "a11y": {
            "noLabelWithoutControl": "off",
            "useSemanticElements": "off"
          },
          "suspicious": { "noArrayIndexKey": "off" }
        }
      }
    }
  ]`

export function biomeJson(shadcn: boolean): string {
  return `{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true },
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 80 },
  "javascript": {
    "formatter": { "semicolons": "asNeeded", "trailingCommas": "es5" }
  },
  "css": { "parser": { "tailwindDirectives": true } },
  "linter": {
    "enabled": true,
    "domains": { "react": "recommended" },
    "rules": { "preset": "recommended" }
  },
  "assist": { "actions": { "source": { "organizeImports": "on" } } }${shadcn ? SHADCN_OVERRIDE : ""}
}
`
}

const WEB_GITIGNORE = `# Dependencies
node_modules/

# Build output
dist/
.next/
out/
next-env.d.ts
*.tsbuildinfo
coverage/

# Secrets
.env
.env.*
!.env.example

# OS and editors
.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
`
