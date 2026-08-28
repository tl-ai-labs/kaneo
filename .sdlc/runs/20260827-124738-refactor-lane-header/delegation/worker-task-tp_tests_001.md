## Task tp_tests_001 — tests / test_add
Module: public-project
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
WRITE the new test file `apps/web/src/components/public-project/public-column-header.test.tsx`.

It tests this component (already on disk at ./public-column-header):

  export function PublicColumnHeader({ column }: { column: ProjectWithTasks["columns"][number] })

which renders div.p-2.shrink-0 > div > div containing getColumnIcon(column.id, column.isFinal, column.icon), an <h3> with {column.name}, and a <span> with {column.tasks.length}.

FROZEN SPEC - follow exactly:
- Import { render, screen } from "@testing-library/react" and { describe, expect, it } from "vitest". This repo does NOT enable vitest globals, so these imports are required. jsdom and @testing-library/jest-dom are already configured globally; do not configure them.
- Do NOT mock `@/lib/column`. Leave getColumnIcon real.
- The column fixture MUST use id: "in-progress". That maps to CircleDot in src/constants/column-icons.ts, so the real getColumnIcon takes its primary branch and renders an svg.
- Fixture fields: id "in-progress", name something like "In Progress", isFinal false, icon null, tasks an array of 2 placeholder objects.
- The column element type is a large API-derived type. Build the fixture as a plain object and cast it once with `as unknown as ProjectWithTasks["columns"][number]`, importing `type { ProjectWithTasks } from "@/types/project"`. Do NOT hand-write or export a new type.
- Assert: (1) `container.querySelector("svg")` is truthy - take `container` from the render result; (2) the column name is present via a screen query; (3) the task count "2" is present via a screen query.
- Do NOT assert on any Tailwind/className string.
- Keep it to one `describe` with 2-3 `it` blocks. No comments.

Efficiency requirement: everything you need is above. Do NOT search the repo, do NOT read files outside the workspace. Write this one file, then return it.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- The test file exists and imports describe/expect/it from vitest and render/screen from @testing-library/react
- @/lib/column is NOT mocked
- The fixture column id is exactly "in-progress"
- An assertion checks container.querySelector("svg") is truthy
- The column name and the task count are asserted via screen queries
- No assertion references a Tailwind class string
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "filePath": {
      "type": "string"
    },
    "content": {
      "type": "string"
    },
    "wrote_file": {
      "type": "boolean"
    }
  },
  "required": [
    "filePath",
    "content",
    "wrote_file"
  ]
}
```