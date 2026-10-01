import type { PythonPlan } from "../plan.ts"
import { addLayer, type FileTree, type Placeholders } from "../tree.ts"
import { pythonVersions } from "../versions.ts"
import { lines } from "./text.ts"

export async function buildPythonTree(
  plan: PythonPlan,
  tree: FileTree,
  placeholders: Placeholders
): Promise<void> {
  await addLayer(tree, "python", "", placeholders)
  tree.set("pyproject.toml", pyproject(plan))
  tree.set(".gitignore", PYTHON_GITIGNORE)
}

function pyproject(plan: PythonPlan): string {
  const quoted = (values: readonly string[]) =>
    values.map((value) => `"${value}"`).join(", ")
  return lines(
    "[project]",
    `name = "${plan.name}"`,
    'version = "0.1.0"',
    'readme = "README.md"',
    `requires-python = ">=${pythonVersions.python}"`,
    "dependencies = []",
    "",
    "[project.scripts]",
    `${plan.name} = "${plan.module}:main"`,
    "",
    "[dependency-groups]",
    `dev = [${quoted(pythonVersions.dev)}]`,
    "",
    "[build-system]",
    `requires = ["${pythonVersions.uvBuild}"]`,
    'build-backend = "uv_build"',
    "",
    "[tool.ruff.lint]",
    "# isort, pyupgrade, bugbear on top of the defaults.",
    'extend-select = ["I", "UP", "B"]',
    "",
    "[tool.pytest.ini_options]",
    'testpaths = ["tests"]'
  )
}

const PYTHON_GITIGNORE = `# Python
.venv/
__pycache__/
*.py[oc]
build/
dist/
*.egg-info/
.pytest_cache/
.ruff_cache/

# Secrets
.env
.env.*
!.env.example

# OS and editors
.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
`
