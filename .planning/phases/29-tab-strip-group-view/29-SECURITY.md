---
phase: 29
slug: tab-strip-group-view
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-12
---

# Phase 29 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Webview UI to Tauri commands | User-typed group names and ids are sent to Rust `create_group`/`rename_group` | Group name (untrusted text) |
| Local SQLite to webview | Stored groups, memberships and ticket snapshot JSON are hydrated into the store | Group rows, color tokens, ticket JSON |
| npm registry to build | New dependency `@radix-ui/react-popover` | Third-party code |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-29-01 | Spoofing | validate_group_name / validateGroupName | mitigate | Invisible chars (U+00AD, U+200B..200F, U+2060..2064, U+FEFF and more) stripped from the key, empty key rejected. Rust: `src-tauri/src/groups_db.rs:145-156` (strip), `:210`, `:217` (empty checks). TS: `src/features/groups/validation.ts:36` (strip), `:68`, `:71` (empty checks) | closed |
| T-29-02 | Tampering | groupStore.hydrate | mitigate | `hydrateSeq` generation counter drops stale responses (`groupStore.ts:84,106,123`). Memberships whose groupId is not in the same response are skipped (`:96-98`) | closed |
| T-29-03 | DoS | groupStore.hydrate catch | mitigate | Non-scope-change failures keep last good state and set `hydrateError` only (`groupStore.ts:117-118`). The wipe path runs only when `clearOnError` is set after a scope change (`:108-114`) | closed |
| T-29-04 | Info Disclosure | hydrate failure after scope switch | accept | See Accepted Risks Log (AR-29-01). The code is stricter than planned: it clears state on scope-change failure (`groupStore.ts:108-114`) | closed |
| T-29-05 | Tampering | restoreTicket | accept | See AR-29-02 | closed |
| T-29-06 | Tampering | locale interpolation | mitigate | `groups.tab.aria` is passed through `t()` into an `aria-label` attribute (`GroupTab.tsx:22`). `grep dangerouslySetInnerHTML` over `src/features/groups`, `IgnoredTicketsPage.tsx`, `popover.tsx`, `AppShell.tsx`, `App.tsx` and `triageActions.ts` returned no matches | closed |
| T-29-07 | Spoofing | reserved-name list | mitigate | `validation.test.ts:35` asserts `RESERVED_NAME_KEYS.size` is 6. Rust reserved check at `groups_db.rs:220`, with a test at `:716` | closed |
| T-29-SC | Tampering | @radix-ui/react-popover install | mitigate | `package.json:22` pins `"1.3.0"` with no range prefix. `package-lock.json:957-960` has version 1.3.0, a registry `resolved` URL and an sha512 integrity hash | closed |
| T-29-08 | EoP | install scripts | mitigate | The `node_modules/@radix-ui/react-popover` lock entry (`package-lock.json:957+`) has no `hasInstallScript` | closed |
| T-29-09 | Tampering | CreateGroupPopover name input | mitigate | The Rust write path re-validates on create (`groups_db.rs:461`), rename (`:496`) and a third call site (`:648`). The popover renders the name only as React text | closed |
| T-29-10 | Info Disclosure | submit error display | mitigate | `CreateGroupPopover.tsx:15-24` maps codes to i18n keys, and the `default` branch returns `groups.error.internal`. `groupStore.ts:63-64` routes thrown errors through `toGroupErrorCode` | closed |
| T-29-11 | DoS | repeated Enter submits | mitigate | `inFlightRef` and `submitting` guard at `CreateGroupPopover.tsx:69-70`. Tests assert `createCalls()` has length 1 (`CreateGroupPopover.test.tsx:167,170,229,238`) | closed |
| T-29-12 | Tampering | useGroupMembers JSON.parse | mitigate | try/catch around `JSON.parse` with the `isRenderableTicket` guard (`useGroupMembers.ts:11,77-83`). Skipped entries log `console.warn` (`:86`) | closed |
| T-29-13 | XSS | Card rendering of snapshot | mitigate | `GroupViewPage.tsx` renders through TicketCard and React text. No `dangerouslySetInnerHTML` in any phase 29 file | closed |
| T-29-14 | DoS | Zustand selector loop | mitigate | `useGroupMembers.ts:49` uses `?? null`. `GroupViewPage.test.tsx:71` covers a group with no `memberKeysByGroup` entry | closed |
| T-29-15 | Tampering | restoreTicket (group view) | accept | See AR-29-03 | closed |
| T-29-16 | XSS/CSS injection | GroupTab dot style and name | mitigate | Color is coerced by `isGroupColorToken` in hydrate (`groupStore.ts:91`), and the dot style uses `groupColorVar` (`GroupTab.tsx:33`). The name is rendered as React text (`:40,42,47`) | closed |
| T-29-17 | Spoofing | core-tab lookalike names | mitigate | The reserved-name and invisible-char rules are enforced in Rust (`groups_db.rs:145-156,220`). Divider `data-testid="group-divider"` at `GroupTabStrip.tsx:104` separates groups from core tabs | closed |
| T-29-18 | DoS | fallback effect loop | mitigate | `resolveActiveTab` is pure (`groupTabs.ts:23-31`) and maps only group tabs to `'new'`. `App.tsx:112` derives it during render with no effect and no state write, so no loop is possible | closed |
| T-29-19 | Info Disclosure | active tab persistence | accept | See AR-29-04 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-29-01 | T-29-04 | After a scope switch, a failed hydrate could briefly leave the previous scope's data. The same local user owns both scopes. The code already clears on a failed scope-change hydrate. | Plan 29 threat model | 2026-10-12 |
| AR-29-02 | T-29-05 | `restoreTicket` is an existing write path that sets a fixed 'seen' state. Phase 29 does not change it. | Plan 29 threat model | 2026-10-12 |
| AR-29-03 | T-29-15 | The group view uses the same existing `restoreTicket` write path as the Dismissed page. | Plan 29 threat model | 2026-10-12 |
| AR-29-04 | T-29-19 | Active tab state lives in memory only (`useState` in `App.tsx:107`) and nothing is written to disk. | Plan 29 threat model | 2026-10-12 |

---

## Unregistered Flags

None. The SUMMARY.md files declare no threat flags.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-12 | 20 | 20 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-12
