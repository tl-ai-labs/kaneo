## Task tp_security_review_001 — security_review / changed_files_review
Module: docs
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Security review of a documentation-only change, scoped to changed files only (brownfield docs intent). Exactly one file changed: apps/docs/core/functional/plan-and-execute-tasks.mdx, +16 lines in section '## 5. Use filters to focus', 0 deletions.

Run `git diff` yourself to see the authoritative change. Do not assume the change is benign because it is documentation - documentation is a real disclosure surface. Assess:

1. INFORMATION DISCLOSURE. Does the new text reveal anything that is not already visible to any authenticated user in the product UI? Specifically check for: internal identifiers, database column or table names, API route shapes, i18n key names, source file paths, component or prop names, environment variable names, infrastructure details, or private workspace data. Kaneo's boundary rule is that docs may describe what a user sees, never internal structure.

2. AUTHORIZATION SEMANTICS. The text describes board filtering. Does it imply, anywhere, that filtering is a security or access-control boundary? Filtering is a view convenience, not authorization. Documentation that suggests hiding a task from a board protects it would be a genuine security defect - it teaches users to rely on a control that does not enforce anything. Check the wording for this.

3. ACCURACY AS A SECURITY PROPERTY. A user acting on wrong documentation is a risk. Verify against apps/web/src/components/board/board-toolbar.tsx that the described clearing behavior is correct, since a user who believes a filter is cleared when it is not may conclude they are seeing all tasks when they are not.

4. SUPPLY CHAIN / WRITE SCOPE. Confirm via git status and git diff that no file outside the single documentation file was modified, that no dependency, config, workflow, or CI file was touched, and that no secret or credential appears in the diff.

Produce a security review document. If there is no finding, say so directly and state what you checked; do not manufacture findings to appear diligent.

DO NOT WRITE OR EDIT ANY FILE. Return structured output only.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- files_changed_confirmed is derived from an actual git command, not assumed
- The review explicitly addresses whether the text implies filtering is an access-control boundary
- The review explicitly confirms no internal identifiers, i18n keys, file paths or component names leaked into user-facing prose
- checks_performed lists concrete checks, each one actually run
- No file was written or edited by this packet
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "security_review_md": {
      "type": "string",
      "description": "Full markdown content of security_review.md"
    },
    "verdict": {
      "type": "string",
      "enum": [
        "pass",
        "pass_with_observations",
        "findings_present",
        "fail"
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
              "critical",
              "high",
              "medium",
              "low",
              "informational"
            ]
          },
          "category": {
            "type": "string"
          },
          "finding": {
            "type": "string"
          },
          "recommendation": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "severity",
          "category",
          "finding",
          "recommendation"
        ]
      }
    },
    "checks_performed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "files_changed_confirmed": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "security_review_md",
    "verdict",
    "findings",
    "checks_performed",
    "files_changed_confirmed"
  ]
}
```