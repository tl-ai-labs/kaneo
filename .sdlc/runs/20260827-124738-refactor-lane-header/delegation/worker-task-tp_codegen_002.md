## Task tp_codegen_002 — codegen / existing_file_edit
Module: public-project
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
EDIT the existing file `apps/web/src/components/public-project/kanban-view.tsx`. Make exactly two changes and nothing else.

CHANGE 1 - add one import. After the existing line `import type Task from "@/types/task";` the file already has `import { PublicTaskCard } from "./task-card";`. Add alongside it:
  import { PublicColumnHeader } from "./public-column-header";
Biome sorts imports alphabetically by module path, so `./public-column-header` sorts BEFORE `./task-card`. Place it accordingly.
The existing `import { getColumnIcon } from "@/lib/column";` MUST STAY - the empty-state block further down still calls getColumnIcon.

CHANGE 2 - replace the inline header block. Delete lines 27 through 39 inclusive, which are exactly:
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
and put in their place this single line, at the same indentation (16 spaces):
                <PublicColumnHeader column={column} />

Do NOT touch anything else: not the empty-state block, not the task list, not the outer wrappers, not the PublicTaskCard props. Do not reformat untouched lines.

Efficiency requirement: you may read only kanban-view.tsx. Do NOT search the repo and do NOT read files outside the workspace. Then return the full post-edit content of the file.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/components/public-project/kanban-view.tsx
_Included because: The file to edit; read it in place_

```
(read the file in the workspace - it is at the path given)
```
### Acceptance criteria
- kanban-view.tsx imports PublicColumnHeader from ./public-column-header
- The inline header block is gone and replaced by <PublicColumnHeader column={column} />
- import { getColumnIcon } from "@/lib/column" is still present
- The empty-state block that calls getColumnIcon is unchanged
- No other line in the file is altered
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
    },
    "getcolumnicon_import_retained": {
      "type": "boolean"
    }
  },
  "required": [
    "filePath",
    "content",
    "wrote_file",
    "getcolumnicon_import_retained"
  ]
}
```