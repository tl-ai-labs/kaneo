# Stack profile — learned from repo scan

## Language & runtime

TypeScript ESM on Node.js 20.19+, managed with pnpm 10.32.1 and Turborepo. The web app uses React 19, Vite, and Vitest.

## Framework

React/Vite frontend with Hono API and Drizzle/PostgreSQL persistence.

## Conventions detected

### File naming

- Web source files use kebab-case, such as `column-header.tsx` and `task-labels.test.tsx`.
- React components and props types use PascalCase.

### Component shape

```tsx
type ColumnHeaderProps = {
  column: ProjectWithTasks["columns"][number];
};

export function ColumnHeader({ column }: ColumnHeaderProps) {
  const { t } = useTranslation();
```

Imports use ESM, `@/` aliases for web app modules, and relative imports for adjacent modules.

### Test shape

```tsx
describe("TaskLabels", () => {
  it("renders labels supplied by the task", () => {
    render(<TaskLabels labels={[{ id: "label-1", name: "Bug", color: "red" }]} />);
    expect(screen.getByText("Bug")).toBeVisible();
  });
});
```

Tests use Vitest and Testing Library, with explicit cleanup where needed.

### Config

Runtime configuration is environment-driven. This documentation-only run must not edit or inspect environment values.

### Data layer

The API defines PostgreSQL tables with Drizzle in `apps/api/src/database/schema.ts`.

### Framework-owned wiring

The web app bootstraps providers and TanStack Router in `apps/web/src/main.tsx`. This README-only job requires no framework wiring.

## Sample files inspected

- `apps/web/src/components/kanban-board/column/column-header.tsx` (component)
- `apps/web/src/components/kanban-board/task-labels.test.tsx` (test)
- `apps/web/src/main.tsx` (entry point)
- `apps/web/src/env.test.ts` (configuration test)
- `apps/api/src/database/schema.ts` (data layer)

## Notes for downstream codegen

- Preserve the README's concise, product-oriented voice.
- Limit product edits to `README.md`; no application wiring or translation changes apply.
