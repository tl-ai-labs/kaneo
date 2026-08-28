## Change summary (3-5 lines)
Extract the column header markup and styling from `kanban-view.tsx` into a new dedicated presentational component `PublicColumnHeader` in `apps/web/src/components/public-project/public-column-header.tsx`.
The new component accepts a single `column` prop typed as `ProjectWithTasks["columns"][number]` and encapsulates the header container and its nested title, icon, and task count elements.
`kanban-view.tsx` replaces the inline JSX with `<PublicColumnHeader column={column} />` while retaining its `getColumnIcon` import for empty-state rendering.

## Target file 1 — public-column-header.tsx (new)
```tsx
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";

type PublicColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function PublicColumnHeader({ column }: PublicColumnHeaderProps) {
  return (
    <div className="p-2 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getColumnIcon(column.id, column.isFinal, column.icon)}
          <h3 className="font-medium text-foreground">{column.name}</h3>
          <span className="text-sm text-muted-foreground">
            {column.tasks.length}
          </span>
        </div>
      </div>
    </div>
  );
}
```

## Target file 2 — kanban-view.tsx (edit)
- **Import changes**: Add `import { PublicColumnHeader } from "./public-column-header";` to the imports at the top. The existing import `import { getColumnIcon } from "@/lib/column";` must **STAY** because it is still required by the empty-column state on line 57 (`{getColumnIcon(column.id, column.isFinal, column.icon)}`).
- **JSX replacement**: In `PublicKanbanView`, remove lines 27–39:
```tsx
                <div className="p-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getColumnIcon(column.id, column.isFinal, column.icon)}
                      <h3 className="font-medium text-foreground">
                        {column.name}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {column.tasks.length}
                      </span>
                    </div>
                  </div>
                </div>
```
and replace with:
```tsx
                <PublicColumnHeader column={column} />
```

## DOM invariant proof
Ordered comparison from outermost to innermost element:
1. **Outer container `<div>`**
   - Before: `<div className="p-2 shrink-0">`
   - After: `<div className="p-2 shrink-0">`
2. **Row container `<div>`**
   - Before: `<div className="flex items-center justify-between">`
   - After: `<div className="flex items-center justify-between">`
3. **Content group `<div>`**
   - Before: `<div className="flex items-center gap-2">`
   - After: `<div className="flex items-center gap-2">`
4. **Column Icon**
   - Before: `{getColumnIcon(column.id, column.isFinal, column.icon)}`
   - After: `{getColumnIcon(column.id, column.isFinal, column.icon)}`
5. **Column Name Heading `<h3>`**
   - Before: `<h3 className="font-medium text-foreground">{column.name}</h3>`
   - After: `<h3 className="font-medium text-foreground">{column.name}</h3>`
6. **Task Count `<span>`**
   - Before: `<span className="text-sm text-muted-foreground">{column.tasks.length}</span>`
   - After: `<span className="text-sm text-muted-foreground">{column.tasks.length}</span>`

All tag names, hierarchy, attributes, classes, and dynamic expressions match byte-for-byte.

## Whitespace/reflow note
When moved to `public-column-header.tsx`, the `<h3 className="font-medium text-foreground">` element and its text `{column.name}` collapse from 3 indented lines to a single line `<h3 className="font-medium text-foreground">{column.name}</h3>` under Biome line-length rules. Because React/JSX collapses whitespace around expression children, this formatting difference produces byte-identical rendered DOM text with zero reflow or visual variance.

## Test plan
A dedicated unit test for `PublicColumnHeader` is not recommended beyond typechecking and existing suite verification because the extracted component is a pure presentational leaf without internal state, conditional branches, or private side effects; TypeScript strictly verifies the `column` shape at compile time.

## Risks and rollback
- **Risks**: Extremely low. The refactor is purely structural with zero behavior or style alterations and does not introduce private board dependencies.
- **Rollback**: Revert `kanban-view.tsx` to restore inline JSX and delete `apps/web/src/components/public-project/public-column-header.tsx`.