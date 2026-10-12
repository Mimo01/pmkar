---
phase: 31
slug: membership-entry-points
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-12
---

# Phase 31 - Security

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| UI to Tauri IPC | Group names, issue keys, snapshot JSON sent to Rust commands | User text, Jira ticket subset |
| Persisted state to UI | Group names/colors rendered in chips, tabs, toasts | Untrusted strings |

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-31-01 | Spoofing | {{name}} in toasts/aria-labels | mitigate | React text nodes/sonner text; no dangerouslySetInnerHTML in src/features/groups (grep). Note: i18n/index.ts:13 sets escapeValue:false (differs from plan text) but output is never injected as HTML | closed |
| T-31-02 | Repudiation | Missing translation key | accept | Accepted; parity gate src/features/groups/__tests__/groupI18n.test.ts | closed |
| T-31-03 | Tampering | navigateToGroup stale id | mitigate | GroupTabStrip.tsx:140,174,276 groups.some check; groupTabs.ts:31-38 resolveActiveTab fallback to 'new' | closed |
| T-31-04 | DoS | Detail re-open loop | mitigate | App.tsx:161-166 selectTicket(null) before setCurrentTab | closed |
| T-31-05 | Tampering | Hidden issues selected | mitigate | useListSelection.ts:41-53 prune + selectedKeys from visibleKeys | closed |
| T-31-06 | DoS | Prune setState loop | mitigate | useListSelection.ts:44-50 returns prev when size unchanged | closed |
| T-31-07 | Info Disclosure | Selection across tabs | mitigate | useListSelection.ts local useState only; App.tsx:305 key={activeGroupId} | closed |
| T-31-08 | Tampering | Create row name input | mitigate | GroupPicker.tsx:130,227 validateGroupName gate; groups_db.rs:205,461 Rust re-validation; GroupPicker.tsx:237 inline error code | closed |
| T-31-09 | Spoofing | Bidi/invisible chars | mitigate | groups_db.rs:132-138 normalize strips bidi controls; names rendered as React text | closed |
| T-31-10 | Tampering | Color style injection | mitigate | GroupPicker.tsx:385 groupColorVar; groupStore.ts:95 isGroupColorToken coercion | closed |
| T-31-11 | Tampering | Double submit/racing toggles | mitigate | GroupPicker.tsx:103-107,176,227 in-flight Set/ref + openSeqRef | closed |
| T-31-12 | Tampering | Snapshot JSON addToGroup | accept | Accepted; Rust groups_db.rs:575-584 validates issue key + JSON object | closed |
| T-31-13 | Spoofing | Group names in chips | mitigate | GroupChip.tsx:18-22 text, truncate + tooltip | closed |
| T-31-14 | Tampering | Color token in style | mitigate | GroupChip.tsx:16 groupColorVar only | closed |
| T-31-15 | DoS | Selector new array | mitigate | groupStore.ts:180-183 null fallback | closed |
| T-31-16 | EoP | Chip click-through | mitigate | GroupChip.tsx:35 stopPropagation; GroupChips.tsx:36; TicketCard.tsx:93 | closed |
| T-31-17 | Tampering | Bulk remove without consent | mitigate | SelectionBar.tsx confirm popover, onOpenAutoFocus focuses Cancel | closed |
| T-31-18 | Tampering | Partial bulk application | mitigate | groupStore.ts:162,167 single add/remove invoke with all keys | closed |
| T-31-19 | Repudiation | User unsure of outcome | mitigate | membershipActions.ts:19-45 real count/skipped toasts, error toast | closed |
| T-31-20 | DoS | Double submit | mitigate | SelectionBar.tsx:36-50 inFlightRemoveRef; DetailGroupsRow.tsx:44-59 | closed |
| T-31-21 | Tampering | Oversized snapshot | mitigate | detailToTicket.ts:11-25 whitelist fields; groups_db.rs:581; detailToTicket.test.ts uses isRenderableTicket | closed |
| T-31-22 | Tampering | Accidental detail removal | mitigate | DetailGroupsRow.tsx confirm popover (same pattern; test DetailGroupsRow.test.tsx) | closed |
| T-31-23 | DoS | Esc exits detail | mitigate | useListSelection.ts:105 !e.defaultPrevented guard | closed |
| T-31-24 | Spoofing | Group names in chips | mitigate | GroupChipLabel text only; aria-labels via t() | closed |
| T-31-25 | Tampering | Hidden issues in group bulk remove | mitigate | GroupViewPage.tsx:37-42 selectedTickets from sorted | closed |
| T-31-26 | Tampering | Remove without confirmation | mitigate | SelectionBar.tsx handleRemove only from confirm button; SelectionBar.test.tsx | closed |
| T-31-27 | Info Disclosure | Selection after leaving group | mitigate | App.tsx:305 key remount; page-local hook | closed |
| T-31-28 | Tampering | Bulk add hidden issues | mitigate | TicketListPage.tsx:395-399 selectedTickets from sortedCandidates | closed |
| T-31-29 | Tampering | Membership alters triage | mitigate | membershipRegression.test.tsx:127-134 triageMap deep compare | closed |
| T-31-30 | Info Disclosure | Selection across tabs | mitigate | page-local hook; App.test.tsx | closed |
| T-31-31 | EoP | Remove outside group views | mitigate | group={null} at TicketListPage.tsx:556, IgnoredTicketsPage.tsx:134, LinkedTicketsPage.tsx:104; SelectionBar renders Remove only when group | closed |

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-31-01 | T-31-02 | Missing translation shows raw key; guarded by parity test | plan-time | 2026-10-12 |
| AR-31-02 | T-31-12 | Full JiraTicket snapshot sent; Rust validates object + key format | plan-time | 2026-10-12 |

## Notes

- T-31-01: i18n escapeValue is false (src/i18n/index.ts:13), not default; safe only because all consumers render via React text. Keep no-HTML-injection invariant for group strings.
- No Threat Flags in SUMMARY files; no unregistered flags.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-12 | 31 | 31 | 0 | gsd-security-auditor |

## Sign-Off

- [x] All threats have a disposition
- [x] Accepted risks documented
- [x] threats_open: 0 confirmed
- [x] status: verified set

**Approval:** verified 2026-10-12
