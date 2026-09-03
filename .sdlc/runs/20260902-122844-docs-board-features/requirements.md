# Requirements: README Board Features

## Scope

### In scope

1. Add a concise level-two (`##`) **Board features** section to the root `README.md`.
2. Document filter chips only to the extent supported by the repository.
3. Verify WIP limits and hours rollup before mentioning either as available product functionality.
4. Keep the change limited to `README.md`.

### Out of scope

1. Changes to application code, APIs, database schema, tests, translations, or other documentation files.
2. Implementing WIP limits, hours rollup, or filter chips.
3. Inventing configuration, calculations, permissions, UI interactions, or availability claims for unverified features.
4. Modifying README content unrelated to Board features.

## Functional requirements

- **FR-1:** The root `README.md` SHALL contain one concise level-two section titled `Board features`.
- **FR-2:** The section SHALL describe board filter chips using only behavior evidenced in the codebase or existing product documentation.
- **FR-3:** WIP limits SHALL be included only if discovery verifies that the product supports them and establishes a supportable, concise claim.
- **FR-4:** Hours rollup SHALL be included only if discovery verifies that the product supports it and establishes a supportable, concise claim.
- **FR-5:** If WIP limits or hours rollup remain unverified, the README SHALL omit claims that they are product features.
- **FR-6:** The documentation change SHALL modify only `README.md`.

## Non-functional requirements

- **NFR-1:** Copy SHALL be concise, accurate, and consistent with the README’s existing tone and Markdown structure.
- **NFR-2:** The change SHALL preserve valid Markdown rendering.
- **NFR-3:** The change SHALL not disclose PII, credentials, internal implementation details, or private workspace data.
- **NFR-4:** Claims SHALL be traceable to repository evidence; unsupported claims SHALL be explicitly treated as unresolved rather than inferred.

## Unsupported-product-claim flags

- **WIP limits:** Not located during discovery. Do not state that boards enforce, configure, warn about, or display WIP limits until verified.
- **Hours rollup:** Not located during discovery. Do not state that boards aggregate, estimate, track, sum, or report hours until verified.
- **Filter chips:** Evident in discovery, but exact supported filters and interactions must be confirmed before describing them.

## PII inventory

| Data element | Collected or introduced | Location | Handling requirement |
| --- | --- | --- | --- |
| Personal data | No | README change | Do not add personal data. |
| Credentials or secrets | No | README change | Do not add tokens, keys, or connection strings. |
| Workspace or project data | No | README change | Use only generic, non-identifying examples if examples are needed. |

## Role matrix

| Role | Responsibility | Permission or outcome |
| --- | --- | --- |
| README reader | Consume feature overview | Can understand verified Board capabilities. |
| Documentation maintainer | Edit and validate README copy | May publish only evidence-supported claims. |
| Product/engineering verifier | Resolve unverified feature evidence | Confirms whether WIP limits and hours rollup may be documented. |

## Acceptance criteria

1. `README.md` contains exactly one new or updated level-two heading named `Board features`, verifiable with `rg -n '^## Board features$' README.md`.
2. The Board features section contains a concise, evidence-supported description of filter chips.
3. Before publication, repository evidence for WIP limits is recorded or reviewed; if evidence is absent, `README.md` contains no claim that WIP limits are supported.
4. Before publication, repository evidence for hours rollup is recorded or reviewed; if evidence is absent, `README.md` contains no claim that hours rollup is supported.
5. The changed-file list contains only `README.md`, verifiable with `git diff --name-only`.
6. The resulting `README.md` remains valid Markdown by visual rendering or the repository’s applicable documentation check, if one exists.
7. The added section contains no PII, secrets, credentials, or private workspace data.

## Open questions

1. Does the current product implement WIP limits? If so, where is the authoritative user-visible behavior and configuration documented in code?
2. Does the current product implement hours rollup? If so, what entities contribute, where is the result shown, and what wording is accurate?
3. Which filter-chip dimensions and interactions are stable enough to describe in the README?
4. Should the section be published with filter chips only if the two unverified features cannot be substantiated?
