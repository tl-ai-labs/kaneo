## Task tp_025 — codegen / react_component
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
In apps/web/src/components/task/task-estimate-popover.tsx ONLY, replace the hard-coded DOM id `task-estimate-hours` with a React-generated one. Import `useId` from react, add `const inputId = useId();` alongside the other hooks, and use `inputId` for BOTH the label's `htmlFor` and the Input's `id`. Rationale: task-properties-sidebar.tsx renders the mobile (lg:hidden) and desktop blocks simultaneously in the DOM, so two instances of this component co-exist and a hard-coded id produces genuinely duplicate ids, breaking label/input association for assistive technology. Change NOTHING else — leave the useEffect re-seed, the parse/format calls, the toasts, and the `if (!canEdit) return <>{children}</>;` early return exactly as they are. Afterwards confirm no string literal `task-estimate-hours` remains anywhere in the repo. If apps/web/src/components/task/task-estimate-popover.test.tsx queries the input by that literal id, update that query to use getByLabelText instead — that file is allowlisted. Verify with EXACTLY: pnpm --filter @kaneo/web test src/components/task/task-estimate-popover.test.tsx (note: NO double-dash before the path, the double-dash form silently runs the whole suite). Do NOT run the full web suite.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- useId() is used for both htmlFor and id
- No string literal task-estimate-hours remains in the repo
- The early return, useEffect re-seed and conversion logic are unchanged
- The single-file filtered test passes
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
    "tests_passed": {
      "type": "number"
    },
    "literal_removed": {
      "type": "boolean"
    }
  },
  "required": [
    "artifact_path",
    "tests_passed",
    "literal_removed"
  ]
}
```