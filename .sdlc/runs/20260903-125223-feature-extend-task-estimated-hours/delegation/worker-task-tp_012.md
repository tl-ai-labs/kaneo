## Task tp_012 — codegen / frontend_util
Module: web-ui
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Create the NEW file apps/web/src/lib/estimate.ts. Read .sdlc/runs/20260903-125223-feature-extend-task-estimated-hours/change_plan.md section 2 in full (2.2 the normative formatting formula, 2.3 the rollup rule, 2.5 the exact module contract and reference implementation) and write EXACTLY that module, including the JSDoc comments. Export formatEstimateMinutes, parseEstimateHours, estimateMinutesToHoursInput, sumEstimateMinutes and the two bound constants. The formatter is (m/60).toFixed(2) then .replace(/0+$/,"") then .replace(/\.$/,"") then append "h" — two separate replaces, do not collapse into one regex. sumEstimateMinutes sums RAW INTEGER MINUTES and never formats. Do NOT import or reuse lib/format-duration.ts: it is dead code, takes seconds, and is off-limits. Do not create any other file under lib/. Do not run tests.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- Exports formatEstimateMinutes, parseEstimateHours, estimateMinutesToHoursInput, sumEstimateMinutes, MIN_ESTIMATE_MINUTES, MAX_ESTIMATE_MINUTES
- Formatter uses toFixed(2) then two separate trailing-zero / trailing-dot replaces
- format(90)=='1.5h', format(120)=='2h', format(100)=='1.67h', format(6000)=='100h', format(0)==null
- sumEstimateMinutes returns an integer minute total and treats null/undefined as 0, never NaN
- No import of lib/format-duration.ts and no other file created under apps/web/src/lib/
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "artifact_path": {
      "type": "string"
    },
    "summary": {
      "type": "string"
    }
  },
  "required": [
    "artifact_path",
    "summary"
  ]
}
```