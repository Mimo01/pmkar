# Phase 20: Renderer Registry + Field-Type-Aware Controls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 20-renderer-registry-field-type-aware-controls
**Areas discussed:** User picker coupling, DynamicTargetForm scope, Option picker data source, Registry key scheme

---

## User Picker Coupling

**Q1: How should the user/array<user> renderer get its search data?**

| Option | Description | Selected |
|--------|-------------|----------|
| onSearch callback prop | Renderer accepts onSearch: (q: string) => Promise<JiraUser[]>. Phase 22 injects invoke. Unit-testable in isolation. | ✓ |
| Direct invoke inside renderer | Calls invoke('search_jira_users') directly, same as TicketFilterBar. Simpler but hard to test. | |
| Default prop calls invoke, override for tests | Middle ground; creates Tauri coupling at module level. | |

**User's choice:** onSearch callback prop
**Notes:** Chose for testability (ROADMAP SC #4 — testable in isolation) and clean Phase 22 handoff.

---

**Q2: For array<user>, how should partial selections work when one user can't be resolved?**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep resolved + show gap slot | Phase 22 injects unresolved chip alongside renderer. Renderer stays simple. | ✓ |
| Renderer handles unresolved display | MultiUserPickerRenderer renders an extra "search manually" chip per gap. | |

**User's choice:** Keep resolved + show gap slot
**Notes:** Phase 20 renderer stays simple; Phase 22 handles UnresolvedPerson variants.

---

**Q3: Should Phase 20 include pre-fill logic for email-match?**

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 20 accepts initialQuery prop, Phase 22 provides it | UserPickerRenderer auto-triggers onSearch(initialQuery) on mount. Renderer is dumb about origin. | ✓ |
| Phase 22 pre-fills entirely, Phase 20 just renders | Phase 22 sets value programmatically after resolving email. More work in Phase 22. | |

**User's choice:** Phase 20 accepts initialQuery prop, Phase 22 provides it
**Notes:** Cleaner boundary — renderer exposes the mechanism, Phase 22 provides the data.

---

## DynamicTargetForm Scope

**Q1: What does Phase 20 ship beyond individual renderer components + the registry?**

| Option | Description | Selected |
|--------|-------------|----------|
| Renderers + registry + DynamicTargetForm shell | Stateless form shell: fields, values, onChange. Phase 22 adds Tauri wiring + required-field gating. | ✓ |
| Renderers + registry only | Phase 22 builds DynamicTargetForm from scratch. More work in Phase 22. | |
| Full form with value state management | useState inside DynamicTargetForm. Phase 22 lifts state. Creates refactor seam. | |

**User's choice:** Renderers + registry + DynamicTargetForm shell
**Notes:** The shell gives Phase 22 a clean extension point without a refactor.

---

**Q2: DynamicTargetForm needs async search callbacks — how does it get them?**

| Option | Description | Selected |
|--------|-------------|----------|
| Prop bag: searchCallbacks object | searchCallbacks?: { onSearchUsers?, onFetchComponents?, onFetchVersions? }. Phase 22 populates with real invokes. | ✓ |
| Each renderer gets all callbacks | Pass all async fns directly to each renderer as optional props. Less type-safe. | |

**User's choice:** Prop bag: searchCallbacks object
**Notes:** Single well-typed interface; Phase 22 fills it, tests mock it.

---

**Q3: Where does DynamicTargetForm live?**

| Option | Description | Selected |
|--------|-------------|----------|
| src/features/field-renderers/ | Clean ownership — Phase 21 and Phase 22 both import from here. | ✓ |
| src/features/tickets/ | Co-located with CopyPreviewModal. Conflates shared infra with specific feature. | |
| src/components/field-renderers/ | Treat as shared UI. Jira-domain-specific — features/ fits better. | |

**User's choice:** src/features/field-renderers/
**Notes:** Both Phase 21 (Mapping Editor) and Phase 22 (Copy Preview) will import from here.

---

## Option Picker Data Source

**Q1: Where do option/component/version pickers get their list of choices?**

| Option | Description | Selected |
|--------|-------------|----------|
| Static allowedValues from FieldSchema | All pickers except user use allowedValues already fetched by Phase 17 discovery. No async. | ✓ |
| fetchOptions callback for all pickers | Hybrid: static for options, async via callbacks for components/versions. | |
| Always async via callbacks | Uniform interface but adds async complexity for already-available data. | |

**User's choice:** Static allowedValues from FieldSchema
**Notes:** Phase 17 already fetches this data; no need for extra async machinery.

---

**Q2: When does virtualization kick in?**

| Option | Description | Selected |
|--------|-------------|----------|
| Always virtualize pickers | One code path, cmdk + @tanstack/react-virtual used consistently. | ✓ |
| Virtualize only when allowedValues.length > 500 | Two render paths — simple dropdown vs virtualized combobox. | |

**User's choice:** Always virtualize pickers
**Notes:** One code path, no conditional branching. ROADMAP SC #3 already mandates cmdk + @tanstack/react-virtual.

---

**Q3: How should the virtualized combobox shell be shared?**

| Option | Description | Selected |
|--------|-------------|----------|
| Shared VirtualizedCombobox base component | VirtualizedCombobox<T> in field-renderers/components/. Each picker wraps it with domain props. | ✓ |
| Each picker implements its own virtualization | Self-contained but duplicates cmdk/react-virtual wiring across renderers. | |

**User's choice:** Shared VirtualizedCombobox base component
**Notes:** Single place to fix virtualization bugs; all pickers benefit immediately.

---

## Registry Key Scheme

**Q1: How should getRenderer discriminate array<user> vs array<option>?**

| Option | Description | Selected |
|--------|-------------|----------|
| getRenderer(schema) function | Discriminates on type + items + system internally. DynamicTargetForm always calls getRenderer(field.schema) — never branches on type. | ✓ |
| Composite string key ('array:user', etc.) | Plain object map keyed by computed strings. Requires key-builder function anyway. | |
| Both: map as primary, getRenderer as helper | Two APIs to maintain. Extra surface area. | |

**User's choice:** getRenderer(schema) function
**Notes:** Clean call site in DynamicTargetForm; discrimination stays in one file (registry.ts).

---

**Q2: The 'string' type covers text, multi-line, and URL — how should getRenderer distinguish them?**

| Option | Description | Selected |
|--------|-------------|----------|
| Use schema.system discriminant | system === 'description' → TextAreaRenderer, system === 'url' → UrlRenderer, default → StringRenderer. Phase 17's type already carries this field. | ✓ |
| DynamicTargetForm passes a fieldId hint | getRenderer receives (schema, fieldId) and uses well-known IDs. Couples renderer selection to field IDs. | |
| Single StringRenderer handles all string variants | Internal branching in one component. Harder to test each variant. | |

**User's choice:** Use schema.system discriminant
**Notes:** Existing FieldSchemaType already has system?: string — the field is there, use it.

---

**Q3: getRenderer has a switch-statement — is that a problem for ROADMAP SC #4?**

| Option | Description | Selected |
|--------|-------------|----------|
| getRenderer owns the switch — that's fine | The constraint is about DynamicTargetForm. getRenderer is the one allowed switch. New type = new file + one case. | ✓ |
| Data-driven list of { match, renderer } | More abstract but arguably over-engineered for 15-20 types. | |

**User's choice:** getRenderer owns the switch — that's fine
**Notes:** SC #4 says "never a switch-statement edit in DynamicTargetForm" — getRenderer is the sanctioned extension point.

---

## Claude's Discretion

- Exact TypeScript generics for `VirtualizedCombobox<T>` internal hook wiring
- Whether `RendererProps` is one unified interface or per-renderer-type interfaces
- Exact cmdk + @tanstack/react-virtual row height and overscan settings
- Whether `SearchCallbacks` interface lives in `types.ts` or `DynamicTargetForm.tsx`
- Debounce timing for user search (likely 300ms matching TicketFilterBar pattern)
- Exact label and style for `UnsupportedTypeRenderer` pill

## Deferred Ideas

- **UnresolvedPerson gap chips in Phase 20**: Deferred to Phase 22 (D-02). Renderer stays simple.
- **Storybook for renderer visual catalog**: Not in the project; adding it is a separate decision.
- **Per-copy-session version/component cache in renderer**: Phase 20 uses static allowedValues; live refresh deferred to Phase 22 if needed.
