## Task smoke-flash-2 — docs / smoke
Module: precheck
### Working directory
You are running as an agent inside `/tmp/claude-1000/-home-sangeetha-projects-kaneo/f572d05f-0463-4ab8-8180-4ad46c4233e5/scratchpad/smoke2`. You may list, read,
edit and create files there, and run commands there. That directory is the
only place you can act; nothing outside it is reachable.
### Instruction
Return the literal string OK and nothing else.
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