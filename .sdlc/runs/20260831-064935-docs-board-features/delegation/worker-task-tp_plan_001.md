## Task tp_plan_001 — plan_task_packets / decomposition
Module: docs
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Decompose the approved requirements into TaskPackets for a brownfield docs run. The write-contract allowlist for this run contains EXACTLY ONE path: apps/docs/core/functional/plan-and-execute-tasks.mdx. Any packet naming a different artifact_path will be rejected at dispatch, so do not plan one.

The operator fixed task_type at brief-collection time: every packet in this run uses task_type 'doc_update'. Do not substitute 'doc_addition'.

Expected result: a single packet that rewrites section '## 5. Use filters to focus' in place. Justify in planning_notes if you believe more than one packet is genuinely warranted, but do not split a 20-line section edit across packets for its own sake.

The packet's instruction field is the one that will actually author the prose, so write it to carry the full factual contract from FR-1 through FR-3 - especially the asymmetry that Status/Priority/Assignee/Due date name the value only when exactly one is selected while Labels is always a count, and that Clear all filters sits inside the Filter dropdown rather than on the toolbar.

DO NOT WRITE OR EDIT ANY FILE. Return the packet array as structured output only.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### .sdlc/runs/20260831-064935-docs-board-features/requirements.md
_Included because: Approved requirements, condensed to the factual contract the authoring packet must carry_

```
FR-1.1 Active filters render as removable ActiveFilterChip components in the board toolbar next to the Filter dropdown and Sort control.
FR-1.2 Each chip has divider-separated sections: Subject, Operator, Value, Clear button (X).
FR-2.1 Status chip: subject 'Status', operator 'is any of', stacked status icons (max 3), value = column name if exactly 1 selected else '{count} selected'.
FR-2.2 Priority chip: subject 'Priority', operator 'is any of', stacked priority icons (max 3), value = priority label if exactly 1 selected else '{count} selected'.
FR-2.3 Assignee chip: subject 'Assignee', operator 'is any of', stacked avatars (max 3), value = user name if exactly 1 selected else '{count} selected'.
FR-2.4 Due date chip: subject 'Due date', operator 'is any of', NO stacked icons, value = 'Due this week'/'Due next week'/'No due date' if exactly 1 selected else '{count} selected'.
FR-2.5 Labels chip: subject 'Labels', operator 'include any of' (NOT 'is any of'), value is ALWAYS '{count} selected' - there is no single-label naming branch.
FR-3.1 Per-chip clear resets that one filter criterion only, not the others.
FR-3.2 'Clear all filters' is a menu item INSIDE the Filter dropdown, shown only when at least one filter is active. It is not a standalone toolbar button.
NFR-1 Match repo .mdx house style. NFR-3 Frontmatter and sections 1,2,3,4,6,Next must remain untouched.
Out of scope: new pages, docs.json, README.md, apps/web/src/**, WIP limits, hours rollup.
```

#### apps/docs/core/functional/plan-and-execute-tasks.mdx
_Included because: The exact current text of the only section this run may modify; the five-filter list must be preserved not replaced_

```
## 5. Use filters to focus

The board toolbar supports filtering by:

- Status
- Priority
- Assignee
- Due date
- Labels

Use filters aggressively during standups, planning, and triage.

```
### Acceptance criteria
- Every packet has artifact_path exactly 'apps/docs/core/functional/plan-and-execute-tasks.mdx'
- Every packet has task_type 'doc_update' and intent 'docs'
- Every packet has phase 'docs'
- The packet instruction states the Labels chip is always a count and never names a single label
- The packet instruction states 'Clear all filters' lives inside the Filter dropdown menu
- No packet targets docs.json, README.md, or any apps/web/src path
- No file was written or edited by this packet
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "packets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "phase": {
            "type": "string"
          },
          "task_type": {
            "type": "string"
          },
          "module": {
            "type": "string"
          },
          "intent": {
            "type": "string"
          },
          "artifact_path": {
            "type": "string"
          },
          "instruction": {
            "type": "string"
          },
          "acceptance": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "budget": {
            "type": "object",
            "properties": {
              "maxInputTokens": {
                "type": "number"
              },
              "maxOutputTokens": {
                "type": "number"
              }
            },
            "required": [
              "maxInputTokens",
              "maxOutputTokens"
            ]
          }
        },
        "required": [
          "id",
          "phase",
          "task_type",
          "module",
          "intent",
          "artifact_path",
          "instruction",
          "acceptance",
          "budget"
        ]
      }
    },
    "planning_notes": {
      "type": "string"
    }
  },
  "required": [
    "packets",
    "planning_notes"
  ]
}
```