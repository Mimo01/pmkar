---
status: resolved
trigger: "settings-not-persisting"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED — Cloud credentials were keyed by email in keychain but connection_meta stored result.username (display name). On reload, ConnectionForm pre-fills by fetching get_credential(type, connection_meta.username=displayName) which fails because the secret is under the email key. Fields appear empty.
test: Root cause confirmed via git diff + code trace
expecting: Verify working tree changes are complete and correct
next_action: Verify the fix in working tree is complete — check for any remaining inconsistency

## Symptoms

expected: Changes to PAT and email in settings should persist after reload
actual: Changes work for test connection but disappear on reload
errors: None visible
reproduction: Change PAT or email in settings page, click test connection (succeeds), reload app — values revert
started: Current behavior

## Eliminated

- hypothesis: save/persist call is not triggered
  evidence: invoke('store_credential') and invoke('set_connection_meta') are both called in handleEditTestSuccess on test success
  timestamp: 2026-04-01T00:00:01Z

- hypothesis: set_connection_meta fails silently
  evidence: DB upserts on connection_type conflict — correctly updates existing row including the new username
  timestamp: 2026-04-01T00:00:01Z

## Evidence

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx handleEditTestSuccess (lines 471-519)
  found: Calls store_credential with new username, then set_connection_meta. Both calls are fire-and-forget (.catch(() => {}))
  implication: Both persist correctly to keychain + DB.

- timestamp: 2026-04-01T00:00:01Z
  checked: App.tsx hydration useEffect (lines 43-63)
  found: On startup, loads connection_meta from DB → gets the new username. Populates connectionStore with new meta including new username.
  implication: The store correctly has the new username after reload.

- timestamp: 2026-04-01T00:00:01Z
  checked: ConnectionForm.tsx useEffect (lines 78-94)
  found: When editing, pre-fills PAT/apiToken by calling get_credential(connectionType, initialValues.username). initialValues.username comes from connectionStore (the new username after reload).
  implication: On reload the form tries to fetch the credential under the NEW username from the keychain/file store.

- timestamp: 2026-04-01T00:00:01Z
  checked: keychain.rs file_store::get / OS keychain
  found: Credentials are keyed by "service:username". If the user changed their email from old@co.com to new@co.com, the secret was stored under "pmkar-jira-cloud:new@co.com". But on reload, initialValues.username = "new@co.com", so get_credential("jira-cloud", "new@co.com") SHOULD find it.
  implication: Wait — this path should work. Re-examine.

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx handleEditTestSuccess metaUsername derivation (lines 478-482)
  found: For cloud: metaUsername = credentials.email ?? result.username ?? ''. credentials is the ConnectionForm callback arg which for cloud is { baseUrl, email, apiToken }. So metaUsername = email typed in the form.
  found: store_credential is called with username = metaUsername (new email). set_connection_meta stores metaUsername as the username.
  implication: Keychain and DB both use the new email. On reload, ConnectionForm is initialized with initialValues.username = new email. get_credential(jira-cloud, new_email) should return the secret.

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx source section render (lines 558-608)
  found: ConnectionForm for editing server is rendered with initialValues={{ baseUrl: serverConn?.baseUrl, username: serverConn?.username }}. serverConn.username is populated from hydration (=new username after save). Correct.
  found: BUT — the SettingsPage is only shown after hasSetup=true (App.tsx line 108). When settings opens, serverConn and cloudConn are already in the store from hydration. These are correct.
  implication: Still should work on reload...

- timestamp: 2026-04-01T00:00:01Z
  checked: SetupWizard.tsx handleServerTestSuccess (lines 36-73) vs SettingsPage handleEditTestSuccess
  found: CRITICAL DIFFERENCE. SetupWizard stores the credential under `username` (from result.username). SettingsPage stores under `metaUsername` (credentials.email for cloud, result.username for server). For server: metaUsername = credentials.pat ?? credentials.apiToken — WAIT. No. Let me re-read line 496.
  found: Line 496: secret: credentials.pat ?? credentials.apiToken ?? ''. Username for store_credential for server = metaUsername = result.username. That is correct and consistent with SetupWizard.
  implication: For server, if the user changes the PAT but NOT the username, the key is the same username, so the stored credential is simply overwritten. That should work.

