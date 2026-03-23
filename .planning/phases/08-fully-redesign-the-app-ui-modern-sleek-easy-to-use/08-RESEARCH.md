# Phase 8: Fully Redesign the App UI — Modern, Sleek, Easy to Use - Research

**Researched:** 2026-03-24
**Domain:** React 19 + Tailwind v4 + shadcn/ui frontend redesign (Tauri desktop)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Minimal & clean aesthetic — Linear-inspired. Lots of whitespace, subtle borders, muted neutral colors, typography-driven hierarchy
- **D-02:** Brand red (#c02232) used as accent only — not dominant. Neutral grays carry the UI
- **D-03:** Linear is the primary design reference — ultra-clean, fast transitions, keyboard-aware feel
- **D-04:** Keep current top tab navigation pattern (header + horizontal tabs below). Refine styling, spacing, and transitions — don't restructure
- **D-05:** Settings and Audit Log remain as overlay pages (replace main content, close to return). Polish the UI of both pages
- **D-06:** Header retains pmkar branding, debug icon, and gear icon — refine icon sizing and spacing
- **D-07:** Switch from sortable table to card list layout. Each ticket is a card — more visual, richer per-item display
- **D-08:** Compact 3-line card: ticket key + relative time (top row), summary text (middle), status dot + priority + assignee (bottom metadata row)
- **D-09:** Cards should have subtle hover effect, clean borders, and good spacing between cards
- **D-10:** Switch from side panel to full-page detail view. Clicking a ticket navigates to a full-width detail page with a back button
- **D-11:** Full-page detail gives more room for description, comments, attachments, and copy actions
- **D-12:** Back button returns to the ticket list preserving the current tab context
- **D-13:** Adopt shadcn/ui — copy-paste Radix-based components styled with Tailwind. Components live in src/components/ui/
- **D-14:** Replaces existing custom components (AppShell, StatusBadge, ErrorBoundary) with shadcn/ui equivalents where applicable
- **D-15:** Lucide React for icons — replaces all hand-coded inline SVGs (GearIcon, TerminalIcon, ChevronIcon, SpinnerIcon)
- **D-16:** Settings page: redesign from current crowded sidebar+form layout to a cleaner, more spacious section-based layout
- **D-17:** Ticket list: fix spreadsheet feel — more breathing room, card-based layout solves this
- **D-18:** Copy modals (preview/result): redesign to feel less boxy, improve progress visualization during copy operations
- **D-19:** Empty states & loading: polish loading indicators and empty state messages — more refined than basic spinners

### Claude's Discretion

- Exact shadcn/ui components to install (Button, Card, Dialog, Tabs, etc.)
- Animation/transition library choice (CSS transitions, Framer Motion, or native)
- Card hover effects and selection state styling
- Detail page layout structure and tab organization
- Settings page section ordering and spacing
- Loading skeleton vs spinner approach
- Color palette refinements within the minimal/clean direction
- Typography scale and font choices (system font stack or custom)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

## Summary

Phase 8 is a pure frontend visual overhaul — no backend changes, no new Tauri IPC commands. The project already uses React 19, Tailwind v4, Zustand, and react-i18next. The core task is: install shadcn/ui (v2, Tailwind v4 mode), install Lucide React, and systematically replace or redesign every visual surface.

The most structurally significant changes are two: (1) replacing the three sortable tables (TicketTable, IgnoredTicketsPage, LinkedTicketsPage) with a card-list component, and (2) replacing the side-panel detail view (TicketDetailPanel) with a full-page detail view that requires routing state in App.tsx. Both require new components, not just styling changes. All other work — AppShell polish, Settings redesign, Copy modal redesign, empty states, icon replacement — is primarily styling within existing component boundaries.

The UI-SPEC.md (08-UI-SPEC.md) is the canonical design contract and is already fully specified. Research confirms the technical approach is correct. The main planning concern is decomposing 13 source files into a sensible wave sequence that avoids visual fragmentation during execution.

**Primary recommendation:** Initialize shadcn (Tailwind v4 mode) in Wave 0, install all 10 components, install Lucide React — then work surface by surface. AppShell first (it wraps everything), cards second (shared across three tabs), full-page detail third (requires App.tsx state change), then modals and settings.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui | npx shadcn@latest (CLI 2.x) | Copy-paste Radix-based components | Locked — CONTEXT.md D-13. Zero runtime dep, components owned in-repo, works with Tailwind v4 |
| lucide-react | 0.454+ (latest 1.0.1) | Icon system | Locked — CONTEXT.md D-15. 1500+ icons, tree-shaken, first-class React support |
| tailwindcss | 4.2.2 (already installed) | Utility CSS | Already in use. shadcn v2 supports Tailwind v4 |
| @radix-ui/* | installed by shadcn add | Headless accessibility primitives | Installed automatically per component |

### shadcn Components Required (from 08-UI-SPEC.md)

| Component | Install Command | Replaces | Used In |
|-----------|----------------|---------|---------|
| button | npx shadcn@latest add button | Hand-coded buttons | All pages |
| card | npx shadcn@latest add card | TicketTable rows | TicketCard, IgnoredTicketCard |
| dialog | npx shadcn@latest add dialog | CopyPreviewModal, CopyResultModal | Copy workflow |
| tabs | npx shadcn@latest add tabs | AppShell nav tab buttons | AppShell |
| badge | npx shadcn@latest add badge | StatusBadge, TriageIndicator chips | Ticket cards, detail page |
| separator | npx shadcn@latest add separator | hr elements | SettingsPage sections |
| skeleton | npx shadcn@latest add skeleton | Basic spinners | Loading states |
| scroll-area | npx shadcn@latest add scroll-area | Overflow containers | Detail page, AuditLogPage |
| tooltip | npx shadcn@latest add tooltip | Icon button labels | Header icon toolbar |
| progress | npx shadcn@latest add progress | Copy step progress | CopyResultModal |

**Batch install command:**
```bash
npx shadcn@latest add button card dialog tabs badge separator skeleton scroll-area tooltip progress
```

### Alternatives Considered (all rejected per CONTEXT.md)

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| shadcn/ui | MUI, Chakra, Mantine | Locked. Also: shadcn is copy-paste, no runtime dep tree |
| CSS transitions | Framer Motion | Rejected — keeps bundle lean for Tauri desktop (08-UI-SPEC.md Interaction Contracts) |
| System font | Inter/Geist custom | Rejected — no web font latency tradeoff for desktop (08-UI-SPEC.md Typography) |

---

## Architecture Patterns

### shadcn/ui with Tailwind v4 Initialization

The project uses Tailwind v4 (`@import "tailwindcss"` + `@theme {}` in `src/index.css`). The shadcn CLI v2 supports Tailwind v4. During `npx shadcn@latest init`, select **Tailwind v4** when prompted. The CLI will add CSS variable declarations to `src/index.css`.

**Critical:** shadcn adds its own CSS variables (e.g., `--background`, `--foreground`, `--primary`). These must be placed inside the `@theme {}` block in `src/index.css` to align with the Tailwind v4 syntax already in use. The existing brand tokens (`--color-brand`, `--color-brand-bg`, etc.) must not be overwritten. The executor must review the init diff carefully and merge variables, not replace them.

`components.json` does not exist yet — `npx shadcn@latest init` creates it. Install path confirmed as `src/components/ui/`.

### Recommended Project Structure After Phase 8

```
src/
├── components/
│   └── ui/                      # shadcn generated + existing polished components
│       ├── button.tsx            # shadcn
│       ├── card.tsx              # shadcn
│       ├── dialog.tsx            # shadcn
│       ├── tabs.tsx              # shadcn
│       ├── badge.tsx             # shadcn
│       ├── separator.tsx         # shadcn
│       ├── skeleton.tsx          # shadcn
│       ├── scroll-area.tsx       # shadcn
│       ├── tooltip.tsx           # shadcn
│       ├── progress.tsx          # shadcn
│       ├── AppShell.tsx          # redesigned (keep file, replace internals)
│       ├── ErrorBoundary.tsx     # keep as-is (not visual)
│       └── StatusBadge.tsx       # retire — replaced by shadcn Badge
├── features/
│   ├── tickets/
│   │   ├── TicketCard.tsx        # NEW — replaces TicketTable rows
│   │   ├── TicketListPage.tsx    # redesigned — cards + fetch bar
│   │   ├── TicketDetailPage.tsx  # NEW — full-page detail (replaces TicketDetailPanel side panel)
│   │   ├── TicketDetailPanel.tsx # keep for IgnoredTicketsPage/LinkedTicketsPage if needed, or retire
│   │   ├── IgnoredTicketsPage.tsx  # redesigned — uses TicketCard
│   │   ├── LinkedTicketsPage.tsx   # redesigned — uses TicketCard
│   │   ├── CopyPreviewModal.tsx    # redesigned — Dialog + progress
│   │   ├── CopyResultModal.tsx     # redesigned — Dialog + step table
│   │   ├── AuditLogPage.tsx        # polished
│   │   └── ...                     # stores + types unchanged
│   └── connections/
│       ├── SettingsPage.tsx      # redesigned — sidebar nav layout (already partially done)
│       ├── SetupWizard.tsx       # polish styling
│       └── ConnectionCard.tsx   # polish styling
```

### Pattern 1: TicketCard Component (shared across all three list tabs)

**What:** A single `TicketCard` component used in TicketListPage, IgnoredTicketsPage, and LinkedTicketsPage. Accepts ticket data + triage state + optional action slot (restore button for ignored, linked key badge for linked).

**When to use:** Anywhere a ticket appears in a list view.

**Structure (from 08-UI-SPEC.md D-08):**
```tsx
// 3-line card structure
<div className="px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-brand-surface-hover border-b border-brand-border">
  {/* Line 1: ticket key + relative time */}
  <div className="flex items-center justify-between mb-1">
    <span className="text-xs font-mono text-brand-muted">{ticket.key}</span>
    <span className="text-xs text-brand-muted">{formatRelativeTime(ticket.fields.updated)}</span>
  </div>
  {/* Line 2: summary */}
  <p className="text-sm font-semibold text-brand-text leading-snug line-clamp-1 mb-1">
    {ticket.fields.summary}
  </p>
  {/* Line 3: metadata row */}
  <div className="flex items-center gap-2">
    <StatusDot status={ticket.fields.status.name} />
    <PriorityDot priority={ticket.fields.priority.name} />
    <span className="text-xs text-brand-text-secondary">{ticket.fields.assignee?.displayName}</span>
    {/* action slot — e.g., copy button on hover for new tickets */}
  </div>
