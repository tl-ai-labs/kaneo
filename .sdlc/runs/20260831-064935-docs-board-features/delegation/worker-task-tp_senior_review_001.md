## Task tp_senior_review_001 — senior_code_review / doc_review
Module: docs
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Review a documentation change that has just been written to apps/docs/core/functional/plan-and-execute-tasks.mdx. Section '## 5. Use filters to focus' gained 16 lines; nothing else in the file changed. Review it as a senior maintainer of this repo would, and be willing to reject your own project's output.

Use your repo tools. Do all four of the following:

1. FACTUAL ACCURACY. Read apps/web/src/components/board/board-toolbar.tsx and apps/web/src/hooks/use-task-filters-with-labels-support.ts, plus i18n/en-US.json. For EVERY claim the new prose makes, decide whether it is true on this branch. Report any claim that is wrong, overstated, or that generalizes across the five filters where the code does not. Quote the source line that settles each disputed claim.

2. HOUSE STYLE. The new text must be indistinguishable in voice, punctuation and formatting from documentation already in this repo. Do not assess it in the abstract - compare it against the other .mdx files under apps/docs/ and against the untouched sections of this same file. Read a representative sample of neighbouring docs before judging. Report anything in the new text whose form does not occur in the existing corpus, however small; typographic and punctuation conventions count.

3. SCOPE. Confirm the change is confined to section 5, that the original five-filter bullet list and the closing sentence survive, that frontmatter and all other sections are untouched, and that no new page or navigation entry was needed or made. Flag any code identifier, prop name, i18n key or file path that leaked into user-facing prose.

4. READER VALUE. Would a Kaneo user reading this section understand the filter chips better than before? Is anything now over-specified for a user guide, under-explained, or ambiguous?

For each finding give severity: blocker, major, minor, or nit. If a finding warrants a fix, supply a refinement_packet entry with the exact replacement text. If the change is acceptable as-is, say so plainly rather than inventing findings - an empty findings list is a valid result.

DO NOT WRITE OR EDIT ANY FILE. Return structured output only.
### Provided excerpts
These are extracts, not whole files. The paths are real — open them in the
working directory when you need more than the excerpt shows.

#### apps/docs/core/functional/plan-and-execute-tasks.mdx
_Included because: Summary of the added lines. The authoritative text is on disk - read it there._

```
The 16 added lines, inserted between the five-filter bullet list and the closing sentence of section 5:

Once a filter has a selection, it appears as a chip in the board toolbar beside the **Filter** and **Sort** controls. A chip reads as subject, then operator, then value, and ends in an **X** button.

The operator is "is any of" for **Status**, **Priority**, **Assignee**, and **Due date**. For **Labels**, the operator is "include any of".

Value display varies by filter type:

- For **Status**, **Priority**, **Assignee**, and **Due date**, selecting exactly one value displays its name (such as the column name, priority, member name, or due date option like "Due this week", "Due next week", or "No due date"). Selecting multiple values displays a count, such as "2 selected".
- For **Labels**, the chip always displays a count (such as "1 selected" or "2 selected"), even when a single label is selected. It never names a label.

Chips for **Status**, **Priority**, and **Assignee** also show small stacked icons or avatars for the selection, capped at three. **Due date** and **Labels** chips show no icons.

Clearing filters:

- Clicking a chip's **X** button clears that one field entirely-removing all values selected for it-while leaving other chips untouched. It is not a per-value control.
- **Clear all filters** is an item inside the **Filter** dropdown menu that appears at the bottom only once at least one filter is active. It is not a standalone button on the toolbar.

Read the file on disk for the exact text including its punctuation; this input has had two characters transliterated and is not byte-exact.
```
### Acceptance criteria
- Every claim in the new prose appears in factual_claim_audit with a source_line
- house_style_files_compared lists at least three real .mdx paths actually read from apps/docs
- Each finding carries a severity and category
- Findings that warrant a fix have a matching refinement_packet with exact_old_text matching the file byte-for-byte
- No file was written or edited by this packet
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "verdict": {
      "type": "string",
      "enum": [
        "approve",
        "approve_with_nits",
        "request_changes",
        "reject"
      ]
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "severity": {
            "type": "string",
            "enum": [
              "blocker",
              "major",
              "minor",
              "nit"
            ]
          },
          "category": {
            "type": "string",
            "enum": [
              "factual",
              "house_style",
              "scope",
              "reader_value"
            ]
          },
          "finding": {
            "type": "string"
          },
          "evidence": {
            "type": "string"
          },
          "suggested_fix": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "severity",
          "category",
          "finding",
          "evidence",
          "suggested_fix"
        ]
      }
    },
    "factual_claim_audit": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "claim": {
            "type": "string"
          },
          "true_on_this_branch": {
            "type": "boolean"
          },
          "source_line": {
            "type": "string"
          }
        },
        "required": [
          "claim",
          "true_on_this_branch",
          "source_line"
        ]
      }
    },
    "house_style_files_compared": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "refinement_packets": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "finding_id": {
            "type": "string"
          },
          "artifact_path": {
            "type": "string"
          },
          "exact_old_text": {
            "type": "string"
          },
          "exact_new_text": {
            "type": "string"
          }
        },
        "required": [
          "finding_id",
          "artifact_path",
          "exact_old_text",
          "exact_new_text"
        ]
      }
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "verdict",
    "findings",
    "factual_claim_audit",
    "house_style_files_compared",
    "refinement_packets",
    "summary"
  ]
}
```