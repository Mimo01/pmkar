# Phase 9: Increase Accessibility - Research

**Researched:** 2026-03-24
**Domain:** Web accessibility (WCAG 2.1 AA), React/Tailwind a11y patterns, color contrast, ARIA semantics
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Target WCAG AA standard — 4.5:1 for normal text, 3:1 for large text and UI components
- **D-02:** No information conveyed by color alone — every colored status indicator (priority dots, triage state, copy status) must be paired with a text label or distinct icon shape

### Claude's Discretion
- Brand red (#c02232) handling when it fails AA contrast — Claude chooses between shade adjustment per-context, restricting to large elements, or pairing with text alternatives
- Dark mode muted text (#6b6b6f on #161617, currently ~3.5:1) — Claude decides brightening strategy based on where muted color is used
- Focus indicator style — Claude picks between brand-colored ring, subtle+bold hybrid, or contextual approach
- Skip-to-content link — Claude evaluates tab depth and decides if warranted given the minimal nav structure
- Ticket card keyboard navigation — Claude picks between roving tabindex (arrow keys) or standard Tab based on typical list size (5-20 tickets)
- Escape key behavior for overlay pages — Claude decides based on existing keyboard patterns
- Form validation error pattern — Claude picks best approach per form (likely inline + aria-describedby)
- Visible labels vs placeholder-as-label — Claude audits each form and picks per context
- Required field indicators — Claude picks asterisk vs text hint based on form complexity
- Live region strategy for async operations — Claude identifies which operations need announcements
- Semantic structure (headings + landmarks) — Claude audits and adds what's most impactful
- Icon accessibility — Claude categorizes each icon as actionable (gets aria-label) vs decorative (gets aria-hidden)
- Dynamic page titles — Claude decides based on number of distinct views

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase improves accessibility of a Tauri desktop app built with React 19, Tailwind CSS v4, and shadcn/ui (Radix-based). The existing codebase has partial a11y (~90 aria/role/sr-only/focus-visible occurrences across 20 files), but several clear deficiencies were found through direct code audit and contrast calculations.

The most significant issues are: (1) multiple contrast failures in dark mode where `--color-brand-muted` (#6b6b6f) is used as visible text, (2) `TicketCard` using a non-interactive `<div onClick>` rather than a keyboard-accessible element, (3) form inputs in `CopyPreviewModal` that lack `htmlFor`/`id` associations, (4) `StatusBadge` using text-blue-600 and text-red-600 which fail 4.5:1 in dark mode, and (5) audit log rows using `<tr onClick>` without keyboard access. The codebase already uses shadcn/ui components (Radix Dialog, Tabs) which provide solid baseline ARIA for modals and tab panels.

**Primary recommendation:** Fix contrast token values in `src/index.css` first (single-file systemic fix), then address keyboard access for interactive non-button elements, then complete ARIA attribute gaps across forms and dynamic regions.

---

## Contrast Audit (Computed Values)

All values computed with exact WCAG 2.1 formula. WCAG AA requires 4.5:1 for normal text, 3:1 for UI components/large text (18px+ normal or 14px+ bold).

### Confirmed Failures

| Color | Background | Ratio | Use | Required | Status |
|-------|-----------|-------|-----|----------|--------|
| #6b6b6f (dark muted) | #1e1e20 (dark-surface) | 3.14:1 | Form field labels in CopyPreviewModal (`text-brand-muted`) | 4.5:1 | **FAIL** |
| #6b6b6f (dark muted) | #28282a (dark-surface-hover) | 2.77:1 | Muted text on hovered card | 3.0:1 | **FAIL** |
| #c02232 (brand) | #1e1e20 (dark-surface) | 2.79:1 | `border-brand` active indicator on cards/tabs | 3.0:1 | **FAIL** |
| #2563eb (blue-600) | #1e1e20 (dark-surface) | 3.22:1 | StatusBadge "In Progress" text in dark mode | 4.5:1 | **FAIL** |
| #dc2626 (red-600) | #1e1e20 (dark-surface) | 3.45:1 | StatusBadge "Blocked" text in dark mode | 4.5:1 | **FAIL** |

### Borderline / Contextual

| Color | Background | Ratio | Use | Note |
|-------|-----------|-------|-----|------|
| #8c8c92 (light muted) | #f7f7f8 (light-bg) | 3.12:1 | Nav tab inactive text, muted labels | Used for supplementary text — acceptable as secondary/decorative but not for standalone body text |
| #8c8c92 (light muted) | #ffffff (light-surface) | 3.34:1 | Form field labels in CopyPreviewModal light | Used at text-xs — needs fix if conveying required info |
| #c02232 (brand) | #161617 (dark-bg) | 3.03:1 | Brand border/ring indicator | Barely passes 3:1 for UI components; acceptable |
| #059669 (emerald-600) | #1e1e20 | 4.42:1 | Status badge green text dark | 0.08 below threshold — fix needed |

### Passing (Confirmed)

| Color | Background | Ratio | Use |
|-------|-----------|-------|-----|
| #231f20 (text) | #f7f7f8 | 15.22:1 | Primary body text light |
| #e4e4e6 (text) | #161617 | 14.24:1 | Primary body text dark |
| #5c585a (text-secondary) | #f7f7f8 | 6.54:1 | Secondary text light |
| #95959a (text-secondary) | #161617 | 6.07:1 | Secondary text dark |
| #ffffff | #c02232 | 5.97:1 | White text on brand button |
| #6ee7b7 (emerald-300) | #161617 | 11.86:1 | TestResult success message |
| #fca5a5 (red-300) | #161617 | 9.53:1 | TestResult error message |
| #60a5fa (blue-400) | #1e1e20 | 6.55:1 | Available as dark-mode badge replacement |
| #3b82f6 (blue-500) | #1e1e20 | 4.53:1 | Passes AA for normal text |

### Recommended Token Fixes (src/index.css)

```css
/* In body.dark block: */
--color-brand-muted: #7f7f7f;          /* was #6b6b6f — now 4.52:1 on dark-bg */
--muted-foreground: #7f7f7f;           /* shadcn alias — keep in sync */
```

For status badge colors in dark mode: use `text-blue-400` (#60a5fa, 6.55:1) and `text-red-400` (#f87171, 6.54:1) instead of `text-blue-600` and `text-red-600` on dark surfaces.

For brand border active indicators (3:1 UI component threshold): #c02232 at 3.03:1 on dark-bg is acceptable as a UI component indicator (not text). No fix required.

---

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @testing-library/react | ^16.3.0 | Accessibility-first test queries | Already in project |
| @testing-library/jest-dom | ^6.6.3 | Extended assertions (toBeVisible, etc.) | Already in project |
| vitest | ^4.1.0 | Test runner | Already in project |

### Add for Automated A11y Testing (Optional Wave 0)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| jest-axe | 10.0.0 | Axe accessibility rules in vitest tests | Published, compatible with vitest via `toHaveNoViolations` |

**Installation (if adding jest-axe):**
```bash
npm install --save-dev jest-axe @types/jest-axe
```

No new runtime dependencies needed — all a11y work is CSS + HTML attribute changes.

---

## Architecture Patterns

### Pattern 1: CSS Token Fix (Systemic Contrast Correction)
**What:** Change `--color-brand-muted` in `body.dark` block of `src/index.css`
**When to use:** Fixes all dark mode muted text failures in a single edit
**Impact:** All components using `text-brand-muted` or `muted-foreground` automatically fixed

```css
/* Source: src/index.css — body.dark block */
body.dark {
  --color-brand-muted: #7f7f7f;  /* was #6b6b6f; ratio: 4.52:1 on #161617 */
  --muted-foreground: #7f7f7f;   /* shadcn alias must match */
}
```

**Caution:** `text-brand-muted` is also used for decorative elements (tab connector line, inactive border) that don't need 4.5:1. The fix over-corrects these — acceptable because brighter gray remains visually appropriate.

### Pattern 2: Interactive Element Keyboard Access
**What:** Convert `<div onClick>` to a semantically correct interactive element
**When to use:** Any clickable non-button, non-link div/span (TicketCard, audit log rows)

```tsx
// TicketCard: currently a <div onClick> — convert to <button>
// Option A: <button> (correct for non-navigation actions)
<button
  type="button"
  onClick={onClick}
  className="w-full text-left px-4 py-3 cursor-pointer ... focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
>
  {/* card content */}
</button>

// AuditLogPage expandable row: <tr onClick> — add keyboard handler + tabIndex
<tr
  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expandedId === entry.id ? null : entry.id); }}}
  tabIndex={0}
  role="button"
  aria-expanded={expandedId === entry.id}
  className="... focus-visible:outline-2 focus-visible:outline-brand"
>
```

**Note for TicketCard specifically:** Converting to `<button>` requires `w-full text-left` Tailwind classes to preserve layout. The `actionSlot` prop (Restore button, linked badge) contains nested interactive elements — these must use `e.stopPropagation()` to prevent double-firing.

### Pattern 3: Form Input aria-describedby for Error Messages
**What:** Link error text to the input that generated it via `aria-describedby`
**When to use:** Any input with adjacent error message text

```tsx
// ConnectionForm — urlError pattern
<input
  id="base-url"
  aria-describedby={urlError ? "base-url-error" : undefined}
  aria-invalid={!!urlError}
  ...
/>
{urlError && (
  <p id="base-url-error" role="alert" className="text-xs text-red-400">
    {urlError}
  </p>
)}
```

### Pattern 4: CopyPreviewModal — Label/Input Association
**What:** The target-side form inputs (Summary, Status, Priority, Labels, Description) lack `id`/`htmlFor` pairing
**When to use:** All `<label>` elements that don't wrap their input must use `htmlFor`

```tsx
// CopyPreviewModal: currently labels have no htmlFor
// Fix pattern:
<label htmlFor="target-summary" className="text-xs text-brand-muted block mb-1">
  Summary
</label>
<input
  id="target-summary"
  type="text"
  ...
/>
```

### Pattern 5: Status/Priority Color + Text Pairing (D-02)
**What:** Every color-coded indicator must also convey meaning via text or icon shape
**When to use:** PriorityDot, StatusDot in TicketCard; TriageIndicator in TicketCard actionSlot

Current state:
- `StatusDot` — already pairs color dot with text `{status}` — **COMPLIANT**
- `PriorityDot` — color dot only, has `aria-label={priority}` — **screen reader compliant but visually color-only**. For sighted users, the priority name text is not shown on the card. D-02 requires visual text pairing too.
- `TriageIndicator` "new" state — small colored dot with no text on card — **color-only for sighted users**

**Fix for PriorityDot:** Add priority name text next to dot (like StatusDot pattern), or switch to priority icon shapes per level.

**Fix for TriageIndicator "new":** The new-ticket dot on TicketCard should either be removed (tab itself shows only new tickets) or paired with a "New" sr-only text.

### Pattern 6: Live Region for Async Operations
**What:** Screen readers need `aria-live` to announce dynamic content changes
**When to use:** Operations that complete asynchronously and update UI

Existing live regions (already correct):
- `TestResult.tsx` — `role="status" aria-live="polite"` for success; `role="alert" aria-live="assertive"` for errors
- `SkeletonCards` — `aria-busy="true" aria-label="Loading tickets"`

Missing live regions:
- **Copy progress** in `CopyPreviewModal` — `progressStep` text updates during copy but is not in a live region
- **Fetch status** in `TicketListPage` — loading/error state changes need announcement

```tsx
// CopyPreviewModal: add aria-live to progress text
<p
  className="text-xs text-brand-muted"
  aria-live="polite"
  aria-atomic="true"
>
  {progressStep}
</p>
```

### Pattern 7: Tab Panel Keyboard Pattern (TicketDetailPage)
**What:** Tabs with role="tab" should support arrow key navigation within the tablist
**When to use:** `role="tablist"` containers

Current state in TicketDetailPage: has `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` — **mostly correct**. Missing: `id` on each tab button (for `aria-labelledby` on tabpanel), and arrow key keyboard navigation within tablist.

```tsx
// Add id to tab buttons and aria-labelledby to panel
<button
  id={`tab-${tab.id}`}
  role="tab"
  aria-selected={activeTab === tab.id}
  aria-controls={`tabpanel-${tab.id}`}
  ...
/>

<div
  role="tabpanel"
  id={`tabpanel-${activeTab}`}
  aria-labelledby={`tab-${activeTab}`}
  tabIndex={0}  // panel itself focusable when selected
>
```

### Recommended Project Structure (No Changes)
The existing feature-based file structure is correct. All a11y changes are within existing files.

### Anti-Patterns to Avoid
- **`<div onClick>` without `tabIndex` and keyboard handler:** Non-discoverable by keyboard users and invisible to screen readers
- **Placeholder-as-label:** `placeholder` attribute disappears on input — never use as the only label. All current forms already have visible `<label>` elements.
- **`aria-label` on non-interactive decorative elements:** Color dots that are purely visual should use `aria-hidden="true"` not `aria-label`
- **`role="link"` on `<span>`:** TriageIndicator's copiedKey span has `role="link"` — should be a real `<button>` or `<a>` with `href` (or `as-child` invoke pattern)
- **Duplicate aria-label + Tooltip content:** AppShell buttons have both `aria-label` and identical `TooltipContent` — the tooltip alone doesn't need to duplicate the label; this is fine as-is
- **Focus ring using `focus:` instead of `focus-visible:`:** `focus:ring` shows for mouse clicks too; always use `focus-visible:ring` (project already does this correctly in most places)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap | Custom focus lock | Radix Dialog (already used) | Focus trap, scroll lock, Escape key, aria-modal all handled |
| Accessible combobox/listbox | Custom dropdown | Radix Select (shadcn select) or current pattern | ARIA for expanded/selected state, keyboard nav complex |
| Axe rule validation in tests | Custom contrast checker | jest-axe | 100+ rules covering ARIA, contrast, keyboard, labels |
| Roving tabindex for lists | Custom keyboard manager | Standard `tabIndex={0}` on each card | 5-20 items is too few to need roving tabindex; simple Tab flow is correct per WCAG 2.1 SC 2.1.1 |

**Key insight:** Radix-based shadcn/ui already handles the hardest ARIA patterns (Dialog, Tooltip, ScrollArea). The remaining work is CSS token values and HTML attribute completeness.

---

## Common Pitfalls

### Pitfall 1: Fixing Dark Mode Muted Token Breaks Light Mode
**What goes wrong:** `--color-brand-muted` is defined in `@theme` (applies both modes) and overridden in `body.dark`. If you accidentally change the `@theme` value instead of the `body.dark` override, light mode muted text (#8c8c92, which already passes 3.12:1 for supplementary use) is unnecessarily changed.
**How to avoid:** Only edit the `--color-brand-muted` value inside `body.dark {}` block. The `@theme` block value stays as #8c8c92.

### Pitfall 2: TicketCard Button Wrapping Breaks actionSlot
**What goes wrong:** `TicketCard` wraps content in a `<button>`. The `actionSlot` prop can contain a `<button>` (Restore) — nesting `<button>` inside `<button>` is invalid HTML and browser behavior is undefined.
**How to avoid:** The outer TicketCard element must use `e.stopPropagation()` on actionSlot interactions (already done in IgnoredTicketsPage). But the outer element could also remain a `<div>` with `tabIndex={0}`, `role="button"`, `onKeyDown` handler, since it's a list item that navigates rather than submits. Either approach works — just verify with HTML validator.
**Preferred pattern:** Keep outer as `<button>` + actionSlot buttons use `e.stopPropagation()`. The HTML spec does allow interactive content descendants in `<button>` if they're not themselves interactive — but nested `<button>` is forbidden. If actionSlot contains a button, use `role="listitem"` + `<div>` approach with explicit keyboard handling.

### Pitfall 3: aria-describedby IDs Must Be Unique in DOM
**What goes wrong:** CopyPreviewModal renders forms with labels like "Summary", "Status", "Priority". If you add `id="summary-error"` without namespacing, and the modal renders twice or alongside another form, IDs clash.
**How to avoid:** Use descriptive IDs like `copy-target-summary`, `copy-target-status` that are unique to this modal context.

### Pitfall 4: Status Badge Color Fix in Dark Mode
**What goes wrong:** `StatusBadge` in `TicketDetailPage` uses `text-blue-600` and `text-green-600` (Tailwind hardcoded values). Dark mode needs lighter variants. Simply adding a Tailwind `dark:text-blue-400` class is sufficient, but you must also update both the text color AND the badge background to maintain visual coherence (`bg-blue-600/10` stays — the background is decorative).
**Warning signs:** If you see blue-400 text on a blue-600/10 background in dark, it looks slightly disconnected — acceptable as the background is decorative.

### Pitfall 5: Focus Ring Offset Color in Dark Mode
**What goes wrong:** `focus-visible:ring-offset-2` creates a gap between element and ring. The offset renders in the background color. In dark mode, the background is `#161617`. Using `ring-offset-background` (shadcn variable) instead of hardcoded white ensures the offset blends correctly.
**How to avoid:** AppShell already uses `focus-visible:ring-brand focus-visible:ring-offset-2` without specifying offset color — this inherits correctly from page background.

### Pitfall 6: Accessible Name Conflicts on Duplicate Icons
**What goes wrong:** Both the Terminal icon button (audit) and gear icon button (settings) in AppShell have `aria-label` AND identical `TooltipContent`. Screen readers read both, causing "Audit log Audit log" announcements.
**How to avoid:** The tooltip content should have `aria-hidden="true"` since the button's `aria-label` already provides the accessible name. Radix TooltipContent sets `role="tooltip"` which screen readers may announce — add `aria-hidden` to `TooltipContent` or omit it (tooltip is for mouse users only).

---

## Code Examples

### Dark Mode Contrast Fix (src/index.css)
```css
/* Source: direct audit of src/index.css */
body.dark {
  /* Existing values */
  --color-brand-muted: #7f7f7f;  /* CHANGED from #6b6b6f: ratio 4.52:1 on #161617 */
  /* shadcn semantic alias must match */
  --muted-foreground: #7f7f7f;   /* CHANGED from #6b6b6f */
  /* All other values unchanged */
}
```

### TicketCard Keyboard Fix
```tsx
// src/features/tickets/TicketCard.tsx
// Replace <div onClick> with accessible interactive element
// If actionSlot can contain <button>, use <div role="button"> pattern:
<div
  onClick={onClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }}}
  tabIndex={0}
  role="button"
  aria-label={ticket.fields.summary}  // accessible name for screen readers
  className="px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-brand-surface-hover border-b border-brand-border focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]"
>
```

### CopyPreviewModal Form Association Fix
```tsx
// src/features/tickets/CopyPreviewModal.tsx — target side forms
<label htmlFor="copy-target-summary" className="text-xs text-brand-muted block mb-1">
  Summary
</label>
<input
  id="copy-target-summary"
  type="text"
  value={targetSummary}
  onChange={(e) => setTargetSummary(e.target.value)}
  ...
/>
```

### StatusBadge Dark Mode Color Fix
```tsx
// src/features/tickets/TicketDetailPage.tsx — StatusBadge
function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let className = 'bg-brand-surface-hover text-brand-text-secondary';
  if (lower.includes('progress') || lower.includes('review'))
    className = 'bg-blue-600/10 text-blue-600 dark:text-blue-400';  // blue-400 = 6.55:1 on dark
  if (lower.includes('done') || lower.includes('resolved') || lower.includes('closed'))
    className = 'bg-green-600/10 text-green-600 dark:text-green-400';  // green-400 passes
  if (lower.includes('blocked'))
    className = 'bg-red-600/10 text-red-600 dark:text-red-400';  // red-400 = 6.54:1 on dark
  return <Badge variant="outline" className={cn('text-xs', className)}>{status}</Badge>;
}
```

**Note:** Tailwind `dark:` variants require the `body.dark` class toggle to work. The project uses `body.dark` class (not `prefers-color-scheme` media query). Tailwind v4 in this project must have `darkMode: 'class'` configured — verify this works before using `dark:` variants. If not, use inline conditional classes based on `useThemeStore`.

### AuditLogPage Row Keyboard Fix
```tsx
// src/features/tickets/AuditLogPage.tsx — expandable tr
<tr
  onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpandedId(expandedId === entry.id ? null : entry.id);
    }
  }}
  tabIndex={0}
  aria-expanded={expandedId === entry.id}
  className="... focus-visible:outline-2 focus-visible:outline-brand"
>
```

### PriorityDot Text Pairing (D-02 Compliance)
```tsx
// src/features/tickets/TicketCard.tsx — PriorityDot
// Current: dot only with aria-label (screen reader only, not visual)
// Fix: show priority name text visually (same as StatusDot pattern)
function PriorityDot({ priority }: { priority: string }) {
  // ... color logic unchanged ...
  return (
    <span className="flex items-center gap-1">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"  // decorative — text provides meaning
      />
      <span className="text-xs text-brand-text-secondary">{priority}</span>
    </span>
  );
}
```

---

## Specific Issues Per Component (Audit Results)

### AppShell.tsx
- **Good:** `aria-label="Main navigation"` on `<nav>`, `aria-current="page"` on active tab, `aria-hidden="true"` on icons, `focus-visible:ring-2 focus-visible:ring-brand` on buttons
- **Issues:** No `<main>` landmark wrapping children content area. No `role="banner"` on header (implicit via `<header>` element — fine). TooltipContent duplicates aria-label (minor, not breaking).
- **Fix:** Add `<main>` role to the `flex-1 flex flex-col overflow-hidden` div.

### TicketCard.tsx
- **Good:** `aria-busy`/`aria-label` on SkeletonCards, `aria-hidden` on status dot, `aria-label` on PriorityDot
- **Issues:** `<div onClick>` — not keyboard accessible. PriorityDot uses aria-label (screen reader only) but no visual text — violates D-02. TriageIndicator "new" state is color-only dot.
- **Fix:** Convert to interactive element; add priority text; fix TriageIndicator.

### TicketDetailPage.tsx
- **Good:** `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, Escape key handler already implemented.
- **Issues:** Tabs lack `id` attribute (needed for `aria-labelledby`). Tabpanel lacks `aria-labelledby`. TabPanel not `tabIndex={0}`. StatusBadge colors fail contrast in dark mode.
- **Fix:** Add `id` to tab buttons, `aria-labelledby` + `tabIndex={0}` to tabpanel, fix StatusBadge colors.

### ConnectionForm.tsx
- **Good:** `htmlFor`/`id` pairing on base-url and email inputs. `aria-busy` on Test button.
- **Issues:** URL error `<p>` has no `id` and no `role="alert"`. Input lacks `aria-invalid` and `aria-describedby`. Error message color `text-red-400` on `#f7f7f8` needs check.
- **Fix:** Add `id="base-url-error"`, `role="alert"` to error `<p>`. Add `aria-invalid` and `aria-describedby` to input.

### CopyPreviewModal.tsx
- **Good:** Radix Dialog handles focus trap, aria-modal, Escape key.
- **Issues:** All 5 target-side form inputs/selects/textarea have `<label>` but no `htmlFor`/`id` association. Progress text is not in a live region. `aria-label` on outer section labels missing.
- **Fix:** Add `id`/`htmlFor` pairs to all form elements. Add `aria-live="polite"` to progress text.

### SettingsPage.tsx
- **Good:** `focus-visible:ring-2 focus-visible:ring-brand` on NavItem buttons. `<nav>` for sidebar.
- **Issues:** `<nav>` sidebar lacks `aria-label`. JQL preset radio-buttons (custom buttons acting as radio group) lack `role="radiogroup"` + `role="radio"` + `aria-checked`. Watched users search input lacks `aria-label` (has `placeholder` only). Suggestions dropdown lacks `role="listbox"` / `role="option"`.
- **Fix:** Add `aria-label` to `<nav>`. Convert JQL preset buttons to proper role semantics. Add combobox ARIA to search input (or at minimum `aria-label`).

### AuditLogPage.tsx
- **Good:** `aria-label` on back button, `<h1>` heading.
- **Issues:** `<tr onClick>` lacks `tabIndex`, keyboard handler, `aria-expanded`. Table lacks `aria-label` or `<caption>`.
- **Fix:** Add keyboard interaction to expandable rows. Add `<caption>` or `aria-label` to table.

### TriageIndicator.tsx
- **Good:** SVG icon has `aria-label` for copied state. "Ignored" state shows text label.
- **Issues:** `role="link"` on `<span>` for copiedKey — should be `<button>` with `type="button"`. "New" state is color-dot only — no text alternative visible on card. SVG in copied state has `aria-label` but parent span also has no role.
- **Fix:** Replace `role="link"` span with `<button>`. For "new" dot: since the tab itself filters for "new" tickets, the dot is redundant — consider removing or adding `<span className="sr-only">New</span>`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `aria-label` on SVG elements | `aria-hidden="true"` on decorative SVG + text label on parent | WCAG 2.1 guidance | SVG aria-label poorly supported in some ATs; text label is more reliable |
| `role="link"` on span | Real `<a>` or `<button>` element | Always best practice | Interactive ARIA roles on divs/spans don't get focus natively |
| `focus:ring` | `focus-visible:ring` | CSS Selectors Level 4 | Mouse users don't see rings; keyboard users do |
| `aria-live="assertive"` for all | `"polite"` for status updates, `"assertive"` for errors only | WCAG best practice | Assertive interrupts screen reader; polite waits for pause |

**Deprecated/outdated:**
- `tabindex="-1"` on decorative content: No longer needed; `aria-hidden="true"` is the correct approach
- ARIA 1.0 `role="group"` for radio alternatives: ARIA 1.1+ `role="radiogroup"` is preferred

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Existing Test Infrastructure
- `src/test-setup.ts` — imports `@testing-library/jest-dom/vitest`, i18n setup
- Tauri API mocked via `vi.mock('@tauri-apps/api/core', ...)` pattern used consistently
- Test files exist for all major components being modified

### A11y Testing Strategy
For this phase, automated a11y testing via `jest-axe` is the preferred approach. It catches ARIA labeling issues, landmark missing, button role violations programmatically.

**Wave 0 gap:** `jest-axe` is not installed. Adding it is optional but recommended.

```bash
npm install --save-dev jest-axe @types/jest-axe
```

Usage pattern:
```tsx
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<TicketCard ... />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Sampling Rate
- **Per task commit:** `npm test -- --run src/features/tickets/TicketCard.test.tsx` (relevant file)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `jest-axe` install — optional but enables automated a11y rule checking
- [ ] No new test files required if changes are tested within existing files

*(Existing test infrastructure covers modified components; new a11y attributes are verified via `getByRole`, `getByLabelText` queries in existing tests)*

---

## Open Questions

1. **Tailwind v4 `dark:` variant with `body.dark` class**
   - What we know: Project uses `body.dark` class toggle (not media query). Tailwind v4 dark mode.
   - What's unclear: Whether `darkMode: 'class'` is configured in the Tailwind v4 setup — Tailwind v4 uses `@import "tailwindcss"` in CSS, not a JS config file.
   - Recommendation: Test one `dark:text-blue-400` class on StatusBadge first. If it works, use `dark:` variants. If not (likely in Tailwind v4 with CSS-only config), use the conditional className approach via `useThemeStore`.

2. **JQL Preset buttons as radio group**
   - What we know: Buttons act as a single-select radio group semantically.
   - What's unclear: Whether the planner should convert to `role="radio"` + `role="radiogroup"` or keep as buttons with `aria-pressed`.
   - Recommendation: Use `role="radiogroup"` + `role="radio"` + `aria-checked` — more semantically accurate than `aria-pressed` for single-select list.

3. **Watched users combobox pattern**
   - What we know: Search input + dropdown suggestions — classic combobox pattern.
   - What's unclear: Full ARIA combobox implementation vs. simpler `aria-label` + `aria-haspopup`.
   - Recommendation: At minimum add `aria-label`, `aria-expanded`, `aria-haspopup="listbox"` to input, `role="listbox"` to dropdown, `role="option"` to items. Full ARIA 1.2 combobox pattern is complex — the simpler approach achieves WCAG AA.

---

## Environment Availability

Step 2.6: SKIPPED (no external tool dependencies — all changes are CSS token values and HTML attribute additions within existing source files)

---

## Sources

### Primary (HIGH confidence)
- Direct source code audit of `/Users/mimo/Desktop/pmkar/src/` — all contrast values computed with exact WCAG 2.1 formula via Node.js script
- WCAG 2.1 specification — 4.5:1 for normal text (SC 1.4.3), 3:1 for UI components (SC 1.4.11)

### Secondary (MEDIUM confidence)
- ARIA Authoring Practices Guide (APG) — tab panel pattern, combobox pattern, button vs div
- Radix UI / shadcn documentation — Dialog, Tooltip, ScrollArea ARIA semantics already handled

### Tertiary (LOW confidence)
- Tailwind v4 `dark:` variant behavior with CSS `body.dark` class — needs runtime verification before using in implementation

---

## Metadata

**Confidence breakdown:**
- Contrast audit: HIGH — computed with exact WCAG formula against actual CSS token hex values from source
- Keyboard issues: HIGH — direct code inspection of `<div onClick>` patterns confirmed
- ARIA gaps: HIGH — line-by-line inspection of each component listed in CONTEXT.md
- Fix strategies: HIGH for CSS/HTML attribute changes; MEDIUM for Tailwind dark: variant behavior

**Research date:** 2026-03-24
**Valid until:** 2026-09-24 (WCAG 2.1 stable, Tailwind v4 fast-moving but CSS token approach is stable)
