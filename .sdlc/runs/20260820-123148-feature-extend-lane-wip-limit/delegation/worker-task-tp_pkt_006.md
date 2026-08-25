## Task tp_pkt_006 — codegen / existing_file_edit
Module: web-data
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
IMPORTANT: do NOT explore the repository and do NOT read any file. Everything you need is in `inputs` below. Make exactly ONE file write, to the artifact path named below, and ZERO file reads. Do not create, modify or delete any other file.

Edit apps/web/src/fetchers/column/create-column.ts (full current content in inputs). One change only: widen the inline `data` parameter type to include `wipLimit?: number | null`. Keep the existing fields and their exact types. Change nothing else — not the client call, not the error handling, not the export. Implements FR-7.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/fetchers/column/create-column.ts
_Included because: Full current content of the file you must edit._

```
import { client } from "@kaneo/libs";

async function createColumn(
  projectId: string,
  data: { name: string; icon?: string; color?: string; isFinal?: boolean },
) {
  const response = await client.column[":projectId"].$post({
    param: { projectId },
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createColumn;
```
### Acceptance criteria
- The data parameter type includes wipLimit?: number | null
- name, icon, color and isFinal keep their existing types
- The client.column[":projectId"].$post call and error handling are unchanged
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