## Task tp_codegen_001 — codegen / new_file_add
Module: public-project
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
WRITE the new file `apps/web/src/components/public-project/public-column-header.tsx` with EXACTLY this content and nothing else:

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

Efficiency requirement: everything you need is in this instruction. Do NOT search, list or read the repository. Do NOT read files outside the workspace. Write exactly this one file, then stop. Add no comments, no extra exports, no default export. Do not reformat. Then return the file path you wrote and the content you wrote.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- The file apps/web/src/components/public-project/public-column-header.tsx exists on disk
- It exports a named function component PublicColumnHeader
- The single prop column is typed ProjectWithTasks["columns"][number] via a `type` alias, not an interface
- The DOM is outer div.p-2.shrink-0 > div.flex.items-center.justify-between > div.flex.items-center.gap-2 > getColumnIcon call, h3.font-medium.text-foreground, span.text-sm.text-muted-foreground
- No comments and no other file is touched
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