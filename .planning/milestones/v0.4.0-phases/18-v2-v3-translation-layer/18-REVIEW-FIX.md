---
phase: 18-v2-v3-translation-layer
fixed_at: 2026-04-27T21:00:00Z
review_path: .planning/phases/18-v2-v3-translation-layer/18-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-04-27T21:00:00Z
**Source review:** .planning/phases/18-v2-v3-translation-layer/18-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical, 3 Warnings)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Single isolated `[~username]` mention is silently dropped

**Files modified:** `src-tauri/src/field_transform/wiki_to_adf.rs`
**Commit:** 54922de
**Applied fix:** Introduced `only_text_node` boolean that checks whether the single
replacement node has `type == "text"`. The in-place rewrite branch (which assumed
the replacement was always a text node) is now gated on this condition. When the
single replacement node is a mention node (entire text was `[~username]` with no
prefix/suffix), the code falls through to the existing splice path which correctly
removes the original text node and inserts the mention node. The WR-03 dead-variable
removal was also applied in this commit (same file).

### WR-01: `no_domain` fallback TRAN-06 claim is misleading

**Files modified:** `src-tauri/src/field_transform/user.rs`
**Commit:** 31e642a
**Applied fix:** Expanded the module docstring to explicitly document that TRAN-06
(one HTTP call per unique domain) applies only to the domain-based path (step 4).
The no-domain fallback (step 5) is documented as issuing one HTTP call per username
with a note that this is uncommon but can occur with multiple description-only
mentions. This avoids a future developer silently depending on a TRAN-06 guarantee
that does not hold for the fallback path. The UserResolver pub(crate) field change
(WR-02) was also applied in this commit (same file).

### WR-02: Public fields on resolver structs expose mutable credential strings

**Files modified:** `src-tauri/src/field_transform/user.rs`, `src-tauri/src/field_transform/version.rs`, `src-tauri/src/field_transform/component.rs`
**Commit:** 0ec79b8 (version.rs + component.rs), 31e642a (user.rs, included with WR-01)
**Applied fix:** Changed `pub` to `pub(crate)` on `client`, `cloud_auth`,
`cloud_base_url`, and `cache` fields of `UserResolver`, `VersionResolver`, and
`ComponentResolver`. Verified no external crate access exists (grep confirmed all
field accesses are via `self.` within the same module). `cargo check` passes.

### WR-03: `effective_in_code` dead variable creates misleading code

**Files modified:** `src-tauri/src/field_transform/wiki_to_adf.rs`
**Commit:** 54922de (included with CR-01, same file)
**Applied fix:** Removed the `inline_code` and `effective_in_code` variables
entirely from `walk_adf_node_mut`. The final `let _ = effective_in_code;` discard
line was also removed. A clarifying comment was added at the splice call site
noting that `splice_mentions_in_content_array` independently handles the code-mark
check (Pitfall F), so no additional gating is needed at the walker level.

---

_Fixed: 2026-04-27T21:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
