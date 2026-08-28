## Task tp_review_001 — senior_code_review / review
Module: public-project
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Senior code review of a completed pure structural extraction. Everything you need is inlined below; do NOT search the repo and do NOT read outside the workspace.

The ONE thing that matters: is the rendered DOM byte-identical? Verify MECHANICALLY, not by eyeballing - tokenize the before-block and the after-component into an ordered sequence of (tagName, className) pairs plus the expression children in order, then compare the two sequences element by element. Report the two sequences in your findings so a reader can check your work.

Also check:
1. Does the new component follow repo conventions - `type` not `interface`, inferred/indexed types, no narrating comments?
2. Is the `getColumnIcon` import correctly RETAINED in kanban-view.tsx (the empty-state block still calls it)?
3. The h3 collapsed from 3 source lines to 1 when moved. Is that DOM-neutral under JSX whitespace rules? Answer explicitly yes/no with the rule.
4. Does the test actually prove anything, or is it vacuous? Be blunt. Specifically: `container.querySelector("svg")` - is that truthy on EVERY branch of getColumnIcon, including fallbacks? If so, say the test proves an icon renders, not the right icon.
5. Any scope creep beyond the two intended edits?

Return: `verdict` (one of approved / approved_with_findings / rejected), `findings` (array; each {severity: blocker|major|minor|nit, file, issue, recommendation}), `dom_identical` (boolean), `review_markdown` (the full writeup incl. the two tokenized sequences).

Do not invent problems to look thorough. An empty findings array is a valid answer if the change is clean. Equally, do not rubber-stamp.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### BEFORE - the inline header block removed from kanban-view.tsx (was lines 27-39)
_Included because: The original markup, the invariant baseline_

```
                <div className="p-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getColumnIcon(column.id, column.isFinal, column.icon)}
                      <h3 className="font-medium text-foreground">
                        {column.name}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {column.tasks.length}
                      </span>
                    </div>
                  </div>
                </div>
```

#### apps/web/src/components/public-project/public-column-header.tsx
_Included because: AFTER - the new component (full file as written)_

```
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

#### git diff of kanban-view.tsx
_Included because: The complete, only change to the existing file_

```
@@ -1,6 +1,7 @@
 import { getColumnIcon } from "@/lib/column";
 import type { ProjectWithTasks } from "@/types/project";
 import type Task from "@/types/task";
+import { PublicColumnHeader } from "./public-column-header";
 import { PublicTaskCard } from "./task-card";
@@ -24,19 +25,7 @@
               <div className="flex flex-col h-full w-full min-h-0 backdrop-blur-xs rounded-lg bg-sidebar border border-border/50 transition-[background-color,box-shadow] duration-150 ease hover:bg-accent/20 hover:shadow-sm">
-                <div className="p-2 shrink-0">
-                  <div className="flex items-center justify-between">
-                    <div className="flex items-center gap-2">
-                      {getColumnIcon(column.id, column.isFinal, column.icon)}
-                      <h3 className="font-medium text-foreground">
-                        {column.name}
-                      </h3>
-                      <span className="text-sm text-muted-foreground">
-                        {column.tasks.length}
-                      </span>
-                    </div>
-                  </div>
-                </div>
+                <PublicColumnHeader column={column} />
 
                 <div className="p-2 overflow-y-auto overflow-x-hidden flex-1 min-h-0 [-webkit-overflow-scrolling:touch]">
(the empty-state block below, which calls getColumnIcon again, is UNCHANGED)
```

#### apps/web/src/components/public-project/public-column-header.test.tsx
_Included because: The new test, added by coordinator instruction for comparability (the plan itself recommended against it)_

```
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import { PublicColumnHeader } from "./public-column-header";

afterEach(() => {
  cleanup();
});

describe("PublicColumnHeader", () => {
  const column = {
    id: "in-progress",
    name: "In Progress",
    isFinal: false,
    icon: null,
    tasks: [{}, {}],
  } as unknown as ProjectWithTasks["columns"][number];

  it("renders the column icon", () => {
    const { container } = render(<PublicColumnHeader column={column} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders the column name", () => {
    render(<PublicColumnHeader column={column} />);
    expect(screen.getByText("In Progress")).toBeTruthy();
  });

  it("renders the task count", () => {
    render(<PublicColumnHeader column={column} />);
    expect(screen.getByText("2")).toBeTruthy();
  });
});

```

#### VERIFICATION ALREADY RUN
_Included because: Facts, so you need not re-run anything_

```
pnpm --filter @kaneo/web typecheck -> exit 0
pnpm --filter @kaneo/web test -> 37 files / 115 tests passing (baseline was 36 files / 112 tests)
pnpm exec biome ci <the 3 changed paths> -> exit 0, 'Checked 3 files. No fixes applied.'
git status: only the 3 intended paths changed.
```
### Acceptance criteria
- review_markdown contains both tokenized (tag, className) sequences in order
- dom_identical is answered with the tokenized evidence, not an assertion
- The h3 reflow question is answered explicitly with the JSX whitespace rule
- The test's strength is assessed bluntly, incl. whether querySelector('svg') is truthy on all getColumnIcon branches
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "verdict": {
      "type": "string"
    },
    "dom_identical": {
      "type": "boolean"
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "severity": {
            "type": "string"
          },
          "file": {
            "type": "string"
          },
          "issue": {
            "type": "string"
          },
          "recommendation": {
            "type": "string"
          }
        },
        "required": [
          "severity",
          "file",
          "issue",
          "recommendation"
        ]
      }
    },
    "review_markdown": {
      "type": "string"
    }
  },
  "required": [
    "verdict",
    "dom_identical",
    "findings",
    "review_markdown"
  ]
}
```