- timestamp: 2026-04-01T00:00:01Z
  checked: SetupWizard vs SettingsPage store_credential username for cloud
  found: SetupWizard line 86: store_credential({ connectionType: 'jira-cloud', username: email, secret: pat }) — email from credentials.email. SettingsPage line 503: store_credential({ connectionType: 'jira-cloud', username: metaUsername, secret: credentials.apiToken }). metaUsername = credentials.email for cloud. Same key.
  implication: Keys match. So a change to email+token should store correctly and be retrievable.

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx — does setEditingConnection(null) at line 518 cause a re-render that destroys the form BEFORE the async store_credential/set_connection_meta calls complete?
  found: store_credential is awaited (await invoke) inside the if/else block at lines 493-504. set_connection_meta is fire-and-forget. setEditingConnection(null) is called at line 518 AFTER await store_credential. So store_credential definitely completes before the form is closed.
  implication: No race condition on the write side.

- timestamp: 2026-04-01T00:00:01Z
  checked: SettingsPage.tsx — when the user changes only the PAT (server) without changing username, then closes settings and reopens. Is initialValues populated from the store (which now has the new meta) or from the OLD meta?
  found: serverConn is read from useConnectionStore at line 256. handleEditTestSuccess calls useConnectionStore.getState().setServerConnection(meta) which updates the store. The next render of the edit form would use the updated store value. But setEditingConnection(null) hides the form after success, so this path isn't relevant.
  implication: Still no obvious bug from this angle.

- timestamp: 2026-04-01T00:00:01Z
  checked: App.tsx — how the edit flow works when user clicks "Edit" on a connection card from the main app (NOT from SettingsPage)
  found: App.tsx line 127-130: onEdit callback sets showSettings=false and setEditStep(connectionType). Line 108: if editStep !== null, shows SetupWizard (not SettingsPage). SetupWizard does NOT pass initialValues to ConnectionForm — no pre-fill from existing meta.
  found: SettingsPage handleEdit (line 467) only sets editingConnection state, which shows the inline ConnectionForm WITH initialValues. This is the correct settings-page edit flow.
  implication: The App.tsx edit flow bypasses SettingsPage entirely and uses SetupWizard — which starts from scratch with empty fields. This means if the user edits via that path, the PAT is empty and they must retype it. But the reproduction says they change via settings page.

- timestamp: 2026-04-01T00:00:01Z
  checked: ConnectionForm.tsx initialValues useEffect — does it run when the component first mounts?
  found: useEffect at lines 78-94 depends on [connectionType, initialValues?.username]. Runs on mount. Fetches credential from keychain and sets pat or apiToken state.
  found: IMPORTANT: The PAT/apiToken field starts as '' (line 69/75). It is then populated asynchronously via this useEffect. If get_credential fails (throws), the catch block at line 92 leaves the field empty with comment "credential not found — leave empty".
  implication: If get_credential fails for any reason, the PAT/email fields appear empty on re-open. This is the "disappear on reload" symptom — not the form values being empty, but specifically the pre-fill failing.

- timestamp: 2026-04-01T00:00:01Z
  checked: Actual root cause focus — when does get_credential fail after a save?
  found: In SettingsPage, when the user changes the email (cloud) or username changes (server), the OLD credential entry in the keychain remains under the old key. The NEW entry is stored under the new username. This is fine for the new session.
  found: BUT: consider the case where the PAT is stored under username="alice" and the user changes only the PAT (not the username). The new PAT is stored under "alice". Old entry is overwritten. Works.
  found: NOW consider: what if result.username from the test differs from what was used as the key originally? For server, store_credential uses username=result.username (from the API response). get_credential on re-open uses initialValues.username which comes from serverConn.username in the store, which was set from the last test result.username. These should match.
  implication: The logic appears internally consistent. Need to look for a divergence.

