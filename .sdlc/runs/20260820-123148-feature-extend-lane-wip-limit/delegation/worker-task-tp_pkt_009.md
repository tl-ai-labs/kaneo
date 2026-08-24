## Task tp_pkt_009 — codegen / existing_file_edit
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below. Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Edit apps/web/src/hooks/mutations/column/use-update-column.ts (full current content in inputs). One change only: add `wipLimit?: number | null;` to the inline `data` type in mutationFn's parameter, after `isFinal?: boolean;`.

Do NOT change onSuccess — its invalidation of ["columns", variables.projectId] and ["tasks", variables.projectId] must survive untouched; the Kanban board refresh after a WIP-limit edit depends on the "tasks" invalidation. Implements FR-8.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/hooks/mutations/column/use-update-column.ts
_Included because: Full current content of the file you must edit._

```
import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateColumn from "@/fetchers/column/update-column";

export function useUpdateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      projectId: string;
      data: {
        name?: string;
        icon?: string | null;
        color?: string | null;
        isFinal?: boolean;
      };
    }) => updateColumn(id, data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["columns", variables.projectId],
          refetchType: "all",
        }),
        queryClient.invalidateQueries({
          queryKey: ["tasks", variables.projectId],
          refetchType: "all",
        }),
      ]);
    },
  });
}
```
### Acceptance criteria
- The mutationFn data type includes wipLimit?: number | null
- onSuccess still invalidates both ["columns", projectId] and ["tasks", projectId]
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```