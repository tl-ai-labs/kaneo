# Test Results

## Command

`pnpm --filter @kaneo/web test`

## Result

Tests did not start. The package-local `vitest` executable is unavailable because `node_modules` is not installed in this checkout.

```text
sh: 1: vitest: not found
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL
WARN Local package.json exists, but node_modules missing
```

No source files changed, so this is an environment limitation rather than a regression introduced by the run.
