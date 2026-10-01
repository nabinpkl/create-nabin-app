#!/usr/bin/env bash
# Regenerate templates/shadcn-{next,vite} from the upstream shadcn CLI (Base UI, nova preset).
# The vendored files are upstream output plus three edits noted below; never hand-edit them.
set -euo pipefail

COMPONENTS=(badge button card dialog dropdown-menu field input label select separator skeleton sonner textarea tooltip)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

generate() {
  local template="$1"
  (cd "$WORK" && pnpm dlx shadcn@latest create -t "$template" -b base -p nova -n "$template-ui" --no-monorepo -y -s)
  (cd "$WORK/$template-ui" && pnpm dlx shadcn@latest add "${COMPONENTS[@]}" -y -s)
}

generate next
generate vite

NEXT_OUT="$ROOT/templates/shadcn-next"
VITE_OUT="$ROOT/templates/shadcn-vite"
rm -rf "$NEXT_OUT" "$VITE_OUT"
mkdir -p "$NEXT_OUT/components" "$NEXT_OUT/app" "$VITE_OUT/src/components"

cp -R "$WORK/next-ui/components/ui" "$NEXT_OUT/components/ui"
cp "$WORK/next-ui/components.json" "$NEXT_OUT/components.json"
cp "$WORK/next-ui/app/globals.css" "$NEXT_OUT/app/globals.css"

cp -R "$WORK/vite-ui/src/components/ui" "$VITE_OUT/src/components/ui"
cp "$WORK/vite-ui/components.json" "$VITE_OUT/components.json"
cp "$WORK/vite-ui/src/index.css" "$VITE_OUT/src/index.css"

# Edit 1: the Vite app has its own theme provider, not next-themes.
perl -pi -e 's#import\ \{\ useTheme\ \}\ from\ \"next\-themes\"#import { useTheme } from "@/components/theme-provider"#' \
  "$VITE_OUT/src/components/ui/sonner.tsx"

# Edit 2: strict equality where upstream compares a number with ==.
perl -pi -e 's#length == 1\b#length === 1#' \
  "$NEXT_OUT/components/ui/field.tsx" "$VITE_OUT/src/components/ui/field.tsx"

# Edit 3: format to this repo's Biome config so generated projects pass `just check` untouched.
(cd "$ROOT" && pnpm exec biome check --write templates/shadcn-next templates/shadcn-vite)

echo "Refreshed shadcn templates. Review with: git diff --stat templates/"
