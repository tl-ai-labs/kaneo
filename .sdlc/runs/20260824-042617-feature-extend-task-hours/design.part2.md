## Part 2 — Web delta layer

This part covers the web data layer and the task-editing surfaces only. Column-header rollup rendering, i18n string definitions, and the test plan are Part 3.

### 4.0 Correction to requirements.md §7 (R-7)

R-7 recorded two write-contract gaps. Both are factually wrong against `.sdlc/local/write-contract.json` and are corrected here; the design proceeds on the corrected facts, and no operator action is required for either.

- **G-1 is FALSE.** The contract does not hold a `create-task-modal/**` directory pattern. It lists the literal file `apps/web/src/components/shared/modals/create-task-modal.tsx` (and its `.test.tsx` sibling). The modal **is** writable.
- **G-2 is FALSE.** `apps/web/src/fetchers/task/**` **is** allowlisted as a whole-directory glob, so new fetcher files are permitted. The dedicated single-field fetcher on the `update-task-due-date` pattern is therefore *available*; §4.1 rejects it on the merits, not on contract grounds.

### 4.1 DR-4 — which editing surfaces expose `estimatedHours`

| # | Candidate | Decision | Reason |
|---|---|---|---|
| 1 | `components/shared/modals/create-task-modal.tsx` | **IN** | The only create path, and the draft-promotion path is the only way a pasted-image task reaches its final field values. A field absent here can never be set at creation. Writable (literal file). |
| 2 | `components/task/task-properties-sidebar.tsx` | **IN** (both layout branches) | The task-detail properties rail is the canonical edit-after-create surface for every other optional field. Writable under `components/task/**`. |
| 3 | New `components/task/task-estimated-hours-popover.tsx` | **IN** (new file) | Follows the `task-due-date-popover` structural idiom: popover + permission gate + toast. Writable under `components/task/**`, new files permitted. |
| 3b | New dedicated fetcher + hook + `PUT /estimated-hours/:id` | **OUT** | Requirements §2 item 8 puts a new dedicated endpoint out of scope, and Part 1 added the field to the existing full-PUT route only. A dedicated fetcher with no dedicated endpoint would be a wrapper around the same full PUT — cost without benefit. The popover therefore calls the existing `useUpdateTask`. |
| 4 | Kanban card (`components/kanban-board/...`) | **OUT** | Display-only surface, not an editing surface. `column-dropzone.tsx` is explicitly off-limits; nothing in this part touches drop behaviour. |
| 5 | List / table view | **OUT** | Not in the allowlist, and inline-editing a numeric cell is a separate interaction problem. Values set elsewhere still render there once the field is on the query response. |

**Cost of routing the sidebar edit through the full PUT.** `update-task.ts` sends a fixed body (`userId`, `title`, `description`, `status`, `priority`, `startDate`, `dueDate`, `position`, `projectId`). Editing one number therefore re-sends eight other fields, re-applies the `priority || "no-priority"` coercion, and publishes `task.updated` with a full-update payload. Accepted: it is the same body drag-and-drop already sends on every card move, so the blast radius is not new. The mitigation is that the popover spreads the whole cached `Task` (`{ ...task, estimatedHours: value }`) so no field is silently narrowed.

**Permission gating.** Sidebar/popover gate on `canUpdateTasks()`; the modal gates on `canCreateTasks()`. Both come from `useWorkspacePermission`. No new permission action, no change to `@kaneo/permissions`.

**i18n keys relied on** (strings defined in Part 3): `common:modals.createTask.estimatedHours`, `tasks:properties.estimatedHours`, `tasks:properties.noEstimate`, `tasks:popover.estimatedHours.placeholder`, `tasks:popover.estimatedHours.clear`, `tasks:popover.estimatedHours.updateSuccess`, `tasks:popover.estimatedHours.updateError`.

### 4.2 Web `Task` type

**File:** `apps/web/src/types/task/index.ts` — **anchor:** the `dueDate` line inside `type Task`.

```ts
  startDate: string | null;
  dueDate: string | null;
  // Whole hours, 0..1000. null = not estimated; 0 = estimated at nothing.
  // Optional because cached/partial tasks predate the field: `undefined`
  // means "unknown, do not write" (DR-5), never "clear".
  estimatedHours?: number | null;
  position: number | null;
```

`?: number | null` is deliberate and load-bearing. `ProjectWithTasks` overrides `columns[].tasks` with this hand-written type, so typecheck cannot prove the server actually selects the column — the field being present in the type is *not* evidence the board query returns it. Part 3's rollup test is the real proof.

### 4.3 Fetchers

#### 4.3a `apps/web/src/fetchers/task/create-task.ts`

**Anchor:** the `priority` parameter and the `json` object.

