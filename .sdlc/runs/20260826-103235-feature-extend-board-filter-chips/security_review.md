# Security Review: Board Filter URL Parameters & Chips

**Target:** `board-filters` (`apps/web`)  
**Run:** `20260826-103235-feature-extend-board-filter-chips`  
**Reviewer:** Security Staff Reviewer  
**Scope:** Client-side brownfield changes only (`apps/web/src/lib/board-filter-params.ts`, `apps/web/src/hooks/use-task-filters-with-labels-support.ts`, `apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`, `apps/web/src/components/{kanban-board,list-view}/*`)  
**Overall Verdict:** **PASSED** — Low / Informational Security Risk. Client-side URL filter parameterization introduces no authentication bypass, no prototype pollution, no HTML injection / XSS, and no unauthorized data disclosure.

---

## Executive Summary

The evaluated change enables bidirectional synchronization of board filters (status, priority, assignee, dueDate, labels) between React component state, `localStorage`, and URL search parameters managed via TanStack Router.

Because filter values are now parsed from attacker-controllable URL query strings, this review analyzes untrusted input handling across rendering pathways, prototype pollution risks, resource exhaustion vectors, route denial-of-service resilience, link privacy / authorization boundaries, and `localStorage` persistence safety.

The security assessment confirms that the client-side changes adhere to secure design patterns:
1. Inputs are parsed strictly via whitelist keys and coerced into primitive string arrays.
2. Filter values are never evaluated as executable code, never injected into raw HTML / `dangerouslySetInnerHTML`, and never used to construct unescaped DOM sinks or network request URLs.
3. Server-side authorization remains the sole authority for data access; user IDs and label IDs in URLs grant zero access to unauthenticated or unauthorized actors.
4. Input arrays are capped at 50 elements per dimension, and route validation is guarded by never-throw exception handling.

---

## Security Invariants & Detailed Assessment (S1 – S7)

### S1: Untrusted Input Reaching Render

