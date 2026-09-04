# Test Results

## Command

`pnpm --filter @kaneo/web test`

## Result

Vitest started successfully but produced no test results or progress for more than three minutes. The tracked process was stopped with `SIGINT` and exited with code 130.

The runner printed one pre-existing warning: `vitest.config.ts` uses `__dirname`, which is unsupported by Vite's planned native config loader default.

No source files changed, so this timeout is not a regression introduced by the run.
