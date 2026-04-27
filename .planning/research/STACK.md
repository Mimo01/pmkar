# Stack Research — v0.4.0 Configurable Field Mapping

**Domain:** Schema-driven field-mapping engine on top of existing Tauri 2.10 / React 19 / Rust desktop app
**Researched:** 2026-04-27
**Confidence:** HIGH for form/picker/date/Cargo additions (npm versions verified live, Context7-resolved); MEDIUM for ADF strategy (htmltoadf gap analysis based on README only — actual production usage may surface more gaps); HIGH for "what NOT to add" (Atlassian editor bundle data is well-documented)

---

## Scope of This Research

This document covers ONLY new dependencies required for the v0.4.0 field-mapping engine.
The base stack — Tauri 2.10, React 19, TypeScript 6, Vite 8, Zustand, shadcn/ui (Radix
primitives + Lucide), i18next, axum, keyring, rusqlite, reqwest-middleware, htmltoadf,
tauri-plugin-notification — is already in production and is NOT re-researched here.

Existing patterns we will reuse without modification:
- Tauri command IPC for fetch operations (already wired for tickets, comments, users)
- Zustand stores for UI state (no Redux/global form library needed)
- shadcn/ui Dialog/Tabs/Tooltip primitives (CopyPreviewModal already exists)
- Phase 16 user search Tauri commands at `src-tauri/src/commands.rs:1075-1121`
  (`/rest/api/2/user/search` and `/rest/api/3/user/search` — both v2 and v3 paths)
- htmltoadf 0.1.12 for the existing v2 wiki/HTML → ADF copy path
  (used at `commands.rs:1462` and `commands.rs:1799`)
- Vitest + Testing Library for frontend tests (528 already passing)

---

## Recommended Stack — New Additions