</div>
```

**Key constraint from UI-SPEC:** Cards are flush with no gap between them — only `--color-brand-border` bottom dividers. No box-shadow. No whitespace gaps between cards.

### Pattern 2: Full-Page Detail Navigation (D-10, D-12)

**What:** Replace side-panel pattern with a full-page view. App.tsx's current three-branch routing (`showSettings`, `showAuditLog`, `main`) needs a fourth branch: `selectedTicketKey && showingDetail`.

**Current state:** `selectedTicketKey` lives in `ticketStore`. `TicketListPage` passes it into `TicketDetailPanel` as a side panel within the same flex row. The `h-[calc(100vh-113px)]` height calculation must be removed from all three list pages.

**New state needed in App.tsx:** An additional `showDetail` boolean OR repurpose `selectedTicketKey` as the signal. The recommended approach is: when a card is clicked, set `selectedTicketKey` AND navigate to detail view by rendering `TicketDetailPage` instead of `TicketListPage`. The `currentTab` state is preserved — when back is pressed, restore tab view with same `currentTab`.

**App.tsx routing after redesign:**
```tsx
// Priority order (highest to lowest):
// 1. Wizard
// 2. Settings overlay
// 3. Audit log overlay
// 4. Ticket detail page (new)
// 5. Main list view
if (selectedTicketKey && showDetail) {
  return <AppShell><TicketDetailPage issueKey={selectedTicketKey} onBack={handleBack} /></AppShell>;
}
// else render AppShell with tab nav and current tab's list
```

### Pattern 3: CSS Custom Properties + shadcn Token Mapping

**Critical integration point:** shadcn uses its own semantic token names (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`). The project uses `--color-brand-*` tokens.

