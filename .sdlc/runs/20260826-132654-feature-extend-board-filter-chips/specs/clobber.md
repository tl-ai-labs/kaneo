### 8.3 AC-2 / FR-15 — proving the clobber cannot happen

`never commits the default filter set before URL or storage is resolved`, in E3:

> **CORRECTION applied by the orchestrator after the architect delivered this plan.** The original
> §8.3 asserted `result.all[0]`. **`result.all` does not exist** in `@testing-library/react`
> — verified against the installed version, `16.3.2`, whose `RenderHookResult.result` is typed as
> `{ current: Result }` and nothing else. `result.all` belongs to the deprecated
> `@testing-library/react-hooks`, which is **not** installed in this repo. As written the test would
> not have compiled. The recorder below is the corrected form; it is equivalent in intent and
> strictly stronger, because it captures *every* commit rather than only the first.

```ts
// seed localStorage["kaneo:board-filters:project-1"] = {"labels":["label-bug"]}
const renders: BoardFilters[] = [];
renderHook(() => {
  const r = useTaskFiltersWithLabelsSupport(project, "project-1");
  renders.push(r.filters);          // record EVERY commit, in order
  return r;
});
expect(renders[0].labels).toEqual(["label-bug"]);        // FIRST commit — no waitFor
expect(renders.some((f) => f.labels === null)).toBe(false); // DEFAULT_FILTERS never committed
expect(JSON.parse(localStorage.getItem(key)).labels).toEqual(["label-bug"]);
```

Asserting `renders[0]` — the very first rendered value — is what makes this a structural claim rather
than an ordering claim. It is RED against a `useState(DEFAULT_FILTERS)` implementation no matter how
the effects are ordered: that implementation commits `DEFAULT_FILTERS` first, so `renders[0].labels`
is `null`. The second assertion is the sharper one — it forbids a `DEFAULT_FILTERS` commit at *any*
point in the mount sequence, which is exactly the FR-15 guarantee.

**This recorder pattern is mandatory for every "first commit" assertion in this run.** Any packet
instruction that reaches for `result.all` is wrong; `result.current` (latest only) and the recorder
above are the two available shapes.

`applies URL filters over stored filters and writes them back to storage` (AC-2): seed storage with
`{"labels":["label-bug"]}`, render with
`urlState = { filters: parseBoardFilterSearch({ status: "todo" }), carriesFilters: true }`; assert
`renders[0]` (same recorder pattern) is `{ status: ["todo"], priority: null, assignee: null, dueDate: null, labels: null }`
— the URL wins *whole*, it does not merge with stored facets — and then `await waitFor` that
`localStorage` holds `{"status":["todo"],…}` (FR-14).