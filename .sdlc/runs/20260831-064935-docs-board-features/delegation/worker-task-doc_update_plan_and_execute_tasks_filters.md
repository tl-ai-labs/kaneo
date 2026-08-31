## Task doc_update_plan_and_execute_tasks_filters — docs / doc_update
Module: docs
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Rewrite ONLY the section '## 5. Use filters to focus' in apps/docs/core/functional/plan-and-execute-tasks.mdx. Return the COMPLETE new file content. Every other line of the file must come back byte-identical.

FACTUAL CONTRACT - each statement below is verified against apps/web/src/components/board/board-toolbar.tsx on this branch. Do not generalize beyond it.

1. Chips: once a filter has a selection it appears as a chip in the board toolbar, beside the Filter and Sort controls. A chip reads as subject, then operator, then value, and ends in an X button.
2. Operator is 'is any of' for Status, Priority, Assignee and Due date. For Labels the operator is 'include any of'.
3. Value display, and this asymmetry is the point of the change:
   - Status, Priority, Assignee, Due date: when EXACTLY ONE value is selected the chip names it (the column name / priority / member name / 'Due this week', 'Due next week', 'No due date'). When more than one is selected it shows a count instead, reading '2 selected'.
   - Labels: the chip ALWAYS shows a count, even when a single label is selected. It NEVER names a label. State this exception explicitly - do not fold Labels into the sentence about the other four.
4. Status, Priority and Assignee chips also show small stacked icons/avatars for the selection, capped at three. Due date and Labels chips show no icons.
5. Clearing: a chip's X clears that ONE field entirely - all values selected for it - and leaves other chips untouched. It is not a per-value control.
6. 'Clear all filters' is an item INSIDE the Filter dropdown menu, appearing at the bottom only once at least one filter is active. It is NOT a standalone button on the toolbar. Say where it lives.

HARD CONSTRAINTS:
- PRESERVE the existing five-item bullet list (Status, Priority, Assignee, Due date, Labels) exactly as-is. Add around it; do not replace it.
- PRESERVE the closing line 'Use filters aggressively during standups, planning, and triage.'
- Frontmatter, and sections 1, 2, 3, 4, 6 and Next: byte-identical. Heading stays '## 5. Use filters to focus'.
- USER-FACING PROSE ONLY. Never write React component names, prop names, i18n keys or file paths into the doc. 'ActiveFilterChip', 'hasActiveFilters', 'clearLabelFilters' and similar are code identifiers and MUST NOT appear. Use only wording a user sees in the UI.
- Match the surrounding house style: short declarative sentences, bold for UI labels, plain bullet lists. This is a concise user guide, not an API reference. Do not add subheadings, tables, code fences, or MDX components that the rest of the file does not already use.

DO NOT WRITE OR EDIT ANY FILE ON DISK. Return the content in structured output only.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/docs/core/functional/plan-and-execute-tasks.mdx
_Included because: Complete current file. Only section 5 may change; everything else must be returned byte-identical._

```
---
title: Plan and Execute Tasks in Board and List
description: Create tasks, set metadata, and execute work using Board and List views
---

Use this workflow to move from planning to execution with minimal overhead.

## 1. Create tasks quickly

In a project:

1. Open **Board** or **List** view.
2. Click **Create task**.
3. Add a short, action-oriented title.
4. Optionally set description, assignee, priority, due date, and labels.

## 2. Keep task data clean

When editing tasks, prioritize:

- Clear scope in the description
- One owner (assignee)
- Explicit priority
- Realistic due dates
- Reusable labels

## 3. Execute in Board view

Board view is best for flow-based execution:

1. Pull tasks into active columns.
2. Drag tasks across columns as status changes.
3. Open a task to edit details without losing board context.

## 4. Switch to List view for dense review

List view is useful when you need to scan many tasks quickly.

Typical uses:

- Reviewing priorities across the project
- Spotting overdue work
- Finding unassigned or under-specified tasks

## 5. Use filters to focus

The board toolbar supports filtering by:

- Status
- Priority
- Assignee
- Due date
- Labels

Use filters aggressively during standups, planning, and triage.

## 6. Open full task page when needed

From the task sheet, use **Open in full page** for deeper edits and focused context.

## Next

- [Plan work in Backlog](/core/functional/backlog-planning)
- [Configure project workflows](/core/functional/configure-workflows)

```
### Acceptance criteria
- file_content is a complete .mdx file with unchanged frontmatter
- Sections 1, 2, 3, 4, 6 and Next are byte-identical to the input
- The five-item bullet list Status/Priority/Assignee/Due date/Labels is still present
- The closing line 'Use filters aggressively during standups, planning, and triage.' is still present
- Text states Labels always shows a count and never names a single label
- Text states 'Clear all filters' is inside the Filter dropdown menu, not a toolbar button
- Text states a chip's clear control clears the whole field, not one value
- No React component name, prop name, i18n key or file path appears anywhere in the text
- No mention of WIP limits or hours rollup
- No file was written to disk
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "file_content": {
      "type": "string",
      "description": "The complete new content of plan-and-execute-tasks.mdx"
    },
    "section_5_only": {
      "type": "string",
      "description": "Just the new section 5, from its '## 5.' heading up to but excluding the '## 6.' heading"
    },
    "notes": {
      "type": "string"
    }
  },
  "required": [
    "file_content",
    "section_5_only",
    "notes"
  ]
}
```