Two strategies:
1. **Map shadcn tokens to existing brand tokens** — In `src/index.css` after shadcn init, repoint shadcn variables to the brand variables: `--background: var(--color-brand-bg)`. This keeps brand tokens canonical and shadcn components pick them up automatically.
2. **Use both sets independently** — shadcn components use their tokens, hand-coded Tailwind uses `text-brand-*`. Works but requires maintaining two parallel token systems.

**Recommendation:** Strategy 1 (map shadcn tokens to brand tokens). The `@theme {}` block in Tailwind v4 is the source of truth. Add shadcn's semantic names as aliases pointing to brand values. This keeps dark mode working via the existing `body.dark` override pattern.

### Pattern 4: i18n for New Copy Strings

Every new UI string introduced in this phase (empty states, button labels, back button, copy progress labels, error states) needs i18n keys in `en.json` and `sk.json`. The 08-UI-SPEC.md Copywriting Contract lists all new strings. These must be added to both files before or alongside the component that uses them.

**New i18n keys implied by UI-SPEC.md (not yet in en.json):**
- `tickets.empty.heading` — "No new tickets"
- `tickets.empty.body` — "Tickets assigned to you..."
- `ignored.empty.heading` — "No ignored tickets"
- `ignored.empty.body` — "Tickets you mark..."
- `linked.empty.heading` — "No linked tickets"
- `linked.empty.body` — "Tickets already copied..."
- `copy.progress.fetchingSource` — "Reading source ticket"
- `copy.progress.copyingFields` — "Creating ticket in Company Jira"
- `copy.progress.attachments` — "Uploading attachments"
- `copy.progress.comments` — "Copying comments"
- `copy.progress.done` — "Ticket copied successfully"
- `detail.back` — "Back to tickets"
- `settings.back` — currently "Back", needs update to "Back to App"
- `ignored.confirm.title` — "Ignore ticket"
- `ignored.confirm.body` — "Mark this ticket as 'not for me'?..."
- `ignored.confirm.action` — "Ignore Ticket"
- `audit.empty.heading` — "No API calls recorded yet..."