```ts
async function createTask(
  title: string,
  description: string,
  projectId: string,
  userId: string | undefined,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  priority: CreateTaskRequest["priority"],
  estimatedHours?: number | null,
) {
  if (!projectId) throw new Error("No project selected for task creation");
  const response = await client.task[":projectId"].$post({
    json: {
      title,
      description,
      ...(userId ? { userId } : {}),
      status,
      startDate: startDate?.toISOString() || undefined,
      dueDate: dueDate?.toISOString() || undefined,
      priority,
      // DR-5 tri-state: omit when undefined so the server default applies.
      // `0` must survive, so this is an === check, never `||`.
      ...(estimatedHours === undefined ? {} : { estimatedHours }),
    },
    param: { projectId },
  });
```

Appended as a trailing optional 9th positional arg rather than converting to an options object: `use-create-task` is the only caller, and an object refactor would widen the diff past the ticket. `CreateTaskRequest` is inferred from the Hono client, so it already carries Part 1's validator field with no edit.

#### 4.3b `apps/web/src/fetchers/task/update-task.ts`

**Anchor:** the `dueDate` / `position` lines in the `json` body.

```ts
      startDate: task.startDate?.toString(),
      dueDate: task.dueDate?.toString(),
      // DR-5: `undefined` (task from a cache entry that predates the field,
      // e.g. a drag-and-drop payload) omits the key so the stored value is
      // preserved; explicit `null` clears; a number sets. `?? null` would be
      // wrong here — it would silently clear on every drag.
      ...(task.estimatedHours === undefined
        ? {}
        : { estimatedHours: task.estimatedHours }),
      position: task.position ?? 0,
```

This is the single most failure-prone hunk in Part 2. `update-task.ts` is the body used by drag-and-drop and by column-header archive-all, both of which hand it a `Task` read straight out of the board cache. If that cache was populated before the field existed, or by any code path that constructs a partial task, `estimatedHours` is `undefined` — and the omit branch is what stops a card move from wiping an estimate.

### 4.4 Mutation hooks and cache invalidation

#### 4.4a `apps/web/src/hooks/mutations/task/use-create-task.ts`

**Anchor:** the whole `mutationFn`. The existing hook destructures a fixed field list out of `CreateTaskRequest` and re-passes positionally, so a new inferred field is dropped on the floor unless added in **both** places.

```ts
    mutationFn: ({
      title,
      description,
      userId,
      projectId,
      status,
      startDate,
      dueDate,
      priority,
      estimatedHours,
    }: CreateTaskRequest) =>
      createTask(
        title,
        description,
        projectId,
        userId,
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        priority,
        estimatedHours,
      ),
```

#### 4.4b `apps/web/src/hooks/mutations/task/use-update-task.ts`

**No change.** It takes a whole `Task` and forwards it to `updateTask`, so the field rides along through §4.3b.

#### 4.4c Invalidation — confirmed, not assumed

The rollup is client-side (DR-1): the header sums `column.tasks[].estimatedHours` off the board query, whose key is `["tasks", projectId]`.

- `useCreateTask.onSuccess` already invalidates `["tasks", variables.projectId]`. A created task with an estimate refreshes the board, so the new task enters the sum. OK
- `useUpdateTask.onSuccess` already invalidates `["task", variables.id]` **and** `["tasks", variables.projectId]`. The sidebar popover and the draft-promotion path both go through this hook, so an edited estimate refreshes both the detail view and the board sum. OK
- Draft promotion passes `projectId: resolvedProjectId` in the update body, so `variables.projectId` is populated and the invalidation is not a no-op. OK

No new query key and no new invalidation call is needed. Realtime is likewise unchanged: `create-task` publishes `task.created` and `update-task` publishes `task.updated`, and the WebSocket handler invalidates the same board key, so a peer's estimate change re-sums the header without extra wiring.

### 4.5 Shared input + sidebar popover (new files)

**New file:** `apps/web/src/components/task/estimated-hours-input.tsx` — one place for the DR-2/DR-3 parse so the modal and the popover cannot drift.

```tsx
// Returns null for an empty field (not estimated) and undefined for input
// that is not a whole number in 0..1000 — callers must not write undefined.
export function parseEstimatedHours(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isInteger(value) && value >= 0 && value <= 1000
    ? value
    : undefined;
}

export function EstimatedHoursInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
}) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState(value === null ? "" : String(value));
  const parsed = parseEstimatedHours(raw);
  return (
    <div className="p-2 space-y-2">
      <Input
        type="number"
        min={0}
        max={1000}
        step={1}
        inputMode="numeric"
        value={raw}
        placeholder={t("tasks:popover.estimatedHours.placeholder")}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => parsed !== undefined && onCommit(parsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && parsed !== undefined) {
            e.preventDefault();
            onCommit(parsed);
          }
        }}
      />
      {value !== null && (
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground" onClick={() => onCommit(null)}>
          <X className="h-4 w-4" />
          {t("tasks:popover.estimatedHours.clear")}
        </Button>
      )}
    </div>
  );
}
```

Client parsing is a convenience, not the authority: DR-3 is enforced by Valibot and the API answers 400. An out-of-range value simply does not commit.

