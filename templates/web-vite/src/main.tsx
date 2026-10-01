import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@/App"
import { Providers } from "@/components/providers"
import "@/index.css"

const root = document.getElementById("root")
if (!root) throw new Error("index.html is missing the #root element")

createRoot(root).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
)
