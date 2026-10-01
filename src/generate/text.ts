// Helpers for emitting source text that already matches the generated Biome config,
// so a fresh project passes `just check` without a formatting pass.

type Part = string | false | undefined

// Joins parts with newlines, dropping `false`/`undefined`, with one trailing newline.
export function lines(...parts: Part[]): string {
  const kept = parts.filter((part): part is string => typeof part === "string")
  return `${kept.join("\n").replace(/\n+$/, "")}\n`
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

type ImportEntry = [source: string, line: string]

// Orders import lines the way Biome's organizeImports does: protocol packages
// (node:, bun:), then packages, then aliases (@/), then relative paths.
export function importLines(entries: (ImportEntry | false)[]): string {
  return entries
    .filter((entry): entry is ImportEntry => entry !== false)
    .sort(
      ([a], [b]) =>
        importRank(a) - importRank(b) || (a < b ? -1 : a > b ? 1 : 0)
    )
    .map(([, line]) => line)
    .join("\n")
}

function importRank(source: string): number {
  if (/^[a-z]+:/.test(source)) return 0
  if (source.startsWith("@/")) return 2
  if (source.startsWith(".")) return 3
  return 1
}
