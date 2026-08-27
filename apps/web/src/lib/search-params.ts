// WHY: nine navigate() call sites on the board route previously replaced
// the whole search object with a literal, silently dropping filter
// params. This is the single seam that preserves them.
export function withTaskId(taskId: string | undefined) {
  return <T extends Record<string, unknown>>(prev: T) => ({ ...prev, taskId });
}
