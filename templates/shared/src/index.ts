import { z } from "zod"

// Contracts both apps/web and apps/api import. Parse with these at trust boundaries:
// request bodies on the server, responses and form input on the client.

export const healthSchema = z.object({
  status: z.literal("ok"),
})

export type Health = z.infer<typeof healthSchema>