### Anti-Patterns to Avoid

- **Mixing shadcn component tokens with raw Tailwind brand tokens inconsistently** — pick one strategy for each element and stick to it. The safest: use brand tokens for layout/structure, shadcn components via their props API.
- **Adding CSS transitions to CopyPreviewModal overlay** — the spec says no page transition animations. Instant navigation only (D-10).
- **Using weight 500 anywhere** — the typography spec allows only 400 and 600. weight-medium (500) is explicitly excluded.
- **Applying `focus` ring on pointer click** — only `focus-visible` rings, never `focus`. Tailwind `focus-visible:ring-2` only.
- **Removing existing `useTranslation()` hook** during component rewrites — every component must retain i18n wiring.
- **Box-shadow on ticket cards** — flat aesthetic, no shadow. Background color change on hover only.
- **Gap between cards** — cards are flush. Space is inside the card via padding. No `gap-*` or `space-y-*` between card elements.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal with focus trap + Escape | Custom portal + event listener | shadcn Dialog (Radix) | Focus trap, scroll lock, keyboard handling, aria-modal — 10+ edge cases |
| Progress bar | CSS width animation | shadcn Progress (Radix) | Proper aria-valuenow, smooth animation, accessible |
| Tooltip | CSS :hover tooltip | shadcn Tooltip (Radix) | Keyboard accessible, correct positioning, collision detection |
| Tab switching | Button array + state | shadcn Tabs (Radix) | Arrow key navigation, aria-selected, tabpanel association |
| Skeleton loading | Animated divs | shadcn Skeleton | Consistent pulse animation, correct aria-hidden |
| Icon set | Hand-coded SVGs | Lucide React | Already doing this wrong in 5 places — GearIcon, TerminalIcon, SpinnerIcon, ChevronIcon, CloseIcon |
| Scroll container | overflow-y-auto div | shadcn ScrollArea | Custom scrollbar styling already in CSS — ScrollArea provides consistent cross-platform scrollbar |

**Key insight:** The codebase already contains 5 hand-rolled SVG icon components and 2 hand-rolled modal implementations. These are all prime candidates for replacement. The accessibility issues in the current CopyPreviewModal (custom focus management, custom escape handling) are exactly the kind of thing Radix Dialog handles correctly.

---

## Common Pitfalls

### Pitfall 1: shadcn Tailwind v4 CSS Variable Collision

**What goes wrong:** Running `npx shadcn@latest init` in Tailwind v4 mode adds `--background`, `--foreground` etc. to `src/index.css`. If placed outside `@theme {}`, they don't register as Tailwind utilities. If placed inside `@theme {}` without `--color-` prefix, they don't work with existing `text-brand-*` classes.

**Why it happens:** shadcn's v4 support adds variables in `@layer base` or `@theme {}`, but the exact output depends on the CLI version and choices made during init.

