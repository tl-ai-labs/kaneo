# Intent Brief — docs — Board features README section

## Context

User request, captured verbatim: `add README section "Board features" documenting WIP limits, hours rollup, and filter chips`.

The root README currently has no board-features section. The repository clearly contains board filter chips for status, priority, assignee, due date, and labels. The discovery scan did not find clear implementation evidence for WIP limits or an hours rollup, so the documentation must verify those claims before publishing them.

## Goal

Add a concise, product-oriented `Board features` section to the root README describing WIP limits, hours rollup, and filter chips accurately and consistently with the README's existing voice.

## Task type

doc_addition

## Files in scope

- `README.md`

## Files off-limits

- All application source, tests, translations, configuration, environment files, generated files, AI-agent configuration, and every documentation file other than `README.md`.

## Acceptance criteria

1. `README.md` contains a level-two `Board features` section.
2. The section covers WIP limits, hours rollup, and filter chips in concise user-facing language.
3. Every product claim is supported by the current repository or explicitly revised with the user before publication.
4. Existing README content, links, and formatting remain intact.
5. Markdown formatting passes the applicable documentation check or focused structural validation.

## Non-goals

- Implementing or changing any board feature.
- Editing product documentation outside the root README.
- Changing translations, screenshots, deployment instructions, or application behavior.
