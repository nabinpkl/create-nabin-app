// Single home for every dependency range the scaffolder writes.
// Lower bounds are the versions the e2e suite last passed against. Keep them at
// `.0` patches so pnpm's minimumReleaseAge can still pick an older mature patch.
export const npmVersions = {
  "@base-ui/react": "^1.8.0",
  "@biomejs/biome": "^2.5.0",
  "@fontsource-variable/geist": "^5.3.0",
  "@tailwindcss/postcss": "^4.3.0",
  "@tailwindcss/vite": "^4.3.0",
  "@tanstack/react-query": "^5.104.0",
  "@tanstack/react-virtual": "^3.14.0",
  "@types/bun": "^1.3.0",
  "@types/node": "^24.0.0",
  "@types/react": "^19.2.0",
  "@types/react-dom": "^19.2.0",
  "@vitejs/plugin-react": "^6.1.0",
  "class-variance-authority": "^0.7.0",
  cn: "^0.4.0",
  hono: "^4.13.0",
  "lucide-react": "^1.40.0",
  next: "^16.3.0",
  "next-themes": "^0.4.0",
  react: "^19.2.0",
  "react-dom": "^19.2.0",
  shadcn: "^4.21.0",
  sonner: "^2.0.0",
  tailwindcss: "^4.3.0",
  "tw-animate-css": "^1.4.0",
  typescript: "^7.0.0",
  vite: "^8.3.0",
  zod: "^4.6.0",
  zustand: "^5.0.0",
} as const

export type NpmPackage = keyof typeof npmVersions

export const pythonVersions = {
  python: "3.13",
  uvBuild: "uv_build>=0.12.0,<0.13.0",
  dev: ["pytest>=9.1", "ruff>=0.16", "ty>=0.0.84"],
} as const
