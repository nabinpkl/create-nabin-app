import { spawn } from "node:child_process"
import {
  agentsMd,
  justfile,
  type Provenance,
  readmeMd,
  stackAdr,
} from "./generate/docs.ts"
import { buildPythonTree } from "./generate/python.ts"
import { buildWebTree } from "./generate/web.ts"
import type { Plan } from "./plan.ts"
import { addLayer, type FileTree, writeTree } from "./tree.ts"
import { pythonVersions } from "./versions.ts"

export async function buildTree(
  plan: Plan,
  provenance: Provenance
): Promise<FileTree> {
  const tree: FileTree = new Map()
  const placeholders = {
    name: plan.name,
    date: provenance.date,
    ...(plan.kind === "python"
      ? { module: plan.module, python: pythonVersions.python }
      : {}),
  }

  await addLayer(tree, "base", "", placeholders)
  if (plan.kind === "web") await buildWebTree(plan, tree, placeholders)
  else await buildPythonTree(plan, tree, placeholders)

  tree.set("AGENTS.md", agentsMd(plan))
  tree.set("README.md", readmeMd(plan))
  tree.set("justfile", justfile(plan))
  tree.set("docs/adr/0002-stack.md", stackAdr(plan, provenance))
  return new Map([...tree].sort(([a], [b]) => (a < b ? -1 : 1)))
}

export class StepError extends Error {
  readonly step: string

  constructor(step: string, message: string) {
    super(message)
    this.step = step
  }
}

export type StepStatus = "done" | "skipped"

export async function scaffold(
  plan: Plan,
  tree: FileTree,
  log: (message: string) => void
): Promise<{ install: StepStatus; git: StepStatus }> {
  log(`Writing ${tree.size} files to ${plan.dir}`)
  await writeTree(tree, plan.dir)

  let install: StepStatus = "skipped"
  if (plan.install) {
    const [command, args] =
      plan.kind === "python" ? ["uv", ["sync"]] : ["pnpm", ["install"]]
    log(`Installing dependencies: ${command} ${args.join(" ")}`)
    await run("install", command, args, plan.dir)
    install = "done"
  }

  let git: StepStatus = "skipped"
  if (plan.git) {
    log("Creating git repository with an initial commit")
    await run(
      "git",
      "git",
      ["init", "--quiet", "--initial-branch=main"],
      plan.dir
    )
    await run("git", "git", ["add", "--all"], plan.dir)
    await run(
      "git",
      "git",
      ["commit", "--quiet", "--message", "Scaffold with create-nabin-app"],
      plan.dir
    )
    git = "done"
  }
  return { install, git }
}

// Child output goes to stderr so stdout stays clean for --json.
function run(
  step: string,
  command: string,
  args: string[],
  cwd: string
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", process.stderr, process.stderr],
    })
    child.on("error", (error) =>
      reject(new StepError(step, `Could not run ${command}: ${error.message}`))
    )
    child.on("exit", (code) => {
      if (code === 0) resolvePromise()
      else
        reject(
          new StepError(
            step,
            `\`${command} ${args.join(" ")}\` exited with code ${code} in ${cwd}`
          )
        )
    })
  })
}
