import { expect, test } from "bun:test"
import { app } from "./app"

test("GET /api/health reports ok", async () => {
  const response = await app.request("/api/health")
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: "ok" })
})
