## Task tp_cg_009 — codegen / existing_file_edit
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/web/src/types/task/index.ts. Add one field to the Task type, immediately after `priority`:

  estimatedMinutes?: number | null;

It must be optional AND nullable so existing call sites that never set it keep compiling. Do not touch TaskLabel, TaskExternalLink, or the default export. Change nothing else.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/types/task/index.ts (exact current Task type)
_Included because: Exact insertion point._

```
type Task = {
  id: string;
  title: string;
  number: number | null;
  description: string | null;
  status: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number | null;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage?: string | null;
  projectId: string;
  columnId?: string | null;
  labels?: TaskLabel[];
  externalLinks?: TaskExternalLink[];
};

export default Task;
```
### Acceptance criteria
- Task has estimatedMinutes?: number | null
- It is optional and nullable
- No other type or export is modified
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "edited": {
      "type": "boolean"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "edited",
    "summary"
  ]
}
```