* **Verdict:** **SAFE** (Zero XSS / HTML Injection vectors)
* **Evidence:** [`board-filter-params.ts:22-45`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L22-L45), [`use-task-filters-with-labels-support.ts:149-261`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L149-L261), [`board-toolbar.tsx:534-643`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx#L534-L643)

#### End-to-End Attack Trace (`?labels=<script>alert(1)</script>`)
1. **Ingress:** TanStack Router parses the query string and passes `{ labels: "<script>alert(1)</script>" }` or `{ labels: ["<script>alert(1)</script>"] }` to `Route.validateSearch` in [`board.tsx:34`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L34).
2. **Sanitization / Normalization:** `validateBoardSearch` calls `parseFilterParam` in [`board-filter-params.ts:22-45`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L22-L45), trimming whitespace and returning `["<script>alert(1)</script>"]`.
3. **State Ingestion:** `useTaskFiltersWithLabelsSupport` in [`use-task-filters-with-labels-support.ts:60-63`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L60-L63) populates `filters.labels = ["<script>alert(1)</script>"]`.
4. **Task Filtering Logic:** In [`use-task-filters-with-labels-support.ts:244-255`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L244-L255), `filters.labels.some((labelId) => taskLabelIds.includes(labelId))` executes exact string equality against workspace task label UUIDs. Because no task has ID `"<script>alert(1)</script>"`, the comparison returns `false`. It is treated solely as an opaque string operand in memory.
5. **UI Rendering:**
   - In [`board-toolbar.tsx:634-643`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx#L634-L643), the label filter chip displays `t("tasks:boardFilters.selectedCount", { count: filters.labels.length })`. The raw string value is **never** printed to the DOM for labels.
   - For status and assignee filters ([`board-toolbar.tsx:153-168`](file:///home/sangeetha/projects/kaneo/apps/web/src/components/board/board-toolbar.tsx#L153-L168)), single-item chips look up entity names from workspace data (`project.columns` or `users.members`). If a fallback to raw ID occurs (such as in `getStatusDisplayName`), the string is rendered within standard React JSX text nodes (`<span>{...}</span>`).
6. **Point Where Danger Ceases:** The input stops being dangerous immediately upon receipt: React JSX automatically encodes all text children (replacing `<`, `>`, `&`, `"`, `'` with safe character entities), and no filter value is ever passed to `dangerouslySetInnerHTML`, `eval()`, `Function()`, `document.write()`, dynamic `script` tags, or `javascript:` URI attributes.

---

### S2: Prototype Pollution

* **Verdict:** **SAFE** (Zero Prototype Pollution paths)
* **Evidence:** [`board-filter-params.ts:12-18, 47-76`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L12-L18)

#### Key Iteration & Target Construction Analysis
1. `validateBoardSearch` creates a fresh, empty literal `const result: BoardSearchParams = {}` ([line 55](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L55)).
2. The function does **NOT** iterate over the keys of the input `search` object (it never uses `for..in`, `Object.keys()`, `Object.entries()`, or recursive deep-merge algorithms).
3. It only accesses statically declared, whitelisted keys:
   - `search.taskId` ([line 57](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L57))
   - `search[key]` where `key` is strictly constrained to the fixed const tuple `FILTER_KEYS = ["status", "priority", "assignee", "dueDate", "labels"]` ([lines 12-18, 65](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L12-L18)).
4. Assignment targets are strictly `result.taskId` and `result[key]`.
5. If an attacker injects `__proto__`, `constructor`, or `prototype` into the query string, those keys are never accessed or assigned. `Object.prototype` cannot be polluted.

---

### S3: Resource Exhaustion & Algorithmic Complexity

* **Verdict:** **LOW RISK / BOUNDED** (Unbounded input parsed by router prior to 50-item cap; post-validation processing is linear and strictly bounded)
* **Evidence:** [`board-filter-params.ts:20-36`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L20-L36), [`use-task-filters-with-labels-support.ts:153-258`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L153-L258)

#### Array Cap & Pre-Cap Ingestion Cost
- **Cap Mechanism:** `parseFilterParam` ([`board-filter-params.ts:23-36`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L23-L36)) enforces `MAX_ARRAY_LENGTH = 50`.
- **Pre-Cap Walk Cost:**
  - TanStack Router utilizes `JSON.parse` (`defaultParseSearch`) before `validateBoardSearch` is invoked. If an attacker passes `?labels=["a","b",...]` with 100,000 elements, the router allocates the 100k array in client heap memory before `validateBoardSearch` runs.
  - `parseFilterParam` walks the input array using a `for (const item of value)` loop. If the array contains 100,000 non-strings or whitespace items, `cleaned.length` never reaches 50, causing the loop to walk all $10^5$ items before returning.
  - However, browser URL length limits (typically 2 KB – 64 KB across mainstream browsers/proxies) place an external ceiling on query string size in real-world scenarios.
- **Downstream Filter Complexity:**
  - Filtering operates over client-cached project tasks in `filterTasks` ([`use-task-filters-with-labels-support.ts:153-258`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L153-L258)).
  - For $N$ tasks:
    - Status / Priority / Assignee: `.includes(...)` over capped $\le 50$ item arrays $\rightarrow O(50 \cdot N) = O(N)$.
    - Labels: `filters.labels.some(id => taskLabelIds.includes(id))` where `filters.labels` has $\le 50$ items and `taskLabelIds` has $L$ items (typically $L < 10$) $\rightarrow O(50 \cdot L \cdot N) = O(N)$.
  - There are no nested quadratic loops over attacker-sized data, and no regular expressions are evaluated against filter values.

---

### S4: Never-Throw as a Security Property (DoS Resilience)

* **Verdict:** **SAFE** (Robust fail-safe behavior; zero uncaught exceptions on hostile shapes)
* **Evidence:** [`board-filter-params.ts:50-75, 81-108, 113-143, 148-167`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L50-L75), [`board-filter-params.test.ts:54-79`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.test.ts#L54-L79)

#### Robustness Analysis
- In TanStack Router, an uncaught exception in `validateSearch` crashes route resolution, triggering an unhandled error boundary and denying user access to the board.
- `validateBoardSearch` wraps all parsing in `try { ... } catch { return {}; }` and incorporates explicit runtime defensive type guards:
  - `!search || typeof search !== "object"`
  - `typeof rawTaskId === "string"`
  - `Array.isArray(value)`
  - `typeof item === "string"`
- **Catch Block Behavior:** The catch block falls back to `{}` (an empty/unfiltered search params object). This fail-safe fallback is appropriate for search parameter validation: malformed parameters should be discarded rather than breaking page navigation.
- Comprehensive unit tests in [`board-filter-params.test.ts:54-79`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.test.ts#L54-L79) confirm that primitives (`null`, `undefined`, numbers, strings, booleans), arrays, malformed objects, objects with broken `toString`, and deep cyclical-like objects do not throw.

---

### S5: Privacy of Shareable Links & Authorization Boundaries

* **Verdict:** **ACCEPTABLE / RESIDUAL EXPOSURE ONLY** (Opaque entity IDs exposed in URL share vectors; server-side authentication and authorization remain completely unaffected)
* **Evidence:** [`board.tsx:28-30`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L28-L30), [`apps/web/src/hooks/queries/task/use-get-tasks.ts`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/queries/task/use-get-tasks.ts)

#### Link Privacy Analysis
- **URL Contents:**
  - `assignee`: Internal user IDs (e.g. `?assignee=["usr_123"]`).
  - `labels`: Internal label IDs (e.g. `?labels=["lbl_456"]`).
  - `status`: Column UUIDs (e.g. `?status=["col_789"]`).
- **Exposure Vectors:** Shared links shared in chat/email, browser history, server/proxy access logs, and HTTP `Referer` headers.
- **Access Control & Authorization Invariants:**
  - The board route resides under `_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx`.
  - Kaneo API endpoints (`/api/projects/:id/tasks`, `/api/workspaces/:id/users`) enforce session authentication and workspace membership authorization on every request.
  - A recipient lacking workspace access who opens a link receives a 401/403 or redirect to login. No task data, user profiles, names, email addresses, or workspace contents are exposed to unauthorized users.
  - The IDs themselves are opaque database identifiers; possession of an ID alone grants zero authorization or capability in the API.
- **Residual Exposure:** External observers who inspect shared URLs can see opaque user and label IDs. This is industry standard for URL-stateful collaborative tools (e.g., GitHub, Jira, Linear) and represents minimal residual exposure.

---

### S6: LocalStorage Persistence & Storage Safety

* **Verdict:** **SAFE** (Bounded storage size; no sensitive data persisted; intended project-scoped overwrite)
* **Evidence:** [`use-task-filters-with-labels-support.ts:56, 95-99`](file:///home/sangeetha/projects/kaneo/apps/web/src/hooks/use-task-filters-with-labels-support.ts#L56)

#### Persistence Analysis
- **Storage Target:** `window.localStorage.setItem('kaneo:board-filters:${projectId}', JSON.stringify(filters))`.
- **Overwrite Behavior:** Opening a link with active filters overwrites stored filters for that specific `projectId`. This is the user-confirmed intended behavior to align board views with shared link contexts.
- **Sensitivity of Data:** Persisted data contains only filter criteria (arrays of column IDs, priority strings, user IDs, date range presets, label IDs). No auth tokens, credentials, or private message bodies are stored.
- **Storage Limit & Quota Protection:** Because `filters` is derived from `validateBoardSearch` which enforces `MAX_ARRAY_LENGTH = 50` for each of the 5 keys, the stored JSON string is strictly bounded to $< 5\text{ KB}$ per project. A hostile link cannot exhaust the victim's browser `localStorage` quota ($5\text{ MB} - 10\text{ MB}$).

---

### S7: Secrets, Integrity & Scope Boundaries

* **Verdict:** **CLEAN** (Zero secrets introduced; all off-limits modules untouched)
* **Evidence:** `git diff --name-only`

#### Verification of Scope & Off-Limits Paths
- **Off-Limits Files Check:**
  - `apps/api/**` — **UNTOUCHED**
  - `.env*` — **UNTOUCHED**
  - `apps/web/src/main.tsx` — **UNTOUCHED**
  - `apps/web/src/routeTree.gen.ts` — **UNTOUCHED**
  - `apps/web/src/store/user-preferences.ts` — **UNTOUCHED**
  - `apps/web/src/i18n/**` — **UNTOUCHED**
- **Secrets Audit:** No API keys, credentials, tokens, or sensitive constants were introduced in any file.

---

## Findings Summary & Remediation

| ID | Title | Severity | Location | Remediation / Recommendation |
|---|---|---|---|---|
| **SEC-01** | Large JSON Array Ingestion before 50-Item Cap | **Low** | [`board-filter-params.ts:23-33`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L23-L33) | In `parseFilterParam`, slice the input array before iterating (e.g. `const slice = value.slice(0, MAX_ARRAY_LENGTH * 2);`) to short-circuit iteration when hostile non-string arrays are supplied. |
| **SEC-02** | Opaque User IDs in Shareable URLs | **Informational** | [`board-filter-params.ts:15`](file:///home/sangeetha/projects/kaneo/apps/web/src/lib/board-filter-params.ts#L15), [`board.tsx:34`](file:///home/sangeetha/projects/kaneo/apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx#L34) | Maintain existing strict API authentication and workspace-membership authorization on all workspace/task data endpoints. Verify that `Referrer-Policy: strict-origin-when-cross-origin` or `same-origin` is configured in production HTTP headers. |

---

## Conclusion

The brownfield board filter URL parameterization changes meet all security requirements. The implementation introduces no exploitable vulnerabilities, enforces strict type and length bounds, preserves backend authorization invariants, and does not compromise user privacy or application stability.
