## Task tp_sec_001 — security_review / changed_files_review
Module: board-filters
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Security review of a brownfield change, scoped to the CHANGED FILES ONLY (feature-extend intent). This is a client-side-only change: no API, schema, auth or server code was touched.

STEP 1 — run `git diff` and `git status`, then read the changed files:
  apps/web/src/lib/board-filter-params.ts  (new — the parser, and the main attack surface)
  apps/web/src/hooks/use-task-filters-with-labels-support.ts
  apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx
  apps/web/src/components/{kanban-board,list-view}/*.tsx
The change makes the board's five filters (status, priority, assignee, dueDate, labels) round-trip through TanStack Router search params, so ATTACKER-CONTROLLED URL CONTENT NOW REACHES NEW CODE. That is the threat model.

STEP 2 — write .sdlc/runs/20260826-103235-feature-extend-board-filter-chips/security_review.md

Assess each of these concretely, with a verdict and file:line evidence. Do not pad with generic advice.
  S1 UNTRUSTED INPUT REACHING RENDER. Filter values come from the URL and flow into the chips and into task filtering. Are any of them rendered as HTML, injected into dangerouslySetInnerHTML, used to build a URL, or passed to anything that evaluates them? Trace an attacker-supplied `?labels=<script>` end to end and say where it stops being dangerous.
  S2 PROTOTYPE POLLUTION. validateBoardSearch iterates keys of an attacker-controlled object. Can `__proto__`, `constructor` or `prototype` in the query string pollute Object.prototype? Check how the result object is built and whether any key from the input is used as an assignment target.
  S3 RESOURCE EXHAUSTION. The array cap is 50 per dimension. Is the cap applied BEFORE or AFTER the full input array is walked? What does `?labels=<100k-element JSON array>` cost? Is there any unbounded regex, nested loop over attacker-sized data, or quadratic behaviour in the filter matching path?
  S4 NEVER-THROW AS A SECURITY PROPERTY. A throwing validateSearch is a denial of service on the route. Confirm the guarantee holds for hostile shapes, and check whether the empty catch blocks swallow anything that should surface.
  S5 PRIVACY OF SHAREABLE LINKS. This is the substantive one. `assignee` holds user IDs and `labels` holds label IDs, and the whole point of the feature is that these URLs get shared and bookmarked. Consider: internal user IDs now appear in URLs that land in chat logs, referrer headers, browser history and analytics. Does a recipient who lacks workspace access gain anything from the IDs alone? Is authorization still enforced server-side regardless of URL content? State plainly whether this is acceptable and what the residual exposure is.
  S6 LOCALSTORAGE. Filters are written to `kaneo:board-filters:${projectId}`. Opening a shared link deliberately OVERWRITES the viewer's stored filters for that project — this is an intended, user-confirmed behaviour, not a bug. Assess whether anything sensitive is newly persisted, and whether a hostile link can write unbounded data into a victim's localStorage.
  S7 SECRETS AND SCOPE. Confirm no credential, token or secret is introduced, and that no off-limits path (apps/api, .env, main.tsx, routeTree.gen.ts, store/user-preferences.ts, i18n) was modified.

End with a findings table ranked by severity (critical/high/medium/low/informational), each with file:line and a concrete remediation. If the honest answer is that a client-side filter-encoding change carries little security risk, SAY THAT plainly rather than manufacturing findings — an inflated report is worse than a short one. But do not miss S3 or S5.

STEP 3 — SCOPE. Write exactly ONE file: the security_review.md above. Modify NO source file. Read-only commands are fine; you may run `pnpm --filter @kaneo/web test`. Do NOT run biome, prettier, eslint, `pnpm lint` or `pnpm i18n:check:fix`.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/web/src/lib/board-filter-params.ts
_Included because: The parser that first touches attacker-controlled URL content. S2 and S3 hinge on exactly how it builds its result object and where the cap is applied._

```
const FILTER_KEYS = ["status","priority","assignee","dueDate","labels"] as const;
const MAX_ARRAY_LENGTH = 50;

function parseFilterParam(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const cleaned: string[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (trimmed.length > 0) {
          cleaned.push(trimmed);
          if (cleaned.length === MAX_ARRAY_LENGTH) break;
        }
      }
    }
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : undefined;
  }
  return undefined;
}

export function validateBoardSearch(search: Record<string, unknown>): BoardSearchParams {
  try {
    if (!search || typeof search !== "object") return {};
    const result: BoardSearchParams = {};
    const rawTaskId = search.taskId;
    if (typeof rawTaskId === "string") {
      const trimmed = rawTaskId.trim();
      if (trimmed.length > 0) result.taskId = trimmed;
    }
    for (const key of FILTER_KEYS) {
      const parsed = parseFilterParam(search[key]);
      if (parsed !== undefined) result[key] = parsed;
    }
    return result;
  } catch { return {}; }
}
```

#### CONTEXT
_Included because: What the router does before this code runs, and what the app does with the values afterwards._

```
The router parses the query string with JSON.parse per value BEFORE validateBoardSearch sees it
(defaultParseSearch = parseSearchWith(JSON.parse)), so `?labels=["a","b"]` arrives already as an
array, and a 100k-element JSON array in the URL would already be materialised by the router.

Downstream, filter values are compared against task fields:
  filters.status.includes(task.status)
  filters.priority.includes(task.priority ?? "")
  filters.assignee.includes(task.userId ?? "")     <-- user IDs
  filters.labels.some((id) => taskLabelIds.includes(id))
and the chips render label/user NAMES looked up from workspace data by ID, not the raw URL value.

The API is unchanged and remains the sole authority for authentication and authorization; nothing
in this change sends filter values to the server.
```
### Acceptance criteria
- Each of S1-S7 has an explicit verdict with file:line evidence
- S1 traces an attacker-supplied ?labels=<script> value end to end and names where it stops being dangerous
- S2 states definitively whether a __proto__ key in the query string can pollute Object.prototype, citing how the result object is built
- S3 states whether the oversized-array cost is paid before the 50-item cap applies
- S5 gives a plain judgement on internal user IDs appearing in shareable URLs, including whether server-side authorization is unaffected
- Findings are ranked by severity with concrete remediation, and no finding is manufactured to pad the report
- No source file was modified
- files_written contains exactly one path, security_review.md
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
    "verdicts": {
      "type": "object",
      "description": "S1..S7 mapped to a one-line verdict"
    },
    "critical": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "high": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "medium": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "prototype_pollution_possible": {
      "type": "boolean"
    },
    "unbounded_input_before_cap": {
      "type": "boolean",
      "description": "true if a hostile oversized array is fully materialised or walked before the 50-item cap applies"
    },
    "off_limits_violations": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "files_written": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "artifact_path",
    "verdicts",
    "critical",
    "high",
    "medium",
    "prototype_pollution_possible",
    "unbounded_input_before_cap",
    "off_limits_violations",
    "files_written"
  ]
}
```