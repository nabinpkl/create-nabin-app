import type { Health } from "@{{name}}/shared"
import { Hono } from "hono"

// Route definitions only, so the web app can import AppType without Bun globals.
// Chain routes on one expression: the RPC client types come from this chain.
export const app = new Hono()
  .basePath("/api")
  .get("/health", (c) => c.json({ status: "ok" } satisfies Health))

export type AppType = typeof app
