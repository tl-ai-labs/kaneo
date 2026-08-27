### A3 — `withTaskId` (exact)

```ts
export function withTaskId(taskId: string | undefined) {
  return <T extends Record<string, unknown>>(prev: T) => ({ ...prev, taskId });
}
```

Call sites read `search: withTaskId(task.id)` and `search: withTaskId(undefined)` — symmetric for
open and close, which is what makes the nine edits mechanical.