**How to avoid:** After running `npx shadcn@latest init`, review the entire diff to `src/index.css`. Ensure: (1) all new variables are inside `@theme {}`, (2) brand token values are preserved, (3) shadcn semantic variables alias to brand values (e.g., `--background: var(--color-brand-bg)`), (4) dark mode overrides in `body.dark {}` are updated to include shadcn semantic tokens.

**Warning signs:** shadcn components render with no color (all transparent/white) — means CSS variables aren't resolving.

### Pitfall 2: App.tsx Routing State Complexity with Full-Page Detail

**What goes wrong:** Moving from side-panel (co-located state in TicketListPage) to full-page detail (App.tsx routing level) requires lifting the "show detail" signal from `ticketStore.selectedTicketKey` up to App.tsx rendering logic.

**Why it happens:** Currently, `selectedTicketKey` is non-null any time a ticket is selected, but in the current design the list is always visible. In the new design, a non-null key means "replace the list view with the detail page." This changes the semantics of `selectedTicketKey`.

**How to avoid:** Add a separate `showDetailView: boolean` state in App.tsx (not in the store). Set it to `true` when a card is clicked (alongside `selectTicket(key)`), set it to `false` when back is pressed. The store's `selectedTicketKey` retains its meaning (which ticket is focused); the App.tsx local state controls rendering mode. Alternatively, use a `detailTicketKey: string | null` in App.tsx local state, setting it on click and clearing it on back — decoupled from the store's selected key.

**Warning signs:** Navigating to detail and pressing back causes infinite loop, or back button is missing/broken.

### Pitfall 3: IgnoredTicketsPage and LinkedTicketsPage Also Use Side Panel

**What goes wrong:** The planner/executor focuses on TicketListPage for the table-to-card conversion but forgets that IgnoredTicketsPage and LinkedTicketsPage are identical table layouts. Both also currently open TicketDetailPanel as a side panel.

**Why it happens:** TicketListPage is the "main" screen. The other two tabs are secondary and easy to overlook.

**How to avoid:** All three list pages must get card treatment (D-07). The `TicketCard` component must accept a variant/action slot for the Restore button (ignored) and linked key badge (linked). The full-page detail navigation (D-10) applies to all three tabs equally — clicking any card in any tab opens the full-page detail.

**Warning signs:** IgnoredTicketsPage still shows a table after the "New" tab has been converted to cards.

### Pitfall 4: CopyPreviewModal Architecture Change

**What goes wrong:** CopyPreviewModal is currently rendered inside TicketDetailPanel (`<CopyPreviewModal />` at line 304 of TicketDetailPanel.tsx). After D-10, TicketDetailPanel is replaced by TicketDetailPage. The modal render location must move to TicketDetailPage.

**Why it happens:** Implicit coupling between modal and its host component.

**How to avoid:** When creating TicketDetailPage, include both `<CopyPreviewModal />` and `<CopyResultModal />` at the bottom of the component, same as TicketDetailPanel does today. CopyResultModal must also be relocated.

**Warning signs:** Clicking "Copy to Company Jira" in the new detail page does nothing visible — modal renders but its host is no longer in the tree.

### Pitfall 5: Missing i18n Keys for New Copy Strings

**What goes wrong:** New empty state headings, back button labels, copy progress labels, and confirm dialog strings are hardcoded in English only — Slovak translation is missing.

**Why it happens:** It's easy to add the `t('key')` call but forget to add the key to both `en.json` and `sk.json`.

**How to avoid:** For each new i18n key added to `en.json`, immediately add the corresponding key to `sk.json`. In practice: update both files in the same commit as the component that uses the key. Consider using the existing en.json as the pattern — the Slovak translations exist for all current strings.

**Warning signs:** App crashes or shows key names (e.g., "tickets.empty.heading") when language is set to Slovak.

### Pitfall 6: `h-[calc(100vh-113px)]` Height Magic Number

**What goes wrong:** TicketListPage, IgnoredTicketsPage, and LinkedTicketsPage all use `h-[calc(100vh-113px)]` to constrain the scroll container height. This magic number is the combined height of the AppShell header (44px) + tab nav (36px) + some additional spacing. After the redesign, if these heights change, the magic number breaks.

**Why it happens:** No CSS variable or layout mechanism enforces the header/nav height as a measured constant.