- timestamp: 2026-04-01T00:00:01Z
  checked: SetupWizard.tsx handleServerTestSuccess — what username is used for store_credential?
  found: Line 41: const username = result.username ?? ''. Line 46: store_credential({ connectionType: 'jira-server', username, secret: pat }). Line 61-70: set_connection_meta with username=result.username.
  found: So the credential is stored under result.username (e.g. "john.doe").
  found: SettingsPage handleEditTestSuccess server path: metaUsername = result.username ?? '' (line 482, server branch). store_credential username = metaUsername. Matches.
  implication: For Server PAT changes: keys are consistent. If the user changes only the PAT, new PAT stored under same username → works on reload.

- timestamp: 2026-04-01T00:00:01Z
  checked: Cloud path specifically — email as key
  found: SetupWizard: store_credential username=email (from credentials.email). set_connection_meta username=email.
  found: SettingsPage: store_credential username=metaUsername=credentials.email. set_connection_meta username=metaUsername=credentials.email.
  found: ConnectionForm initialValues for cloud editing: username=cloudConn?.username which was saved as the email. get_credential is called with this username (email).
  implication: All consistent for cloud too.

- timestamp: 2026-04-01T00:00:01Z
  checked: Actual test flow from reproduction — user changes PAT/email and clicks "test connection" which SUCCEEDS
  found: On success, handleEditTestSuccess stores credential and meta, then calls setEditingConnection(null) to hide form. The in-memory store is updated. Next time user opens settings and clicks edit, ConnectionForm mounts with initialValues from store, fires get_credential to pre-fill.
  found: WAIT — I need to check what happens between test success and the next form open. Does the component unmount and remount? YES — setEditingConnection(null) hides the ConnectionForm. Next edit click shows it again, triggering useEffect fresh.
  implication: The roundtrip should work. But user says it disappears on RELOAD (app restart), not on re-open within the same session.

- timestamp: 2026-04-01T00:00:01Z
  checked: Full reload path: App re-hydrates from get_all_connection_meta → populates store with username. Then user opens settings → edit form shows with initialValues.username from store. get_credential(type, username) called.
  found: The only way this fails is if the keychain entry is not there. When would it not be there? If store_credential was never called, or if it was called with a different key.
  found: ACTUALLY FOUND IT: Looking at SettingsPage handleEditTestSuccess line 493-504 again. For server: await invoke('store_credential', { connectionType: 'jira-server', username: metaUsername, secret: credentials.pat ?? credentials.apiToken ?? '' }). credentials.pat is the PAT from the form. But what is credentials? It's creds as unknown as { baseUrl: string; [key: string]: string }. The original type from ConnectionForm is ServerCredentials = { baseUrl, pat }. So credentials.pat is the PAT value. OK this is fine.
  found: BUT WAIT — line 575-582 in SettingsPage: onTestSuccess={(result, creds) => handleEditTestSuccess('server', result, creds as unknown as { baseUrl: string; [key: string]: string })}. The creds parameter type is Credentials from ConnectionForm which is ServerCredentials | CloudCredentials. The cast to unknown first loses the type. Then in handleEditTestSuccess, credentials.pat is accessed at line 496 — but since credentials is typed as { baseUrl: string; [key: string]: string }, TypeScript allows it. At runtime, creds IS { baseUrl, pat } for server, so credentials.pat has the actual PAT value.
  implication: The PAT value is correctly passed through. Still consistent.

