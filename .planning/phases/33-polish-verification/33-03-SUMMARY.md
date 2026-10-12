---
phase: 33-polish-verification
plan: 03
subsystem: mock-server
tags: [rust, mock-server, uat, scenarios]
requires: []
provides:
  - MockScenario switchable behaviour for the v2 mock server
affects: [33-06]
key-files:
  created: [src-tauri/tests/mock_server_scenarios.rs]
  modified: [src-tauri/src/fixtures.rs, src-tauri/src/mock_server.rs]
requirements-completed: [GQA-01, GQA-02]
metrics:
  tasks: 2
  files: 3
---

# Phase 33 Plan 03: Mock Scenarios Summary

Switchable v2 mock scenarios (drop, partial_fail, truncated) plus runtime mutate route, gated to the `mock-server` feature, with 7 passing integration tests.

## Commits
- efe57d0: MockScenario enum, scenario-aware v2 search, /__mock routes
- b5970f2: integration tests (7 pass)

## Startup (env)
`PMKAR_MOCK_SCENARIO=default|drop|partial_fail|truncated`, `PMKAR_MOCK_DROP_KEYS=PROJ-1` (default), `PMKAR_MOCK_FAIL_ASSIGNEE=csmith` (default). Unknown value: warning, falls back to default. Env is only read in mock-server builds.

## UAT curl commands (v2 mock at http://localhost:8080; Bearer header required)
```
H='Authorization: Bearer x'; C='Content-Type: application/json'
# Drop PROJ-1 from search (GET issue still works) -> missing hint
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"drop","keys":["PROJ-1"]}'
# One user's batch returns 500 -> incomplete fetch, no hints
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"partial_fail","assignee":"csmith"}'
# >1000 matches -> truncated, no hints
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"truncated"}'
# Reset
curl -X POST localhost:8080/__mock/scenario -H "$H" -H "$C" -d '{"scenario":"default"}'
# Show current
curl localhost:8080/__mock/scenario -H "$H"
# Mutate grouped issue (snapshot refresh); unknown key -> 404
curl -X POST localhost:8080/__mock/mutate -H "$H" -H "$C" -d '{"key":"PROJ-1","summary":"Changed by mock","status":"In Review"}'
```

## Deviations from Plan
- Worktree was behind the expected base; reset to 2076e74 per the branch check.
- Test search helper builds the query string manually (reqwest 0.13 here has no `query` feature).
- Task 1 TDD red step not committed separately: tests were written after implementation in Task 2 as the plan orders them.

## Self-Check: PASSED
Both commits exist; mock-server and plain `cargo build` succeed; clippy clean on touched files; pre-commit hooks passed.
