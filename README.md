# create-nabin-app

Scaffolds a project sized to its requirements, without prompts. Pass requirement flags and
you get the smallest stack that meets them, already wired, formatted, and passing its
own `just check`.

```sh
create-nabin-app spa                                     # Vite + React + Tailwind
create-nabin-app next-frontend --routes --with zustand   # Next.js + shadcn (Base UI)
create-nabin-app fullstack --routes --api                # + Hono on Bun + shared Zod
create-nabin-app evals --python                          # uv + Ruff + ty + pytest
create-nabin-app x --routes --api --dry-run --json       # preview, write nothing
```

`create-nabin-app --help` is the full flag reference. Why it exists: [PRD.md](PRD.md).
How it works: [SPEC.md](SPEC.md).

## Running it

Requires Node 24+, pnpm and just. Generated projects also need Bun (for `--api`) or uv
(for `--python`).

```sh
just install
just run my-app --routes      # run from source
```

Contributor and agent conventions: [AGENTS.md](AGENTS.md). Decisions:
[docs/adr/](docs/adr/). Releasing: [docs/releasing.md](docs/releasing.md).

## License

MIT
