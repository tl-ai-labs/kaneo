## Task tp_cg_004 — codegen / existing_file_edit
Module: api-schema
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
CONTAINMENT (mandatory): Do not run git commands. Do not read any path under .sdlc/runs/ other than 20260831-092456-feature-extend-estimated-hours. Do not read any git branch other than the checked-out one.

Edit ONLY apps/api/src/schemas.ts. In taskSchema, immediately after the priority field, add:

  estimatedMinutes: v.optional(
    v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(525_600))),
  ),

This is the OpenAPI response schema. It MUST be integer-constrained, not a bare v.number(), so it cannot admit a fractional value such as 2.5 on the read path. Do not touch labelSchema, projectSchema, activitySchema or any other export. Change nothing else.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/api/src/schemas.ts (taskSchema, exact current text)
_Included because: Exact insertion point, immediately after the priority picklist._

```
export const taskSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  position: v.nullable(v.number()),
  number: v.nullable(v.number()),
  userId: v.nullable(v.string()),
  title: v.string(),
  description: v.nullable(v.string()),
  status: v.string(),
  priority: v.picklist([
    "no-priority",
    "low",
    "medium",
    "high",
    "urgent",
  ] as const),
  startDate: v.optional(v.date()),
  dueDate: v.optional(v.date()),
  createdAt: v.date(),
});
```
### Acceptance criteria
- taskSchema has estimatedMinutes as optional, nullable and integer-constrained
- The bound 525_600 is present
- No other schema export is modified
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