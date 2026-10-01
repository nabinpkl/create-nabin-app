import { app } from "./app"

const port = Number(Bun.env.API_PORT)
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(
    `API_PORT must be a port number, got "${Bun.env.API_PORT}". \`just dev\` sets it.`
  )
}

export default { port, fetch: app.fetch }