**How to avoid:** After AppShell is redesigned (first wave), measure the actual header + tab nav heights and update the constant. Or better: use a flex column layout on the AppShell's children wrapper that fills remaining space (`flex-1 overflow-hidden`) instead of a calc-based height. The `flex flex-col` pattern on AppShell with `flex-1` on the content area is already present — leaning into it eliminates the magic number.

**Warning signs:** Vertical scroll in the card list doesn't work (list is too short or overflows behind header).

---

## Code Examples

Verified patterns from official sources / current codebase:

### shadcn Dialog Pattern (for CopyPreviewModal redesign)
```tsx
// Source: shadcn/ui official docs — dialog component
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// Phase: 'previewing' | 'copying' — open when either
<Dialog open={phase === 'previewing' || phase === 'copying'} onOpenChange={(open) => { if (!open) reset(); }}>
  <DialogContent className="max-w-[560px]">
    <DialogHeader>
      <DialogTitle>{t('copy.preview.title')}</DialogTitle>
    </DialogHeader>
    {/* Progress bar (copying phase only) */}
    {phase === 'copying' && (
      <Progress value={progressPercent} className="h-1" />
    )}
    {/* ...field content */}
  </DialogContent>
</Dialog>
```

### shadcn Skeleton Pattern (ticket list loading)
```tsx
// Source: shadcn/ui official docs — skeleton component
import { Skeleton } from "@/components/ui/skeleton"

// 3 placeholder card shapes matching 72px card height
function SkeletonCards() {
  return (
    <div aria-busy="true" aria-label="Loading tickets">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-brand-border">
          <div className="flex justify-between mb-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-full mb-1" />
          <div className="flex gap-2">
            <Skeleton className="h-3 w-8 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Lucide React Icon Usage (replacing hand-coded SVGs)
```tsx
// Source: lucide-react docs — same API as heroicons
import { Settings, Terminal, ChevronDown, ChevronUp, Loader2, X, ArrowLeft } from 'lucide-react'

// GearIcon → Settings
// TerminalIcon → Terminal
// ChevronIcon → ChevronDown / ChevronUp
// SpinnerIcon → Loader2 with animate-spin
// Close X → X
// Back arrow → ArrowLeft
<Settings className="w-[15px] h-[15px]" aria-hidden="true" />
<Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
```

### Ticket Card (from 08-UI-SPEC.md spec)
```tsx
// Per 08-UI-SPEC.md: cards flush, 12px vertical padding, 150ms ease hover
function TicketCard({ ticket, triageEntry, onClick, actionSlot }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(ticket.key)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(ticket.key)}
      className="px-4 py-3 cursor-pointer border-b border-brand-border transition-colors duration-150 hover:bg-brand-surface-hover"
    >
      {/* Line 1 */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-brand-muted">{ticket.key}</span>
        <span className="text-xs text-brand-muted">{formatRelativeTime(ticket.fields.updated)}</span>
      </div>
      {/* Line 2 */}
      <p className="text-sm font-semibold text-brand-text leading-snug line-clamp-1 mb-1.5">
        {ticket.fields.summary}
      </p>
      {/* Line 3 */}
      <div className="flex items-center gap-2">
        <StatusBadge status={ticket.fields.status.name} />
        <PriorityDot priority={ticket.fields.priority.name} />
        <span className="text-xs text-brand-text-secondary truncate">
          {ticket.fields.assignee?.displayName ?? ''}
        </span>
        {actionSlot}
      </div>
    </div>
  )
}
```

### AppShell Navigation Tab (from UI-SPEC active/inactive states)
```tsx
// Active: text-brand-text font-semibold border-brand (2px bottom)
// Inactive: text-brand-muted border-transparent (transitions 150ms)
<button
  className={`text-sm py-2 mr-4 border-b-2 transition-colors duration-150 ${
    isActive
      ? 'text-brand-text font-semibold border-brand'
      : 'text-brand-muted font-normal border-transparent hover:text-brand-text'
  }`}