**New file:** `apps/web/src/components/task/task-estimated-hours-popover.tsx` — mirrors `task-due-date-popover.tsx` exactly, including the bare-children escape when `!canEdit`.

```tsx
export default function TaskEstimatedHoursPopover({ task, children }: { task: Task; children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();

  const handleCommit = async (next: number | null) => {
    try {
      // Spread the whole task: the full PUT body reads other fields off it.
      await updateTask({ ...task, estimatedHours: next });
      toast.success(t("tasks:popover.estimatedHours.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tasks:popover.estimatedHours.updateError"));
    }
  };

  if (!canUpdateTasks()) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="start">
        <EstimatedHoursInput value={task.estimatedHours ?? null} onCommit={handleCommit} />
      </PopoverContent>
    </Popover>
  );
}
```

**File:** `apps/web/src/components/task/task-properties-sidebar.tsx` — **anchor:** immediately after the `<TaskDueDatePopover>` block. Insert this in **both** render paths (the wide branch around lines 146-330 *and* the narrow branch around 337-460); a field added to one branch is invisible in the other.

```tsx
<TaskEstimatedHoursPopover task={task}>
  <button type="button" className={/* copy the sibling due-date trigger's className */ ""}>
    <Clock className="w-3.5 h-3.5" />
    <span>
      {task.estimatedHours === null || task.estimatedHours === undefined
        ? t("tasks:properties.noEstimate")
        : t("tasks:properties.estimatedHours", { count: task.estimatedHours })}
    </span>
  </button>
</TaskEstimatedHoursPopover>
```

The label check is an explicit null/undefined comparison because `0` is a real estimate and must render as "0h", not as "no estimate".

### 4.6 `create-task-modal.tsx`

Six hunks in one file.

**(1) Local state — anchor: after the `dueDate` state, ~line 190.**

```ts
  const [estimatedHours, setEstimatedHours] = useState<number | null>(null);
```

**(2) Reset paths — anchor: the `setPriority("no-priority")` line in the close reset (~line 249) *and* the post-submit reset (~line 441).** Both need it; `createMore` keeps the modal mounted, so a missed reset leaks the previous task's estimate into the next one.

```ts
  setEstimatedHours(null);
```

**(3) `normalizeTask` — anchor: the `dueDate` line, ~line 93.**

```ts
    dueDate: task.dueDate ?? null,
    estimatedHours: task.estimatedHours ?? null,
```

`?? null` is correct *here* (unlike §4.3b): `normalizeTask` produces a complete client-side `Task`, and "the server told us nothing" collapses to "not estimated" for display. `0` survives `??`.

**(4) Draft creation — anchor: the `status: draftStatus,` line, ~line 351.**

```ts
      status: draftStatus,
      ...(estimatedHours === null ? {} : { estimatedHours }),
```

On create there is no stored value to preserve, so omitting on `null` and sending the number otherwise is sufficient and does not depend on whether Part 1's create validator accepts an explicit `null`.

**(5) `handleSubmit` — anchor: both branches, ~lines 390-415.**

Draft-promotion branch, after `projectId: resolvedProjectId,`:

```ts
            projectId: resolvedProjectId,
            // Explicit value, including null: the user may have cleared an
            // estimate that the draft create already persisted.
            estimatedHours,
```

Plain-create branch, after `status: taskStatus,`:

```ts
            status: taskStatus,
            ...(estimatedHours === null ? {} : { estimatedHours }),
```

The asymmetry is DR-5, not an oversight: promotion is an update over an already-persisted draft, so `null` must be sent to clear; creation has nothing to clear, so `null` omits.

**(6) Trigger button — anchor: after the due-date `<Popover>` block, ~line 905.** Same trigger idiom as `dueDate`, gated on create permission.

```tsx
              {canCreateTasks() && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border border-border hover:bg-accent/50", estimatedHours !== null ? "bg-accent/30 text-foreground" : "text-muted-foreground")}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {estimatedHours !== null
                          ? t("tasks:properties.estimatedHours", { count: estimatedHours })
                          : t("common:modals.createTask.estimatedHours")}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-56" align="start">
                    <EstimatedHoursInput value={estimatedHours} onCommit={setEstimatedHours} />
                  </PopoverContent>
                </Popover>
              )}
```

### 4.7 Residual risks carried into Part 3

1. **Typecheck blind spot.** `ProjectWithTasks` overrides `columns[].tasks` with the hand-written `Task`, so adding the field to the type does not prove the board response carries it. Part 3's rollup test must assert against a real board payload.
2. **`undefined` vs `null` at the fetcher boundary.** The one hunk that must not regress is §4.3b's omit branch; a future "simplification" to `task.estimatedHours ?? null` silently clears estimates on drag-and-drop and archive-all.
3. **Two sidebar render paths.** The narrow-layout insertion is easy to miss and produces a field that exists only above a breakpoint.
