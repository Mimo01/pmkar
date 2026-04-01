---
status: awaiting_human_verify
trigger: "watched-users-display: watched users list only shows email or identifier, should show user's full name and info"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:02Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — individual search path stored user.name (Jira login identifier) instead of user.displayName
test: all 32 SettingsPage tests pass + 30 ticketStore tests pass after fix
expecting: user to confirm the watched users list now shows display names after adding via individual search
next_action: await human verification

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Watched users list shows user's full name and info (not just email/identifier) after adding them
actual: Only email or identifier is displayed in watched users list
errors: None reported — it's a display/data issue
reproduction: Add a user to watched users from company global or individually, observe the watched users list
started: Ongoing behavior

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-01T00:00:01Z
  checked: FetchConfig type in types.ts
  found: watchedUsers is typed as string[] — plain strings, not objects
  implication: display renders raw stored string directly

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx handleAddUser (line 350) and callsites (lines 378, 794)
  found: handleAddUser(user.name ?? '') — stored user.name (the Jira Server v2 username/login) not user.displayName
  implication: individual search added the identifier (e.g. "jdoe") not the display name ("Jane Doe")

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx handleAddDomainResults (line 440)
  found: maps u.displayName — stores displayName correctly for domain search path
  implication: domain search showed correctly; individual search did not — inconsistency confirmed

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx watched users list render (lines 1001-1021)
  found: renders {user} directly — just the raw stored string
  implication: whatever is stored in watchedUsers is shown verbatim

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx suggestions "already watching" filter (line 317)
  found: used u.name ?? '' — must change to u.displayName to stay consistent
  implication: updated as part of fix

- timestamp: 2026-04-01T00:00:02Z
  checked: all SettingsPage tests (32) + ticketStore tests (30)
  found: all pass after fix
  implication: fix is correct, no regressions

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: In SettingsPage.tsx, the individual user search path called handleAddUser(user.name ?? '') — storing the Jira Server v2 login identifier instead of the display name. The domain search path already stored u.displayName correctly, making the two paths inconsistent. The watched users list renders the stored string verbatim, so individual-search additions showed raw identifiers.
fix: Changed three locations in SettingsPage.tsx — (1) the "already watching" suggestions filter from u.name to u.displayName, (2) keyboard Enter handler from suggestions[idx].name to suggestions[idx].displayName, (3) click onMouseDown handler from user.name to user.displayName. All paths now store displayName consistently.
verification: 32 SettingsPage tests + 30 ticketStore tests all pass.
files_changed: [src/features/connections/SettingsPage.tsx]
