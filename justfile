# Task surface for create-nabin-app. See AGENTS.md.

default:
    @just --list

# Install dev dependencies
install:
    pnpm install

# Run the CLI from source, e.g. `just run my-app --routes --dry-run`
run *args:
    node src/cli.ts {{args}}

# Lint, format check, typecheck, unit tests
check:
    pnpm exec biome check .
    pnpm exec tsc --noEmit
    node --test 'test/**/*.test.ts'

# Apply safe lint fixes and formatting
fix:
    pnpm exec biome check --write .

# Scaffold, install, check, build and smoke every stack (network, minutes). Optional case names.
e2e *cases:
    test/e2e.sh {{cases}}

# Compile to dist/ for the published bin
build:
    rm -rf dist
    pnpm exec tsc -p tsconfig.build.json

# Regenerate templates/shadcn-* from the upstream shadcn CLI
refresh-shadcn:
    scripts/refresh-shadcn.sh
