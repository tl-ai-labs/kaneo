## Task tp_decomp_001 — plan_task_packets / decomposition
Module: public-project
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the Gate-2-approved change plan into EXACTLY THREE TaskPackets and return them as a JSON array in `packets`.

The three, in dependency order:
1. id `tp_codegen_001`, phase `codegen`, task_type `new_file_add`, artifact_path `apps/web/src/components/public-project/public-column-header.tsx`
2. id `tp_codegen_002`, phase `codegen`, task_type `existing_file_edit`, artifact_path `apps/web/src/components/public-project/kanban-view.tsx`
3. id `tp_tests_001`, phase `tests`, task_type `test_add`, subtype `unit`, artifact_path `apps/web/src/components/public-project/public-column-header.test.tsx`

Do NOT invent a fourth packet, do NOT rename these ids, do NOT change these task_type values, and do NOT use `react_component` for any of them.

Each packet object must carry: id, phase, task_type, module (`public-project`), instruction, inputs (array, may be []), outputSchema, acceptance (array of testable strings), budget {maxInputTokens, maxOutputTokens}, retry_count 0, pass_id `20260827-124738-refactor-lane-header`, intent `refactor`, artifact_path, and subtype where given above.

Write each packet's `instruction` field so a stateless worker could execute it with no other context: embed the exact target file content or the exact edit for packets 1 and 2, and the frozen test spec for packet 3. Set budget.maxOutputTokens to 3000 for packets 1 and 2 and 3000 for packet 3.

Return ONLY the JSON array. No prose.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260827-124738-refactor-lane-header/change_plan.md
_Included because: Gate-2 approved plan: exact component text, exact edit, DOM invariant_

```
## Target file 1 - public-column-header.tsx (new), EXACT content:
```tsx
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";

type PublicColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function PublicColumnHeader({ column }: PublicColumnHeaderProps) {
  return (
    <div className="p-2 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
          <h3 className="font-medium text-foreground">{column.name}</h3>
          <span className="text-sm text-muted-foreground">
            {column.tasks.length}
          </span>
        </div>
      </div>
    </div>
  );
}
```

## Target file 2 - kanban-view.tsx (edit)
- ADD import: `import { PublicColumnHeader } from "./public-column-header";`
- The existing `import { getColumnIcon } from "@/lib/column";` MUST STAY (line 57 empty-state still calls it).
- DELETE lines 27-39 inclusive (the `<div className="p-2 shrink-0">` block through its closing `</div>`), REPLACE with the single line `<PublicColumnHeader column={column} />`.
- Change NOTHING else in the file.

## DOM invariant
Outer `p-2 shrink-0` div > `flex items-center justify-between` div > `flex items-center gap-2` div > getColumnIcon(column.id, column.isFinal, column.icon) > h3.font-medium.text-foreground with {column.name} > span.text-sm.text-muted-foreground with {column.tasks.length}. Byte-identical before and after.

```

#### FROZEN_TEST_SPEC
_Included because: Coordinator-frozen spec for packet 3, overriding the plan's unit_test_recommended:false_

```
Test file: apps/web/src/components/public-project/public-column-header.test.tsx
- vitest + @testing-library/react (this repo uses `describe`/`it`/`expect` imported from "vitest", and `render`/`screen` from "@testing-library/react")
- Column fixture MUST use id: "in-progress" - it maps to CircleDot in apps/web/src/constants/column-icons.ts, so the UNMOCKED getColumnIcon takes its primary branch.
- Do NOT mock `@/lib/column`. Leave it real.
- Assert the icon renders via `container.querySelector("svg")` being truthy.
- Assert the column name and the task count via `screen` queries.
- Do NOT assert on any Tailwind class string.
- The fixture column needs at minimum: id, name, isFinal, icon, tasks (an array whose length is asserted). Cast the fixture with `as` to the ProjectWithTasks column element type if the full shape is large - do not hand-write a new exported type.

```
### Acceptance criteria
- packets is an array of exactly 3 objects
- ids are tp_codegen_001, tp_codegen_002, tp_tests_001 in that order
- task_types are new_file_add, existing_file_edit, test_add - none is react_component
- every packet has artifact_path matching the three allowlisted paths
- every packet carries pass_id and intent refactor
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "packets": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  },
  "required": [
    "packets"
  ]
}
```