>
  {label}
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-coded SVG icon components (GearIcon, TerminalIcon, etc.) | lucide-react named imports | This phase | Removes 5 custom SVG components, adds tree-shaken icon library |
| Sortable table (TicketTable) | TicketCard list | This phase | Removes sort state, sort helpers, table/thead/tbody structure |
| Side-panel detail (TicketDetailPanel in 45% column) | Full-page TicketDetailPage | This phase | Requires App.tsx routing change, more screen space for detail |
| Inline `role="dialog"` with custom focus trap | shadcn Dialog (Radix) | This phase | Proper ARIA, focus trap, keyboard handling |
| Custom pulse progress bar in CopyPreviewModal | shadcn Progress component | This phase | aria-valuenow, smooth animation |
| `h-[calc(100vh-113px)]` magic number | flex-1 + overflow-hidden layout | This phase | Remove all three magic number instances |

**Deprecated/outdated in this phase:**
- `src/components/ui/StatusBadge.tsx` — replaced by shadcn Badge with color variants
- Inline SVG icon functions (GearIcon, TerminalIcon, SpinnerIcon, ChevronIcon in TicketListPage and TicketTable) — replaced by Lucide React
- `TicketTable.tsx` — retired after card conversion (or repurposed as AuditLogPage still uses a table, which is correct for tabular data)
- `TicketDetailPanel.tsx` — retired after full-page detail conversion (or kept only if IgnoredTicketsPage/LinkedTicketsPage need a fallback)

---

## Open Questions

1. **TicketDetailPanel: Retire or keep?**
   - What we know: All three tab pages currently use TicketDetailPanel as their side panel. After D-10, all three get full-page detail.
   - What's unclear: Should TicketDetailPanel be completely retired (deleted) or converted to TicketDetailPage? Or should it become the inner content of TicketDetailPage?
   - Recommendation: Create a new `TicketDetailPage.tsx` that wraps the existing tab content logic from `TicketDetailPanel.tsx` in a full-page layout with a back button. Retire `TicketDetailPanel.tsx` after the migration. The inner tab components (OverviewTab, CommentsTab, etc.) remain unchanged.

2. **CopyPreviewModal: Dialog width vs current full-screen layout**
   - What we know: Current modal is `fixed inset-0` (full screen). UI-SPEC says max-width 560px centered Dialog.
   - What's unclear: The preview content has two columns (source + target fields side by side). At 560px, two columns may be too cramped for the description textarea.
   - Recommendation: Make the Dialog wider for the preview step — use `max-w-3xl` (768px) for CopyPreviewModal. Reserve `max-w-[560px]` for CopyResultModal (just a step list). The planner should specify this explicitly.

3. **AuditLogPage table: convert to cards or keep as table?**
   - What we know: D-07 specifies switching ticket lists to cards. AuditLogPage shows API call logs, which is genuinely tabular data (time, method, URL, status columns).
   - What's unclear: Does the card principle extend to audit log rows?
   - Recommendation: Keep AuditLogPage as a table (appropriate for tabular API log data). Polish the visual styling to match the new design system (use brand tokens, proper header styling) but retain the `<table>` structure. This is explicitly not a ticket list.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npx shadcn@latest init | Yes | system node | — |
| npx / npm | shadcn CLI | Yes | bundled with npm | — |
| lucide-react | Icon replacement | No (not installed) | — | Install in Wave 0 |
| shadcn CLI (npx) | Component generation | No components.json | 4.1.0 available | — |
| Tailwind v4 | shadcn styling | Yes (4.2.2) | 4.2.2 | — |
| React 19 | All components | Yes (19.0.0) | 19.0.0 | — |

**Missing dependencies that require Wave 0 installation:**
- `lucide-react` — `npm install lucide-react`
- shadcn components.json — `npx shadcn@latest init` (Tailwind v4 mode)
- 10 shadcn components — `npx shadcn@latest add button card dialog tabs badge separator skeleton scroll-area tooltip progress`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.3.0 |
| Config file | vite.config.ts (test section — jsdom environment, src/test-setup.ts) |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Existing Test Coverage (files that will be modified)
| File | Test File | Exists |
|------|-----------|--------|
| AppShell.tsx | No dedicated test (tested indirectly) | No specific test |
| TicketListPage.tsx | TicketListPage.test.tsx | Yes |
| TicketDetailPanel.tsx | TicketDetailPanel.test.tsx | Yes |
| CopyPreviewModal.tsx | CopyPreviewModal.test.tsx | Yes |
| CopyResultModal.tsx | CopyResultModal.test.tsx | Yes |
| IgnoredTicketsPage.tsx | IgnoredTicketsPage.test.tsx | Yes |
| AuditLogPage.tsx | AuditLogPage.test.tsx | Yes |
| SettingsPage.tsx | features/connections/__tests__/SettingsPage.test.tsx | Yes |

