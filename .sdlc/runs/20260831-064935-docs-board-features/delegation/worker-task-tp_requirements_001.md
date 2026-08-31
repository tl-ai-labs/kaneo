## Task tp_requirements_001 — requirements_analysis / scoped_requirements
Module: docs
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
You are producing SCOPED documentation requirements for a docs-only change to the Kaneo repo. Scope is FROZEN and not yours to widen: enrich ONLY section '## 5. Use filters to focus' in apps/docs/core/functional/plan-and-execute-tasks.mdx to describe the active-filter-chip UI. No new page, no docs.json edit, no README edit, no code change, no mention of WIP limits or hours rollup.

Use your repo tools to READ and verify against the ACTUAL source on this branch before writing any requirement:
- apps/web/src/components/board/board-toolbar.tsx (ActiveFilterChip component; the five chip render blocks; the clear-all control)
- apps/web/src/hooks/use-task-filters.ts and apps/web/src/hooks/use-task-filters-with-labels-support.ts (check which one the board route actually uses: apps/web/src/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/board.tsx)
- i18n/en-US.json (keys under tasks.boardFilters and common.actions)
- apps/docs/core/functional/plan-and-execute-tasks.mdx (current section 5 and house style)

Every functional requirement you write MUST be a statement that survives being checked against that source. Be precise about: what each chip displays for its value, per-chip vs global clearing, and where the clear-all control physically lives. Do NOT generalize across the five chips if the code does not.

DO NOT WRITE OR EDIT ANY FILE. Return the requirements document as markdown text in your structured output only.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260831-064935-docs-board-features/intent_brief.md
_Included because: Frozen scope and acceptance criteria confirmed by the operator at Gate 0_

```
# Intent Brief — docs — Enrich "Use filters to focus" with active-filter-chip behavior

## Goal
Extend apps/docs/core/functional/plan-and-execute-tasks.mdx section 5 "Use filters to focus" to describe the active-filter-chip UI that exists in code but is undocumented: each active filter renders as a removable chip (ActiveFilterChip, board-toolbar.tsx) with its own clear control, and a "Clear all filters" action appears once any filter is active (i18n key common:actions.clearAllFilters).

## Task type
doc_update

## Files in scope
- apps/docs/core/functional/plan-and-execute-tasks.mdx (edit — extend section 5 only)

## Files off-limits
README.md; apps/docs/docs.json; anything under apps/web/src/**; .claude/**, .cursor/rules/**, AGENTS.md, CLAUDE.md; anything referencing WIP limits or hours rollup.

## Acceptance criteria
1. Section 5 describes: each active filter appears as a removable chip near the toolbar; each chip has its own clear affordance; a "Clear all filters" action appears once any filter is active.
2. The existing five-filter list (Status, Priority, Assignee, Due date, Labels) is preserved, not replaced.
3. No new page created; no docs.json edit.
4. Follows the repo's existing .mdx house style (frontmatter unchanged, heading level and numbering scheme matched, no invented terminology not present in the UI).
5. No claim in the new text is falsifiable against board-toolbar.tsx or the task-filters hook as they exist on this branch.
6. No mention of WIP limits or hours rollup anywhere in the diff.

```

#### apps/docs/core/functional/plan-and-execute-tasks.mdx
_Included because: The target file's current section 5 and its house style — numbered h2 headings, short intro line, bullet list, closing guidance sentence_

```
---
title: Plan and Execute Tasks in Board and List
description: Create tasks, set metadata, and execute work using Board and List views
---

Use this workflow to move from planning to execution with minimal overhead.

## 1. Create tasks quickly
...
## 5. Use filters to focus

The board toolbar supports filtering by:

- Status
- Priority
- Assignee
- Due date
- Labels

Use filters aggressively during standups, planning, and triage.

## 6. Open full task page when needed
...

```
### Acceptance criteria
- requirements_md contains sections: In scope, Out of scope, Functional requirements, Non-functional requirements, Acceptance criteria, Open questions
- Every functional requirement about chip behavior cites a file:line in verified_facts
- No requirement proposes creating a new page, editing docs.json, editing README.md, or editing any file under apps/web/src
- No requirement mentions WIP limits or hours rollup
- No file was written or edited by this packet
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "requirements_md": {
      "type": "string",
      "description": "Full markdown content of requirements.md"
    },
    "verified_facts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "claim": {
            "type": "string"
          },
          "evidence": {
            "type": "string",
            "description": "file:line reference proving the claim"
          }
        },
        "required": [
          "claim",
          "evidence"
        ]
      }
    },
    "open_questions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "requirements_md",
    "verified_facts",
    "open_questions"
  ]
}
```