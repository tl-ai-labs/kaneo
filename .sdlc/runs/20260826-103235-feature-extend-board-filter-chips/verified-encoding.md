# VERIFIED: how this app's router actually encodes and parses search params

Method: `apps/web/src/main.tsx` calls `createRouter({ routeTree, defaultPreload, ... })` with
**no `parseSearch` and no `stringifySearch` override**, so the TanStack defaults apply. Those
defaults were then executed directly against the installed build
(`node_modules/.pnpm/@tanstack+router-core@1.171.20/.../dist/esm/searchParams.js`):

    defaultParseSearch     = parseSearchWith(JSON.parse)
    defaultStringifySearch = stringifySearchWith(JSON.stringify, JSON.parse)

These are measured outputs, not inferences. Do not re-derive them; do not contradict them.

## PARSE (URL -> object)

| input                                          | parsed result                          |
|---|---|
| `?status=todo`                                 | `{ status: "todo" }`  ← a STRING, not an array |
| `?status=todo&status=review`                   | `{ status: ["todo","review"] }` ← repeated keys DO parse to an array |
| `?status=["todo","review"]`                    | `{ status: ["todo","review"] }` ← JSON array parses |
| `?status=`                                     | `{ status: "" }`      ← empty STRING |
| `?status=&priority=`                           | `{ status: "", priority: "" }` |
| `?status=%20`                                  | `{ status: " " }`     ← whitespace string |
| `?status=todo,review`                          | `{ status: "todo,review" }` ← ONE string; no comma splitting anywhere |
| `?taskId=abc&status=todo&status=review&labels=l1&labels=l2` | `{ taskId:"abc", status:["todo","review"], labels:["l1","l2"] }` |

Nothing above throws. `parseSearchWith` wraps `JSON.parse` in try/catch and leaves the raw string
on failure.

## STRINGIFY (object -> URL)

| input object | emitted query string |
|---|---|
| `{ status:["todo","review"] }` | `?status=%5B%22todo%22%2C%22review%22%5D`  (i.e. `?status=["todo","review"]`) |
| `{ status:["todo"] }`          | `?status=%5B%22todo%22%5D` |
| `{ taskId:"abc", status:["todo"], labels:["l1","l2"] }` | `?taskId=abc&status=%5B%22todo%22%5D&labels=%5B%22l1%22%2C%22l2%22%5D` |
| `{ taskId:"abc" }`             | `?taskId=abc` |
| `{}`                           | `""`  ← empty string, so a filter-free board has a genuinely clean URL for free |
| `{ status: undefined, taskId:"abc" }` | `?taskId=abc` ← undefined keys are dropped, not emitted as `status=` |

## ROUND-TRIP IDENTITY

    { status:["todo","review"], priority:["high"], assignee:["u,1"],
      dueDate:["dueThisWeek"], labels:["l1","l2"] }
      -> ?status=%5B...%5D&priority=...&assignee=%5B%22u%2C1%22%5D&...
      -> back to an OBJECT DEEP-EQUAL TO THE INPUT.   identity: TRUE

Note `assignee: ["u,1"]` — a value CONTAINING A COMMA survives intact. JSON array encoding has no
comma-splitting hole.

## CONSEQUENCES THAT ARE NOW SETTLED

1. **The app CANNOT emit repeated keys.** `stringifySearch` JSON-encodes arrays. Emitting
   `?status=todo&status=review` would require overriding `stringifySearch` on `createRouter` in
   `apps/web/src/main.tsx`, which is OFF-LIMITS for this run. So: emission is the router's native
   JSON array form, and that is not a choice this ticket gets to make.
2. **Accepting repeated keys is free** and costs nothing to support — the parser already produces
   an array for them. Inbound tolerance is therefore: JSON array, OR repeated keys, OR a bare
   single string (`?status=todo` -> `["todo"]`).
3. **The comma fallback is DROPPED.** `?status=todo,review` parses to the single string
   `"todo,review"`, and splitting it would create exactly the round-trip hole that JSON encoding
   does not have. Treat it as one opaque value.
4. **Clean URL is free.** `{}` stringifies to `""`, and `undefined`-valued keys are dropped
   rather than emitted as `?status=`. So "no active filters -> no filter keys" needs only that the
   encoder omit inactive keys (set them `undefined`), not any special casing.
5. **The empty-param predicate MUST run on normalized values, never on key presence.**
   `?status=` yields `{ status: "" }` — the key IS present. `?status=%20` yields `{ status: " " }`.
   Both must normalize to "no filter".
6. **A single-value param arrives as a bare string, not an array.** `?status=todo` ->
   `{ status: "todo" }`. Any parser that assumes `Array.isArray` will silently drop it.
