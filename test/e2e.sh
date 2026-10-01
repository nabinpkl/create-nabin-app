#!/usr/bin/env bash
# Scaffolds every stack combination for real, installs it, and runs the generated
# project's own `just check` and `just build`. API projects also boot `just dev`
# and fetch /api/health through the web dev server's proxy.
# Needs network. Usage: test/e2e.sh [case-name ...]   (default: all cases)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${E2E_DIR:-$(mktemp -d)}"
mkdir -p "$OUT"
CASES=(
  "vite-bare|"
  "vite-full|--with shadcn,tanstack-query,zustand,tanstack-virtual,zod"
  "next-default|--routes"
  "next-bare|--routes --without shadcn,zod"
  "vite-api|--api"
  "vite-api-noquery|--api --without tanstack-query"
  "next-api|--routes --api --with zustand,tanstack-virtual"
  "evals|--python"
)

selected=("$@")
passed=()
failed=()

kill_tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null || true
}

# Boots `just dev` (API on a random port), reads the web URL from the dev server's
# own output (it moves off a busy default port), and checks the start page renders.
# With --api it also fetches /api/health through the web server's proxy.
smoke_dev() {
  local dir="$1" name="$2" api="$3"
  local api_port=$((40000 + RANDOM % 10000))
  (cd "$dir" && API_PORT="$api_port" exec just dev >"$dir/.dev.log" 2>&1) &
  local pid=$!
  local web_url="" page="" health="" ok=""
  for _ in $(seq 1 90); do
    web_url="$(grep -Eo 'Local:[[:space:]]+http://localhost:[0-9]+' "$dir/.dev.log" | head -1 | grep -Eo 'http://localhost:[0-9]+' || true)"
    if [[ -n "$web_url" ]]; then
      page="$(curl -fsS "$web_url/" 2>/dev/null || true)"
      [[ "$api" == 1 ]] && health="$(curl -fsS "$web_url/api/health" 2>/dev/null || true)"
      if [[ "$page" == *"$name"* && ("$api" != 1 || "$health" == '{"status":"ok"}') ]]; then
        ok=1
        break
      fi
    fi
    sleep 1
  done
  kill_tree "$pid"
  wait "$pid" 2>/dev/null || true
  if [[ -z "$ok" ]]; then
    echo "smoke: ${web_url:-no web url}: page has name? $([[ "$page" == *"$name"* ]] && echo yes || echo no); /api/health='$health'; dev log:" >&2
    tail -30 "$dir/.dev.log" >&2
    return 1
  fi
  rm -f "$dir/.dev.log"
  echo "smoke: $web_url/ renders $name${health:+; /api/health -> $health (API on :$api_port)}"
}

run_case() {
  local name="$1" flags="$2" dir="$OUT/$1"
  rm -rf "$dir"
  # shellcheck disable=SC2086
  node "$ROOT/src/cli.ts" "$dir" $flags --json >"$OUT/$name.json"
  cd "$dir" || return 1
  just check
  if [[ "$flags" != *--python* ]]; then
    just build
  fi
  if [[ "$flags" != *--python* ]]; then
    local api=0
    [[ "$flags" == *--api* ]] && api=1
    smoke_dev "$dir" "$name" "$api"
  fi
  [[ -z "$(git status --porcelain)" ]] || {
    echo "working tree dirty after check/build:" >&2
    git status --short >&2
    return 1
  }
}

for entry in "${CASES[@]}"; do
  name="${entry%%|*}"
  flags="${entry#*|}"
  if [[ ${#selected[@]} -gt 0 && ! " ${selected[*]} " =~ " $name " ]]; then
    continue
  fi
  echo "=== $name: create-nabin-app $name $flags"
  # Not inside `if`: that would disable set -e within the case.
  set +e
  (set -e; run_case "$name" "$flags")
  status=$?
  set -e
  if [[ $status -eq 0 ]]; then passed+=("$name"); else failed+=("$name"); fi
done

echo
echo "e2e output: $OUT"
echo "passed: ${passed[*]:-none}"
echo "failed: ${failed[*]:-none}"
[[ ${#failed[@]} -eq 0 ]]
