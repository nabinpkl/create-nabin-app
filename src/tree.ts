import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join, posix } from "node:path"
import { fileURLToPath } from "node:url"

// The whole scaffold is built in memory first, so --dry-run reports exactly what
// a real run writes. Keys are POSIX paths relative to the project root.
export type FileTree = Map<string, string>

const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url))

export type Placeholders = Record<string, string>

// Copies templates/<layer> into the tree under `into`. Later layers overwrite
// earlier ones. `{{key}}` is replaced only for keys in `placeholders`, in file
// contents and in path segments named `__key__`.
export async function addLayer(
  tree: FileTree,
  layer: string,
  into: string,
  placeholders: Placeholders = {}
): Promise<void> {
  const root = join(TEMPLATES_DIR, layer)
  for (const relative of await listFiles(root)) {
    const content = await readFile(join(root, relative), "utf8")
    const target = posix.join(into, fill(relative, placeholders, "__"))
    tree.set(target, fill(content, placeholders, "{{"))
  }
}

function fill(
  text: string,
  placeholders: Placeholders,
  style: "{{" | "__"
): string {
  let result = text
  for (const [key, value] of Object.entries(placeholders)) {
    const token = style === "{{" ? `{{${key}}}` : `__${key}__`
    result = result.replaceAll(token, value)
  }
  return result
}

async function listFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(join(root, prefix), { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) files.push(...(await listFiles(root, relative)))
    else files.push(relative)
  }
  return files
}

export async function isMissingOrEmpty(dir: string): Promise<boolean> {
  try {
    const info = await stat(dir)
    if (!info.isDirectory()) return false
    return (await readdir(dir)).length === 0
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true
    throw error
  }
}

export async function writeTree(tree: FileTree, dir: string): Promise<void> {
  for (const [path, content] of tree) {
    const target = join(dir, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}