### Phase 8 Test Strategy

Phase 8 is a pure visual/structural refactor. Existing tests verify behavior (which copy buttons trigger actions, which empty states appear, etc.) — not visual styles. The test strategy is:

1. **Preserve all existing test assertions** — after component rewrites, existing tests must still pass (same text labels, same aria roles, same behaviors)
2. **New tests for structural changes only** — TicketDetailPage (new component) needs tests. TicketCard (new component) needs tests.
3. **i18n tests** — new i18n keys render correctly for both locales

### Phase Requirements → Test Map (structural changes only)
| Change | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TicketCard renders 3-line structure | card shows key, summary, metadata | unit | `npm test -- TicketCard` | No — Wave 0 |
| TicketDetailPage back button | back button returns to list | unit | `npm test -- TicketDetailPage` | No — Wave 0 |
| AppShell tab nav | active tab has correct class | unit | `npm test -- AppShell` | No — Wave 0 |
| Existing behaviors preserved | all current test files pass | regression | `npm test` | Yes |

### Wave 0 Gaps
- [ ] `src/features/tickets/TicketCard.test.tsx` — tests for new card component
- [ ] `src/features/tickets/TicketDetailPage.test.tsx` — tests for new full-page detail
- [ ] `src/components/ui/AppShell.test.tsx` — tests for redesigned AppShell

*(Note: All existing test files already cover the behaviors being preserved. No existing test files need to be deleted.)*

---

## Project Constraints (from CLAUDE.md)

No CLAUDE.md found in project root. Constraints derived from CONTEXT.md locked decisions and code review:

- **i18n required everywhere** — every component uses `useTranslation()`. No hardcoded English strings.
- **Tailwind v4 syntax** — `@import "tailwindcss"` + `@theme {}`. No `tailwind.config.js`. No `@layer utilities`.
- **CSS custom properties for theming** — dark mode via `body.dark` class override. Both themes must be maintained.
- **React 19 functional components only** — no class components.
- **Zustand stores are data layer** — no UI state in stores (except `selectedTicketKey` which is being reconsidered for phase 8 routing). Logic stays in stores, display state stays in components.
- **Tauri IPC unchanged** — all `invoke()` calls remain exactly as-is. Backend is not touched.
- **No third-party registries** — shadcn components from official registry only (ui.shadcn.com).
- **All test files must pass** — `npm test` must be green before phase is complete.

---

## Sources

### Primary (HIGH confidence)
- Direct source code review — `src/components/ui/AppShell.tsx`, `src/features/tickets/TicketTable.tsx`, `src/features/tickets/TicketListPage.tsx`, `src/features/tickets/TicketDetailPanel.tsx`, `src/features/tickets/IgnoredTicketsPage.tsx`, `src/features/tickets/LinkedTicketsPage.tsx`, `src/features/tickets/CopyPreviewModal.tsx`, `src/features/tickets/CopyResultModal.tsx`, `src/features/connections/SettingsPage.tsx`, `src/features/tickets/AuditLogPage.tsx`, `src/App.tsx`, `src/index.css`, `package.json`
- `08-UI-SPEC.md` (08-CONTEXT.md + UI design contract) — all design decisions
- `npm view shadcn` — confirmed latest version 4.1.0
- `npm view lucide-react` — confirmed latest version 1.0.1

### Secondary (MEDIUM confidence)
- shadcn/ui official — Tailwind v4 support confirmed in shadcn v2. `components.json` required for install to work.
- Radix UI — all 10 listed components verified to have published versions

### Tertiary (LOW confidence)
- shadcn Tailwind v4 CSS variable output format — the exact structure the CLI generates for `src/index.css` is version-dependent. The executor must review the diff carefully rather than assume a specific format.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm, all components exist and are locked by CONTEXT.md
- Architecture patterns: HIGH — derived directly from reading all 13 source files and the UI-SPEC
- Pitfalls: HIGH — derived from direct code inspection (magic numbers, modal locations, routing pattern)
- i18n gaps: HIGH — verified by reading en.json and comparing to UI-SPEC copywriting contract
- shadcn v4 init exact output format: LOW — depends on CLI version, must be validated at execution time

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (shadcn CLI versions move quickly — verify CLI version before executing)