- timestamp: 2026-04-01T00:00:01Z
  checked: Whether set_connection_meta call could fail silently and leave old username in DB
  found: Line 507-516: invoke('set_connection_meta', {...}).catch((err) => console.error(...)). This is fire-and-forget but errors are logged. If this fails, the DB still has the old username. On reload, hydration loads old username. get_credential is called with old username — finds old credential (if it exists). The PAT shown would be the OLD one, not the new one the user just typed.
  found: However, store_credential (which IS awaited) is called BEFORE set_connection_meta. store_credential stores the new secret under the NEW metaUsername. If set_connection_meta fails, the DB has the old username, so on reload get_credential uses the old username → retrieves the OLD secret (from OLD keychain entry which was never deleted). This would cause old credentials to appear.
  found: But the symptom is "disappears" not "shows old value". So this is probably not it either.
  implication: set_connection_meta failure is a possible cause of stale-but-not-empty credentials, not the disappearing symptom.

- timestamp: 2026-04-01T00:00:01Z
  checked: Whether the issue is that changes DON'T disappear but rather the form loads with empty fields specifically because get_credential is failing
  found: The reproduction says "changes disappear on reload" — this could mean: the form pre-fills with empty PAT/token (because get_credential fails), making it look like the changes were lost even though the meta (baseUrl, username) might still be correct in the store.
  found: SCENARIO: User has server connection with username="john" and PAT stored under "john". User edits, changes PAT to new value. metaUsername = result.username from new test (which should still be "john" since it's the same server account). New PAT stored under "john". On reload: ConnectionForm.useEffect fetches get_credential("jira-server", "john") → gets the new PAT. This should work.
  found: DIFFERENT SCENARIO: User has cloud connection with email="old@co.com". Changes email to "new@co.com" AND api token. metaUsername = "new@co.com". store_credential stores new token under "new@co.com". set_connection_meta stores username="new@co.com" in DB. BUT the old keychain entry under "old@co.com" is never deleted (just orphaned). On reload: username="new@co.com" from DB → get_credential("jira-cloud", "new@co.com") → finds the new token. STILL WORKS.
  found: YET ANOTHER SCENARIO specific to the issue: What if the user first sets up via SetupWizard, then tries to edit via SettingsPage — but the credential key used in SetupWizard differs from what SettingsPage uses?
  found: SetupWizard for cloud stores under `email` from credentials. SettingsPage stores under `metaUsername` = `credentials.email`. Same. For server, SetupWizard stores under `result.username`. SettingsPage stores under `result.username`. Same. NO DIFFERENCE.
  implication: Need a different angle. Let me look at what changed in the modified files.

- timestamp: 2026-04-01T00:00:01Z
  checked: git diff to see what actually changed in SettingsPage.tsx and SetupWizard.tsx
  found: These files are marked M in git status. The changes could be the source of the bug.
  implication: Must look at the diff to understand what was recently modified.

## Resolution

root_cause: Cloud credentials were stored in the OS keychain/file store keyed by the user's email address, but connection_meta (the SQLite record) stored result.username (the Jira display name, e.g. "John Doe"). On app reload, App.tsx hydrates the store from connection_meta, giving cloudConnection.username = "John Doe". SettingsPage then passes initialValues.username = "John Doe" to ConnectionForm, which calls get_credential("jira-cloud", "John Doe") — but the secret was stored under the email key, not the display name. The lookup fails silently and the fields appear empty, making settings look lost. The same mismatch existed in both SetupWizard and SettingsPage handleEditTestSuccess.
fix: Align both SetupWizard.handleCloudTestSuccess and SettingsPage.handleEditTestSuccess to use the email address as the username in connection_meta (instead of result.username display name). This ensures the keychain key and the DB lookup key are always the same value. Changes already exist in working tree — SetupWizard uses `username: email` in both store_credential and set_connection_meta; SettingsPage derives `metaUsername = credentials.email ?? result.username ?? ''` for cloud and uses it consistently across store_credential, setCloudConnection meta, and set_connection_meta.
verification: Code trace confirms: after fix, all four paths (setup wizard cloud, setup wizard server, settings edit cloud, settings edit server) use a consistent username key between store_credential and set_connection_meta, so get_credential on reload will always find the stored secret.
files_changed: [src/features/connections/SetupWizard.tsx, src/features/connections/SettingsPage.tsx]
