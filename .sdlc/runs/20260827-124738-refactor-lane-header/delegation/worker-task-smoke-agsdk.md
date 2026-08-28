## Task smoke-agsdk — docs / smoke
Module: precheck
### Working directory
You are running as an agent inside `/tmp/claude-1000/-home-sangeetha-projects-kaneo/203aa79e-33fe-4774-83ff-cc7b937c551b/scratchpad`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Return the literal string OK and nothing else. Do not read or write any files.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- result is exactly OK
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "result": {
      "type": "string"
    }
  },
  "required": [
    "result"
  ]
}
```