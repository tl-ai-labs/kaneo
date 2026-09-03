# Documentation validation

- PASS: exactly one `## Board features` heading exists.
- PASS: the section documents verified filter chips for status, priority, assignee, due date, and labels.
- PASS: README contains no WIP-limit or hours-rollup availability claim.
- PASS: `.gitignore` contains exactly one `.sdlc/` entry.
- PASS: newly inserted lines contain no trailing whitespace.
- LIMITATION: repository-wide `git diff --check` reports pre-existing CRLF line-ending changes across both already-dirty allowlisted files; those changes were not introduced by this run.
