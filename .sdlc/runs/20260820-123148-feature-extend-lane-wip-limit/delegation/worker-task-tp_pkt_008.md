## Task tp_pkt_008 — codegen / existing_file_edit
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below. Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Edit apps/web/src/hooks/mutations/column/use-create-column.ts (full current content in inputs). One change only: add `wipLimit?: number | null` to the inline `data` type in mutationFn's parameter.

Do NOT change the onSuccess handler. This hook deliberately invalidates every query (`invalidateQueries({ refetchType: "all" })` with no query key); leave that exactly as it is. Implements FR-8.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/hooks/mutations/column/use-create-column.ts
_Included because: Full current content of the file you must edit._

```
import { useMutation, useQueryClient } from "@tanstack/react-query";
import createColumn from "@/fetchers/column/create-column";

export function useCreateColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: { name: string; icon?: string; color?: string; isFinal?: boolean };
    }) => createColumn(projectId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ refetchType: "all" });
    },
  });
}
```
### Acceptance criteria
- The mutationFn data type includes wipLimit?: number | null
- onSuccess is byte-identical to before
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