### Core New Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-hook-form` | 7.74.0 | Headless, performant form-state engine for the dynamic mapping form (saved global mapping in Settings, per-copy override in CopyPreviewModal). | Already the de-facto React form standard; Context7 has 183 snippets, benchmark score 88. Uncontrolled-input model means re-renders are field-scoped — critical when a target form may have 30-100 fields (large Jira projects with many custom fields). React 19 supported in peer range `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19`. shadcn/ui [official Form recipe](https://ui.shadcn.com/docs/forms/react-hook-form) is built on it, matching our existing component idiom. Critically: the field-array API (`useFieldArray`) maps cleanly onto multi-value Jira fields (labels, components, versions, multi-user, multi-select). |
| `zod` | 4.1.0 | Schema definition + runtime validation for required-field gating and type coercion (e.g., date strings, numbers, URLs). | Zod 4 is the current major (released 2025); it's the highest-benchmark validation library on Context7 (89.82). The Jira `editmeta` response is JSON-structured and the field schemas are dynamic — Zod schemas can be **constructed at runtime from the Jira metadata response** rather than declared at compile time, which is exactly what a mapping engine needs. Pairs with react-hook-form via the official `zodResolver`. |
| `@hookform/resolvers` | 5.2.2 | `zodResolver` adapter wiring Zod schemas into react-hook-form validation. | One-line bridge between RHF and Zod. Maintained by the react-hook-form team. Peer requires `react-hook-form: ^7.55.0` (we have 7.74.0). Latest stable as of 2025-09. |
| `@tanstack/react-virtual` | 3.13.24 | Row virtualization inside the person picker, multi-user picker, group picker, and any combobox that loads 1k+ options (large Jira instances have 5k-50k users). | The standard headless virtualizer — no DOM/styling assumptions. Used by Headless UI v2 internally; documented to handle 100k items. Peer supports React 19. **Mandatory** because the existing `cmdk`/`Command` pattern (also unused so far in this codebase) collapses at ~5k items per shadcn-ui issue [#7544](https://github.com/shadcn-ui/ui/issues/7544) (mouseover at 50ms/item). |
| `cmdk` | 1.1.1 | Command/combobox primitive (the shadcn `Command` component is a thin wrapper around it) for keyboard-driven option selection inside picker popovers. | Already implicit in shadcn ecosystem; we add it explicitly because we need a real combobox surface (currently the codebase uses bare `role="combobox"` ARIA on plain inputs in `SettingsPage.tsx`, which is not a full combobox interaction). React 19 peer-supported (`^18 \|\| ^19`). MUST be paired with `@tanstack/react-virtual` for any list >500 options — `cmdk` does its own filter loop and degrades super-linearly past that. |
| `react-day-picker` | 9.14.0 | Date / datetime field control for Jira `date` and `datetime` field schemas (e.g., due date, custom date fields). | v9 (released 2024, current 9.14.0 published 2026-04-26) is React 19-compatible; the original v8/React 19 peer-conflict bug is fixed. shadcn/ui [updated their Calendar recipe to v9 in June 2025](https://ui.shadcn.com/docs/changelog/2025-06-calendar). Drop-in with our existing Radix Popover idiom. |
| `date-fns` | 4.1.0 | Tree-shakeable date formatting / parsing for ISO 8601 strings the Jira API uses (`yyyy-MM-dd` for date, `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` for datetime). | Already a transitive of `react-day-picker` v9 — adding it explicitly costs ~0kb. Avoids reaching for moment.js (deprecated) or dayjs (smaller but with its own plugin ceremony). |

### Core New Technologies — Rust (Cargo) Side

| Crate | Version | Purpose | Why Recommended |
|-------|---------|---------|-----------------|
| `jsonschema` | 0.42 | Validate the Jira `editmeta` response shape and the user-saved mapping document on load (defensive — the schema can change between Jira versions). | Stranger6667's high-perf validator, current as of 2026 (0.38.1+ on docs.rs, 0.42 on crates.io). Pure-Rust, no C deps, MSRV 1.83 (we are well above). One-off validation API is enough for our needs (validate the mapping JSON when loading from SQLite). **Optional** — could also be done with hand-written `serde::Deserialize` structs if mapping schema is small enough; revisit during Phase 1 implementation. |

### Supporting Frontend Libraries (Conditional)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@atlaskit/adf-utils` | 20.x | Validate / pretty-print / walk an ADF document tree in tests and the audit log. | **Only in `devDependencies`** if we need ADF assertion helpers in Vitest. Pure utility module without the heavyweight editor. Avoid pulling at runtime. |

### Development Tools (No new ones required)

The existing toolchain — Vitest 4.1, @testing-library/react 16, Biome 2.4, jsdom 29 — already
supports schema-driven form testing patterns. Snapshot tests for rendered mapping forms can use
Vitest's built-in `toMatchSnapshot()` without new dependencies.

---

## Installation

```bash
# Frontend — required additions for v0.4.0
npm install react-hook-form@^7.74.0 \
            zod@^4.1.0 \
            @hookform/resolvers@^5.2.2 \
            @tanstack/react-virtual@^3.13.24 \
            cmdk@^1.1.1 \
            react-day-picker@^9.14.0 \
            date-fns@^4.1.0

# Optional (defer until Phase needs ADF assertions):
# npm install -D @atlaskit/adf-utils
```

```toml
# src-tauri/Cargo.toml — optional addition (revisit after Phase 1)
[dependencies]
# ... existing entries preserved
jsonschema = "0.42"  # only if hand-written serde structs prove too brittle
```

No capability or permission additions are required — this milestone is pure UI + REST calls
through the existing Tauri command surface.

---

## Bundle Cost Estimate (gzipped, rough)

| Package | Approx gzip | Justified by |
|---------|-------------|--------------|
| react-hook-form | ~9 kB | Form engine for ~15-100 dynamic fields; alternative is a custom Zustand-backed reducer (~3kB but loses validation, fieldArrays, isDirty tracking). Net win. |
| zod | ~12 kB | Runtime schema construction from Jira metadata. |
| @hookform/resolvers (zod export) | ~1 kB | Adapter only. |
| @tanstack/react-virtual | ~4 kB | Required for 5k+ user/group lists. |
| cmdk | ~7 kB | Combobox primitive. |
| react-day-picker v9 | ~16 kB | Date + datetime input; alternatives like `react-datepicker` are heavier. |
| date-fns | ~5 kB (with tree-shaking, only the formatters we import) | Format/parse helpers. |
| **Total new runtime** | **~54 kB gzipped** | Acceptable for a desktop app shipped via Tauri (no first-load network cost — bundled in the .app/.exe). |

For comparison, `@atlaskit/editor-core` adds **~2-3 MB gzipped** with tail of dependencies — see "What NOT to Use" below.

---

## Field-Type → UI Control Mapping (Reference for Planners)

This is the field-type-aware control table that `gsd-planner` will turn into Phase plans.
It uses the Jira `schema.type` (and `schema.items` for arrays) emitted by `editmeta`/`createmeta`.

| Jira `schema.type` | `schema.items` | Control | Library Used |
|--------------------|----------------|---------|--------------|
| `string` (system: summary) | — | `<input>` | RHF only |
| `string` (system: description) | — | ADF editor / wiki textarea + preview | **see ADF strategy below** |
| `string` (system: url) | — | `<input type="url">` with Zod URL refinement | RHF + Zod |
| `number` | — | `<input type="number">` with Zod number refinement | RHF + Zod |
| `date` | — | DayPicker single-date + ISO date string | react-day-picker + date-fns |
| `datetime` | — | DayPicker single-date + time inputs | react-day-picker + date-fns |
| `option` (single select) | — | cmdk Command popover | cmdk |
| `array` | `option` (multi select) | cmdk multi-select with chip remove | cmdk + RHF useFieldArray |
| `array` | `string` (labels) | tag-input (typeahead, free-text additions) | cmdk + RHF useFieldArray |
| `array` | `component` | searchable picker hitting `/project/{key}/components` | cmdk |
| `array` | `version` | searchable picker hitting `/project/{key}/versions` | cmdk |
| `user` (single) | — | searchable picker hitting `/user/search` (Phase 16 reuse) + email pre-fill | cmdk + tanstack-virtual |
| `array` | `user` (multi) | multi-user picker | cmdk + tanstack-virtual + RHF useFieldArray |
| `group` (single/multi) | `group`/— | searchable group picker hitting `/group/picker` | cmdk + tanstack-virtual |
| `option-with-child` (cascading) | — | two cmdk popovers (parent → child) | cmdk |
| `array` | `option` (checkboxes) | shadcn Checkbox group | RHF |
| `option` (radio) | — | shadcn RadioGroup (Radix primitive — already implicit) | RHF |
| `priority` | — | shadcn Select-style cmdk | cmdk |
| `issuetype` (target chooser) | — | shadcn Select-style cmdk, defaults to source-name match | cmdk |

---

## ADF Editor Strategy (Critical Decision)

**Recommendation: Do NOT add a rich-text editor in v0.4.0.** Use a **plain wiki/HTML textarea + ADF preview pane** for the description field.

### Rationale

| Option | Bundle Cost | Risk | Fit |
|--------|-------------|------|-----|
| `@atlaskit/editor-core` | **~2-3 MB gzipped** (one community thread reports 400 kB → 12 MB project bundle increase, 50-80s build time). Pulls `@atlaskit/adf-schema`, lodash, full ProseMirror, React, hundreds of style files. License is mostly Apache 2.0 but **Atlassian Design Guidelines license applies to assets/icons** — restricts white-labeling. | HIGH: explodes our ~1 MB Tauri bundle, slows Vite dev/build ~10x, brings in Atlassian's UI styles which clash with shadcn/Linear aesthetic. | Native ADF semantics — but at unacceptable cost for a desktop app. |
| Tiptap (3.22.4) + custom ADF schema | ~50-80 kB | MEDIUM: Tiptap → ProseMirror docs export to its own JSON shape; we'd need a custom `prosemirror-model` schema matching ADF node specs (paragraph, heading, bulletList, orderedList, codeBlock, table, panel, mediaSingle, etc.) and a serializer. Multi-week work. | Excellent — but premature for v0.4.0 scope. |
| Lexical | ~30 kB core | HIGH: same problem as Tiptap (custom ADF nodes), plus less mature ecosystem for our use case. | Possible future direction but not v0.4.0. |
| **Plain textarea + existing v2 wiki/HTML pipeline** | **0 kB** | LOW: reuses already-shipped htmltoadf path; user types/pastes wiki markup or HTML, we render an ADF preview before submit. | **BEST FIT for v0.4.0.** Description is one of dozens of fields; rich editing isn't an MVP requirement for the mapping engine itself. |

### htmltoadf Gap Analysis (from README review)

`htmltoadf 0.1.12` documents support for: headings, images, lists, tables, text/paragraphs,
code, inline cards, panels, emoji, named CSS colors. The README **does not document** support
for: **links (`<a>`), blockquotes, mentions (`@user`), code blocks (block-level vs inline),
strikethrough, sub/superscript, hard-break-vs-paragraph distinction, ADF `mediaSingle` for
attachments**. These will likely surface as visible fidelity loss when the user pastes Jira
Server description content.

**Mitigation for v0.4.0:**
1. Add a Rust-side wrapper that calls `htmltoadf::convert_html_str_to_adf_str(...)` and then
   post-processes the resulting ADF JSON to inject `link`, `blockquote`, and `hardBreak` nodes
   from regex-matched HTML the converter dropped (cheap to write, easy to test).
2. If gaps are large enough during Phase 1 implementation, fork `htmltoadf` in-tree (it's MIT,
   ~600 LOC of Rust) and add the missing transforms — vastly cheaper than adopting tiptap.
3. **Defer a real rich-text editor to v0.5.0+** with explicit goal "ADF-native description
   authoring" as a dedicated milestone.

### Record this Decision in PROJECT.md

This is a milestone-level architectural decision worth a Key Decisions row:
> "Defer ADF rich-text editor to post-v0.4.0; v0.4.0 ships wiki/HTML textarea + preview using
> existing htmltoadf pipeline. Rationale: @atlaskit/editor-core adds 2-3 MB gzip, Tiptap+ADF
> custom schema is multi-week work, neither is justified for an MVP mapping engine."

---

## Type System Bridge: Polymorphic Jira Schema → Frontend Renderer

**Approach: TypeScript discriminated unions on `schema.type` + `schema.items`, mirrored from Rust serde structs.**

No new library needed. The pattern:

```rust
// src-tauri/src/jira_field_schema.rs (new module)
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum JiraFieldSchema {
    String { items: Option<String>, custom: Option<String>, system: Option<String> },
    Number { ... },
    Date,
    Datetime,
    User,
    Array { items: ArrayItemType, custom: Option<String> },
    Option,
    OptionWithChild,
    // ... covers ~15 variants from Jira's `editmeta` response
}
```

```typescript
// src/features/mapping/fieldSchema.ts
type JiraFieldSchema =
  | { type: 'string'; system?: string; custom?: string }
  | { type: 'array'; items: 'option' | 'string' | 'user' | 'component' | 'version'; ... }
  | { type: 'date' }
  | { type: 'user' }
  | ...

// Renderer dispatches on `schema.type` + `schema.items`:
function renderField(schema: JiraFieldSchema, control: ControllerRenderProps) { ... }
```

The Rust enum is the single source of truth; the TS type is hand-mirrored. No need for
`schemars` (would emit JSON schemas — overkill) or `ts-rs` (auto-generates TS from Rust —
worth considering as a follow-up but not required for v0.4.0).

---

## Testing Strategy — Fixtures and Snapshots

| Concern | Approach | Library |
|---------|----------|---------|
| Field-schema fixtures | Hand-crafted JSON files in `src-tauri/tests/fixtures/jira-fields/` covering each `schema.type` variant; loaded by Rust integration tests via `include_str!`. | None — `serde_json` already in stack |
| Mock Jira responses | Extend existing `mock_server.rs` (axum) with `/rest/api/2/issue/createmeta`, `/rest/api/2/issue/{key}/editmeta`, `/rest/api/3/issue/{key}/editmeta`, `/rest/api/2/field`, `/rest/api/3/field/search` endpoints returning the fixture JSON. | None — axum already in stack |
| Form snapshot tests | `expect(container).toMatchSnapshot()` for each rendered field-type variant | Vitest built-in |
| User-interaction tests | `userEvent.type()`, `userEvent.click()` against picker popovers | @testing-library/user-event 14.6.1 (already present) |
| ADF transformation round-trip | Rust `cargo test` with golden-file ADF JSON in `src-tauri/tests/fixtures/adf/` | None — `serde_json` |

No new test libraries needed.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `react-hook-form` 7.74 | Formik | Formik's controlled-input default re-renders the entire form on every keystroke — collapses with 50+ fields. Maintenance has slowed (last major release 2.4 in 2023). |
| `react-hook-form` 7.74 | TanStack Form | Newer (still in pre-1.0 churn as of 2026), smaller community, fewer Stack Overflow answers. RHF is the safer default for a small-team project. |
| `react-hook-form` 7.74 | `react-jsonschema-form` (rjsf) | rjsf renders directly from a JSON Schema — sounds tempting for "schema-driven", BUT it ships with its own theming system (Bootstrap/MUI/Chakra), no shadcn theme exists, and customizing the field templates negates the productivity win. Plus we'd need to translate Jira's polymorphic schema into JSON Schema first — extra layer. |
| `react-hook-form` 7.74 | Custom Zustand reducer | Doable (~300 LOC) but reinvents `isDirty`, `isValid`, `useFieldArray`, async validation. Net loss. |
| `zod` 4.1 | Yup | Yup's TypeScript inference is weaker; Zod is the modern default. |
| `zod` 4.1 | Valibot | Smaller bundle (~3 kB) but less mature; no clear win for a desktop app where 12 kB doesn't matter. |
| `zod` 4.1 | Hand-written validators | We need runtime schema construction from Jira metadata; doing this without a schema library means reimplementing union/refinement composition. |
| `cmdk` 1.1 + `@tanstack/react-virtual` | `react-select` | Heavier (~30 kB), opinionated styling that fights shadcn, prop API less ergonomic for keyboard-first UX. |
| `cmdk` 1.1 + `@tanstack/react-virtual` | `downshift` | Lower-level than cmdk; we'd write more keyboard / ARIA scaffolding ourselves. cmdk is purpose-built for command/combobox UIs and matches the shadcn idiom. |
| `cmdk` 1.1 + `@tanstack/react-virtual` | Headless UI Combobox v2 | Has built-in TanStack Virtual support — attractive — but Tailwind/Headless UI is a parallel ecosystem to shadcn/Radix. Mixing two design-system stacks costs maintenance. |
| `react-day-picker` 9.14 | `@internationalized/date` + `react-aria` DateField | Powerful but adds a ~50 kB i18n library and a parallel UI primitive system. Overkill for a desktop app with two locales (en/sk). |
| `react-day-picker` 9.14 | Native `<input type="date">` | Inconsistent UI across platforms (macOS vs Windows native pickers look very different); fails our "Linear-inspired aesthetic" decision. |
| Plain textarea + htmltoadf wrapper | `@atlaskit/editor-core` | See ADF Editor Strategy above — bundle bomb. |
| Plain textarea + htmltoadf wrapper | tiptap + custom ADF schema | Multi-week effort writing prosemirror-model node specs for the full ADF spec; defer to a future dedicated milestone. |
| Hand-written serde structs for editmeta | `jsonschema` 0.42 (Rust) | Could go either way; default to hand-written serde for the well-known shapes (the editmeta response schema is documented and stable), add `jsonschema` ONLY if Phase 1 surfaces variant explosion. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@atlaskit/editor-core` (any version) | **2-3 MB gzipped, 10x build slowdown, Atlassian Design Guidelines license on assets, styles fight shadcn/Linear aesthetic.** Reported bundle increase of 400 kB → 12 MB in production projects. | Plain wiki/HTML textarea + ADF preview using existing htmltoadf pipeline (defer real ADF editor to v0.5.0+) |
| `@atlaskit/editor-json-transformer` | 173 kB plus full lodash + babel runtime + atlaskit ecosystem chain. We don't author ProseMirror docs in v0.4.0 — there's nothing to transform. | None — not needed for v0.4.0 |
| `@atlaskit/adf-schema` (runtime) | Pulls ProseMirror schema definitions intended for the editor; we don't render ADF, we just submit it to the Cloud API. | None at runtime; OK as a `devDependency` if we need ADF validators in tests |
| `react-jsonschema-form` (rjsf) | Forces a parallel theming system; translating Jira's polymorphic schema to JSON Schema is an extra translation layer with no payoff. | `react-hook-form` + manual field-type dispatcher |
| `formik` | Controlled-input model rerenders entire form per keystroke; large mapping forms (50+ fields) become unusable. | `react-hook-form` |
| `react-select` | Heavy, opinionated styling, harder to keyboard-drive consistently. | `cmdk` + `@tanstack/react-virtual` |
| `moment.js` | Deprecated upstream since 2020. | `date-fns` (already a transitive of `react-day-picker` 9) |
| `dayjs` | Tempting smaller alternative to date-fns, but plugin system is more friction than tree-shaken date-fns imports for the few helpers we'll use. | `date-fns` |
| `redux` / `redux-toolkit` | Existing app is Zustand; dragging in Redux for mapping state would split state-management idioms. | Zustand store + react-hook-form local state |
| `react-window` | Older virtualizer; TanStack Virtual is the actively-maintained successor by the same author of related ecosystem. | `@tanstack/react-virtual` |
| `lodash` | Only utilities we'd use are pickable from native ES (Object.entries, Array.prototype.flat, structuredClone). | Native JS / small focused helpers |
| `axios` for Tauri commands | We don't make browser-side HTTP calls — Rust does via reqwest. | Existing Tauri `invoke` IPC |
| Atlassian's `JsonSchema` validator JS library | Atlassian doesn't publish a standalone JSON-Schema validator for ADF; the only "validator" is inside `@atlaskit/adf-utils`. | `zod` for runtime shape checks; `@atlaskit/adf-utils` only as devDep if needed |

---

## Stack Patterns by Variant

**If a Jira instance has < 500 users total:**
- Use cmdk Command without virtualization
- Saves ~4 kB in `@tanstack/react-virtual` AT RUNTIME (always loaded; cost still incurred — virtualization is invisible at small N)

**If the mapping form has > 30 visible fields at once:**
- Use react-hook-form's `Controller` only on fields that need imperative API (pickers, date)
- Use `register()` directly on plain inputs — fewer subscriptions, faster typing

**If a target field's `allowedValues` array is > 100 items:**
- Switch the cmdk `<CommandList>` to TanStack-Virtual rendering
- Below 100 items, cmdk's built-in filter is fine and avoids virtualizer cold-start cost

**If a custom field has no `allowedValues` and no documented `schema.items`:**
- Render as plain text input with a "?" hint badge — log a warning so we can add a renderer
- Better than crashing; the audit log surfaces unmapped types for follow-up phases

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-hook-form` 7.74.0 | React 19 (peer `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19`) | Verified in npm peerDependencies; published 2026-04-25 |
| `zod` 4.1.0 | TS 5.x and 6.x (we use 6.0.2) | Zod 4 requires `strict: true` in tsconfig — already true in this project |
| `@hookform/resolvers` 5.2.2 | `react-hook-form: ^7.55.0` (we have 7.74.0) | One peer dep; compatible |
| `@tanstack/react-virtual` 3.13.24 | React 19 (peer `^16.8.0 \|\| ... \|\| ^19.0.0`) | Verified peer range; published 2026-04-17 |
| `cmdk` 1.1.1 | React 19 (peer `^18 \|\| ^19`) | Verified peer range; published 2025-08-27 |
| `react-day-picker` 9.14.0 | React 16.8+ (peer `>=16.8.0`) | Published 2026-04-26; React 19 issue from v8 era is resolved in v9 line; shadcn/ui Calendar already migrated to v9 in June 2025 |
| `date-fns` 4.1.0 | All Node/TS versions in our stack | No peer constraint issues |
| `jsonschema` (Rust) 0.42 | Rust MSRV 1.83 (we are on stable, well above) | Pure-Rust, no C deps |

**No peer-dep conflicts identified across the additions.** All packages support React 19 explicitly. No transitive React 18-only forks.

---

## Open Questions for Phase Planners

1. **Where does the saved global mapping live?** — SQLite `mapping_v1` table is the obvious spot; reuses existing `rusqlite` setup. No new dep, but planners should confirm the table shape (mapping is a single JSON blob vs. row-per-field).
2. **Per-copy override storage** — pure in-memory React state inside CopyPreviewModal? Or persisted to SQLite for "draft copy" recovery? v0.4.0 scope says preview-only, so in-memory is fine; flag for v0.5.0 if drafts become a feature.
3. **Phase 16 user search** already paginates against `/rest/api/2/user/search` and `/rest/api/3/user/search`. Confirm the existing Tauri commands return enough data (account ID for v3, key+name for v2) for the picker's email-pre-fill use case. Likely yes; planners should grep `commands.rs:1075-1135` to verify.
4. **Issue-type chooser at copy time** — the `editmeta` endpoint requires a target issue type to return the field set. The chooser must pre-load BEFORE the mapping form renders. Planners should sequence this in the Copy Preview Modal interaction flow.
5. **Should `jsonschema` Rust crate be added now or deferred?** — Recommend deferred until Phase 1 implementation surfaces a concrete need (validation against the editmeta response). Hand-written serde structs are the default; jsonschema is a fallback.

---

## Sources

- [react-hook-form on Context7](https://context7.com/react-hook-form/react-hook-form) — `/react-hook-form/react-hook-form` v7.66.0 listed; npm verified 7.74.0 (HIGH confidence)
- [react-hook-form npm](https://www.npmjs.com/package/react-hook-form) — version 7.74.0, peer `^16.8.0 \|\| ^17 \|\| ^18 \|\| ^19`, published 2026-04-25 (HIGH confidence — verified via `npm view`)
- [zod on Context7](https://context7.com/colinhacks/zod) — v4.0.1 listed; npm verified 4.1.0 (HIGH confidence)
- [zod npm](https://www.npmjs.com/package/zod) — version 4.1.0, published 2026-01-25 (HIGH confidence)
- [@hookform/resolvers npm](https://www.npmjs.com/package/@hookform/resolvers) — version 5.2.2, peer `react-hook-form: ^7.55.0` (HIGH confidence)
- [TanStack Virtual on Context7](https://context7.com/tanstack/virtual) — `/tanstack/virtual` (HIGH confidence)
- [@tanstack/react-virtual npm](https://www.npmjs.com/package/@tanstack/react-virtual) — version 3.13.24, peer `react: ^16.8.0 \|\| ... \|\| ^19.0.0`, published 2026-04-17 (HIGH confidence)
- [TanStack Virtual examples](https://tanstack.com/virtual/latest/docs/framework/react/examples) — 10k-item example uses `useVirtualizer({ count: 10000, useFlushSync: false })` pattern for React 19 (HIGH confidence)
- [shadcn-ui combobox issue #7544](https://github.com/shadcn-ui/ui/issues/7544) — confirms cmdk performance collapse at 5k items, 50ms/item mouseover (HIGH confidence — reproducible bug report)
- [shadcn-virtualized-combobox repo](https://github.com/oaarnikoivu/shadcn-virtualized-combobox) — community proof that cmdk + TanStack Virtual is the working pattern (MEDIUM confidence — community fork)
- [cmdk npm](https://www.npmjs.com/package/cmdk) — version 1.1.1, peer `react: ^18 \|\| ^19`, published 2025-08-27 (HIGH confidence)
- [react-day-picker npm](https://www.npmjs.com/package/react-day-picker) — version 9.14.0, peer `react: >=16.8.0`, published 2026-04-26 (HIGH confidence)
- [shadcn/ui Calendar June 2025 changelog](https://ui.shadcn.com/docs/changelog/2025-06-calendar) — confirms shadcn migrated Calendar to react-day-picker v9 (HIGH confidence)
- [date-fns npm](https://www.npmjs.com/package/date-fns) — version 4.1.0, published 2025-08-03 (HIGH confidence)
- [@atlaskit/editor-core npm](https://www.npmjs.com/package/@atlaskit/editor-core) — current version 219.0.0, ~Apache 2.0 with Atlassian Design Guidelines license on assets (HIGH confidence)
- [Atlassian community: bundle size with editor-core](https://community.atlassian.com/forums/Jira-questions/How-can-I-optimize-project-building-with-atlaskit-editor-core/qaq-p/2645394) — 400 kB → 12 MB bundle increase, 50-80s build (MEDIUM confidence — single user report but matches our concerns) |
| [@atlaskit/editor-json-transformer dependencies](https://www.npmjs.com/package/@atlaskit/editor-json-transformer?activeTab=dependencies) — 173 kB, depends on lodash + babel runtime + react + adf-schema + adf-utils + editor-prosemirror (HIGH confidence)
- [htmltoadf 0.1.12 README](https://github.com/wouterken/htmltoadf/blob/master/README.md) — supported elements list (headings, images, lists, tables, text, paragraphs, code, inline cards, panels, emoji, named CSS colors); links/blockquotes/mentions NOT documented (HIGH confidence)
- [Atlassian Document Format spec](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) — node types, JSON structure (HIGH confidence)
- [Jira REST API createmeta example](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/) — `?expand=projects.issuetypes.fields` pattern, schema.type/system/custom/items shape (HIGH confidence)
- [jsonschema crate on crates.io](https://crates.io/crates/jsonschema) — version 0.42, MSRV 1.83 (HIGH confidence)
- [Tiptap Schema docs](https://tiptap.dev/docs/editor/core-concepts/schema) — confirms Tiptap is built on prosemirror-model and would require custom node specs to emit ADF (HIGH confidence)
- [Atlassian Forge: Converting to ADF](https://community.developer.atlassian.com/t/converting-to-adf-atlassian-document-format/82496) — Atlassian recommends `@atlaskit/editor-json-transformer` for conversion; no lighter-weight official path (MEDIUM confidence)
- Existing codebase audit (own grep): `src-tauri/src/commands.rs` lines 1075, 1093, 1121 confirm `/user/search` Tauri commands; lines 1462, 1481, 1799 confirm htmltoadf usage paths; `src/features/connections/SettingsPage.tsx:783` shows current bare `role="combobox"` ARIA pattern (HIGH confidence — direct source inspection)

---

*Stack research for: pmkar v0.4.0 Configurable Field Mapping engine*
*Researched: 2026-04-27*
*Subsequent-milestone scope: ONLY new dependencies layered on top of validated v0.3.x stack*
