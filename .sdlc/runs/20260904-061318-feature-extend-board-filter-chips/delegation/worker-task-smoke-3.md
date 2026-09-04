## Task smoke-3 — docs / smoke
Module: smoke
### Working directory
You are running as an agent inside `/home/sangeetha/projects/kaneo`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Return the literal string OK as the value of the `result` field. Do not read any files. Do not run any shell commands. Do not write or edit any files. Answer immediately from this instruction alone.
### Provided excerpts
_None supplied. Explore the working directory to find what you need._
### Acceptance criteria
- result is exactly the string OK
### Your final message
Your final message must be a single JSON object and nothing else — no
prose before it, no summary after it, no ``` fence around it. It must
conform to this schema:

```json
{
  "type": "object",
  "properties": {
    "result": {
      "type": "string",
      "description": "The literal string OK"
    }
  },
  "required": [
    "result"
  ]
}
```