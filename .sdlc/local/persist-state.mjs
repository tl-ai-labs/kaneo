#!/usr/bin/env node
// Run-local helper: writes a COHERENT .sdlc/local/state.json.
// Coherence rules enforced here so the file can never contradict itself:
//   status === "gate-pending"  <=> gate !== null && awaiting === "user"
//   status !== "gate-pending"  =>  gate === null && awaiting === "orchestrator"
import { readFileSync, writeFileSync } from "node:fs";
const p = ".sdlc/local/state.json";
const patch = JSON.parse(process.argv[2] ?? "{}");
let prev = {};
try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
const s = { ...prev, ...patch };
if (s.status === "gate-pending") {
  if (!s.gate) throw new Error("gate-pending requires a gate");
  s.awaiting = "user";
} else {
  s.gate = null; s.gate_title = null; s.awaiting = "orchestrator";
}
s.schema_version = 1;
s.updated_at = new Date().toISOString();
s.timestamp = s.updated_at;
writeFileSync(p, JSON.stringify(s, null, 2) + "\n");
console.log(`state: status=${s.status} phase=${s.phase} gate=${s.gate ?? "-"} awaiting=${s.awaiting}`);
