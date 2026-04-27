---
phase: 17-field-discovery-mock-schema-fidelity
plan: 05
plan_id: 17-05
type: execute
wave: 2
depends_on: [17-03, 17-04]
files_modified:
  - src/features/connections/connectionStore.ts
  - src/features/connections/ProbeStatusBanner.tsx
  - src/features/connections/__tests__/ProbeStatusBanner.test.tsx
  - src/features/connections/ConnectionCard.tsx
  - src/App.tsx
autonomous: true
requirements:
  - DISC-04
tags:
  - frontend
  - zustand
  - banner
  - settings-pill
  - probe-wiring
  - tauri-invoke

must_haves:
  truths:
    - "connectionStore exposes probeStatus ('idle' | 'ok' | 'failed' | 'skipped'), probeError (string | null), probeEndpointUrl (string | null), probeStatusCode (number | null), probeBannerDismissed (boolean), runProbe(), dismissProbeBanner(), and prewarmIssueTypes()"
    - "runProbe() invokes 'probe_createmeta' Tauri command, maps ProbeResult.ok to probeStatus, maps hint to probeError, populates probeEndpointUrl + probeStatusCode; never throws"
    - "On runProbe() success (probeStatus === 'ok'), prewarmIssueTypes() is invoked which calls schemaCacheStore.preWarm(targetProjectKey) per D-01"
    - "ProbeStatusBanner renders only when probeStatus === 'failed' AND !probeBannerDismissed; banner shows endpoint URL + status code + hint per D-07"
    - "ProbeStatusBanner has a dismiss X button that calls dismissProbeBanner() (per-session, not persisted across launches per D-05)"
    - "ConnectionCard displays a red status pill on the Cloud connection row when probeStatus === 'failed' (D-08)"
    - "App-launch flow: After existing connection-validation flow completes, runProbe() is called; on success preWarm is fired; on failure banner + pill render"
    - "All vitest tests pass: banner renders/hidden states, dismiss interaction, connectionStore probe state transitions, ConnectionCard pill visibility"
  artifacts:
    - path: "src/features/connections/connectionStore.ts"
      provides: "Probe state fields + runProbe / dismissProbeBanner / prewarmIssueTypes actions"
      contains: "probeStatus"
    - path: "src/features/connections/ProbeStatusBanner.tsx"
      provides: "Standalone dismissable banner React component reading from connectionStore"
      contains: "probe-status-banner"
    - path: "src/features/connections/__tests__/ProbeStatusBanner.test.tsx"
      provides: "vitest tests covering renders/hidden/dismiss/error message format"
    - path: "src/features/connections/ConnectionCard.tsx"
      provides: "Red status pill on Cloud connection row driven by probeStatus"
      contains: "probe-status-pill"
    - path: "src/App.tsx"
      provides: "App-launch hook calling runProbe() after connection validation"
      contains: "runProbe"
  key_links:
    - from: "App.tsx connection-validation flow"
      to: "connectionStore.runProbe()"
      via: "useEffect after hasCompletedSetup confirmed"
      pattern: "runProbe"
    - from: "connectionStore.runProbe()"
      to: "schemaCacheStore.preWarm(targetProjectKey)"
      via: "on probeStatus 'ok' transition"
      pattern: "preWarm"
    - from: "ProbeStatusBanner"
      to: "useConnectionStore"
      via: "Zustand selector for probeStatus + probeError + probeEndpointUrl + probeStatusCode + probeBannerDismissed"
      pattern: "useConnectionStore"
---

<objective>
Wire the probe Tauri command into the frontend so failures surface in the two D-08 locations (app-shell banner + Settings → Connections red pill), and trigger the D-01 pre-warm of the target issue-type list on probe success.

Purpose: Closes DISC-04 — the user sees a clear, actionable error when paginated createmeta is unreachable, and the pre-warm fires automatically after a successful probe so the Phase 22 issue-type chooser renders without latency.

Output:
- connectionStore extended with probe state + actions
- New ProbeStatusBanner component (used in App shell)
- ConnectionCard updated with red status pill
- App.tsx wires runProbe into the launch flow
- vitest tests cover all new behavior; manual UAT recorded in 17-VALIDATION.md
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-03-typescript-fieldschema-types-PLAN.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-04-field-discovery-rust-module-and-commands-PLAN.md

<interfaces>
<!-- ProbeResult shape returned by 'probe_createmeta' Tauri command (Plan 04) -->
```typescript
interface ProbeResult {
  ok: boolean;
  endpointUrl: string;     // From Rust: serde camelCase rename of endpoint_url
  statusCode: number | null;
  hint: string | null;
}
```

<!-- Existing connectionStore.ts (state to extend) -->
```typescript
// Existing fields:
serverConnection, cloudConnection, sourceProjectKey, targetProjectKey,
sourceProjectName, targetProjectName,
loadProjectConfig, saveProjectConfig
```

<!-- schemaCacheStore.preWarm signature (Plan 03) -->
```typescript
preWarm: (projectKey: string) => Promise<void>;
```

<!-- Existing privacy banner pattern reference (Phase 16) -->
<!-- src/features/connections/SettingsPage.tsx + connectionStore privacyWarningDismissed field -->
<!-- Re-use: per-session boolean flag, X-icon dismiss button, sticky-ish position -->

<!-- Inline warning banner JSX pattern from src/features/tickets/TicketListPage.tsx:285-295 -->
```tsx
<div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3" role="alert" data-testid="probe-status-banner">
  <p className="text-sm text-red-400">{mainMessage}</p>
  <p className="text-xs text-brand-muted mt-1">{detailMessage}</p>
</div>
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend connectionStore with probe state + runProbe / dismissProbeBanner / prewarmIssueTypes actions; add unit tests</name>
  <files>src/features/connections/connectionStore.ts, src/features/connections/__tests__/connectionStore.probe.test.ts</files>
  <read_first>
    - src/features/connections/connectionStore.ts (current state shape — Phase 17 Plan 03 did not modify this file)
    - src/stores/schemaCacheStore.ts (after Plan 03 — preWarm signature)
    - src/features/connections/__tests__/SetupWizard.test.tsx (existing vitest patterns for stores via vi.mock)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md §"src/features/connections/connectionStore.ts"
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 5: Connection-time probe + pre-warm wiring"
  </read_first>
  <behavior>
    - probeStatus initial value: 'idle'
    - runProbe() called when targetProjectKey is null → no invoke; sets probeStatus to 'skipped', probeError null
    - runProbe() called when targetProjectKey is set → invokes 'probe_createmeta'; on resolve with ok=true sets probeStatus 'ok' and triggers prewarmIssueTypes(); on resolve with ok=false sets probeStatus 'failed' + populates probeEndpointUrl/probeStatusCode/probeError(=hint); on reject sets probeStatus 'failed' with probeError = 'Probe call rejected: <message>' (graceful)
    - dismissProbeBanner() sets probeBannerDismissed=true (per-session, not persisted)
    - prewarmIssueTypes() calls schemaCacheStore.getState().preWarm(targetProjectKey) when targetProjectKey non-null; no-op otherwise
    - All probe state fields are reset to initial when clearConnections() runs (so re-setup doesn't show stale banner)
  </behavior>
  <action>
**Step 1 — Create test file `src/features/connections/__tests__/connectionStore.probe.test.ts`:**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const preWarmMock = vi.fn();
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: {
    getState: () => ({ preWarm: preWarmMock }),
  },
  schemaCacheKey: () => '',
}));

import { useConnectionStore } from '../connectionStore';

describe('connectionStore probe', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    preWarmMock.mockReset();
    useConnectionStore.setState({
      serverConnection: null,
      cloudConnection: null,
      sourceProjectKey: null,
      targetProjectKey: null,
      sourceProjectName: null,
      targetProjectName: null,
      probeStatus: 'idle',
      probeError: null,
      probeEndpointUrl: null,
      probeStatusCode: null,
      probeBannerDismissed: false,
    });
  });

  it('initial probeStatus is "idle"', () => {
    expect(useConnectionStore.getState().probeStatus).toBe('idle');
  });

  it('runProbe sets status "skipped" when targetProjectKey is null', async () => {
    await useConnectionStore.getState().runProbe();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(useConnectionStore.getState().probeStatus).toBe('skipped');
  });

  it('runProbe success transitions to "ok" and triggers preWarm', async () => {
    useConnectionStore.setState({ targetProjectKey: 'MYPROJ' });
    invokeMock.mockResolvedValueOnce({
      ok: true,
      endpointUrl: 'http://example.com/rest/api/3/issue/createmeta/MYPROJ/issuetypes',
      statusCode: 200,
      hint: null,
    });
    await useConnectionStore.getState().runProbe();
    expect(invokeMock).toHaveBeenCalledWith('probe_createmeta');
    expect(useConnectionStore.getState().probeStatus).toBe('ok');
    expect(preWarmMock).toHaveBeenCalledWith('MYPROJ');
  });

  it('runProbe failure populates endpoint URL, status code, and hint', async () => {
    useConnectionStore.setState({ targetProjectKey: 'MYPROJ' });
    invokeMock.mockResolvedValueOnce({
      ok: false,
      endpointUrl: 'http://proxy/rest/api/3/issue/createmeta/MYPROJ/issuetypes',
      statusCode: 404,
      hint: 'Your proxy may not expose the paginated createmeta endpoint.',
    });
    await useConnectionStore.getState().runProbe();
    const s = useConnectionStore.getState();
    expect(s.probeStatus).toBe('failed');
    expect(s.probeEndpointUrl).toContain('createmeta');
    expect(s.probeStatusCode).toBe(404);
    expect(s.probeError).toContain('proxy');
    expect(preWarmMock).not.toHaveBeenCalled();
  });

  it('runProbe rejection is non-fatal and sets failed state', async () => {
    useConnectionStore.setState({ targetProjectKey: 'MYPROJ' });
    invokeMock.mockRejectedValueOnce(new Error('Tauri channel closed'));
    await expect(useConnectionStore.getState().runProbe()).resolves.toBeUndefined();
    expect(useConnectionStore.getState().probeStatus).toBe('failed');
    expect(useConnectionStore.getState().probeError).toContain('Tauri channel closed');
  });

  it('dismissProbeBanner sets probeBannerDismissed true', () => {
    useConnectionStore.getState().dismissProbeBanner();
    expect(useConnectionStore.getState().probeBannerDismissed).toBe(true);
  });

  it('clearConnections resets probe state', () => {
    useConnectionStore.setState({
      probeStatus: 'failed',
      probeError: 'old',
      probeBannerDismissed: true,
      probeEndpointUrl: 'old',
      probeStatusCode: 500,
    });
    useConnectionStore.getState().clearConnections();
    const s = useConnectionStore.getState();
    expect(s.probeStatus).toBe('idle');
    expect(s.probeError).toBeNull();
    expect(s.probeBannerDismissed).toBe(false);
    expect(s.probeEndpointUrl).toBeNull();
    expect(s.probeStatusCode).toBeNull();
  });

  it('prewarmIssueTypes is a no-op when targetProjectKey is null', async () => {
    await useConnectionStore.getState().prewarmIssueTypes();
    expect(preWarmMock).not.toHaveBeenCalled();
  });

  it('prewarmIssueTypes calls schemaCacheStore.preWarm when targetProjectKey set', async () => {
    useConnectionStore.setState({ targetProjectKey: 'OTHER' });
    await useConnectionStore.getState().prewarmIssueTypes();
    expect(preWarmMock).toHaveBeenCalledWith('OTHER');
  });
});
```

**Step 2 — Extend `src/features/connections/connectionStore.ts`:**

Update the `ConnectionState` interface and `create<ConnectionState>` factory to add the probe fields and actions. Final file shape:

```typescript
import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';
import type { ConnectionMeta } from './types';
import { useSchemaCacheStore } from '@/stores/schemaCacheStore';

export type ProbeStatus = 'idle' | 'ok' | 'failed' | 'skipped';

export interface ProbeResult {
  ok: boolean;
  endpointUrl: string;
  statusCode: number | null;
  hint: string | null;
}

interface ConnectionState {
  // ─── Existing ─────────────────────────────────────────────────────────────
  serverConnection: ConnectionMeta | null;
  cloudConnection: ConnectionMeta | null;
  sourceProjectKey: string | null;
  targetProjectKey: string | null;
  sourceProjectName: string | null;
  targetProjectName: string | null;
  setServerConnection: (meta: ConnectionMeta) => void;
  setCloudConnection: (meta: ConnectionMeta) => void;
  clearConnections: () => void;
  hasCompletedSetup: () => boolean;
  setSourceProjectKey: (key: string | null) => void;
  setTargetProjectKey: (key: string | null) => void;
  setSourceProjectName: (name: string | null) => void;
  setTargetProjectName: (name: string | null) => void;
  loadProjectConfig: () => Promise<void>;
  saveProjectConfig: (
    source: string | null,
    target: string | null,
    sourceName?: string | null,
    targetName?: string | null,
  ) => Promise<void>;

  // ─── Phase 17 probe (D-05/D-07/D-08) ──────────────────────────────────────
  probeStatus: ProbeStatus;
  probeError: string | null;
  probeEndpointUrl: string | null;
  probeStatusCode: number | null;
  probeBannerDismissed: boolean;
  runProbe: () => Promise<void>;
  dismissProbeBanner: () => void;
  prewarmIssueTypes: () => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  serverConnection: null,
  cloudConnection: null,
  sourceProjectKey: null,
  targetProjectKey: null,
  sourceProjectName: null,
  targetProjectName: null,
  probeStatus: 'idle',
  probeError: null,
  probeEndpointUrl: null,
  probeStatusCode: null,
  probeBannerDismissed: false,

  setServerConnection: (meta) => set({ serverConnection: meta }),
  setCloudConnection: (meta) => set({ cloudConnection: meta }),
  clearConnections: () =>
    set({
      serverConnection: null,
      cloudConnection: null,
      probeStatus: 'idle',
      probeError: null,
      probeEndpointUrl: null,
      probeStatusCode: null,
      probeBannerDismissed: false,
    }),
  hasCompletedSetup: () => get().serverConnection !== null && get().cloudConnection !== null,
  setSourceProjectKey: (key) => set({ sourceProjectKey: key }),
  setTargetProjectKey: (key) => set({ targetProjectKey: key }),
  setSourceProjectName: (name) => set({ sourceProjectName: name }),
  setTargetProjectName: (name) => set({ targetProjectName: name }),
  loadProjectConfig: async () => {
    try {
      const config = await invoke<{
        sourceProjectKey: string | null;
        targetProjectKey: string | null;
        sourceProjectName: string | null;
        targetProjectName: string | null;
      }>('get_project_config');
      set({
        sourceProjectKey: config.sourceProjectKey ?? null,
        targetProjectKey: config.targetProjectKey ?? null,
        sourceProjectName: config.sourceProjectName ?? null,
        targetProjectName: config.targetProjectName ?? null,
      });
    } catch {
      // Non-fatal
    }
  },
  saveProjectConfig: async (source, target, sourceName, targetName) => {
    try {
      await invoke('set_project_config', {
        sourceProjectKey: source,
        targetProjectKey: target,
        sourceProjectName: sourceName ?? null,
        targetProjectName: targetName ?? null,
      });
    } catch {
      // Non-fatal
    }
  },

  runProbe: async () => {
    const target = get().targetProjectKey;
    if (!target) {
      set({ probeStatus: 'skipped', probeError: null, probeEndpointUrl: null, probeStatusCode: null });
      return;
    }
    try {
      const result = await invoke<ProbeResult>('probe_createmeta');
      if (result.ok) {
        set({
          probeStatus: 'ok',
          probeError: null,
          probeEndpointUrl: result.endpointUrl,
          probeStatusCode: result.statusCode,
        });
        // Fire D-01 pre-warm (best effort, non-blocking)
        await get().prewarmIssueTypes();
      } else {
        set({
          probeStatus: 'failed',
          probeError: result.hint,
          probeEndpointUrl: result.endpointUrl,
          probeStatusCode: result.statusCode,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
      set({
        probeStatus: 'failed',
        probeError: `Probe call rejected: ${msg}`,
        probeEndpointUrl: null,
        probeStatusCode: null,
      });
    }
  },

  dismissProbeBanner: () => set({ probeBannerDismissed: true }),

  prewarmIssueTypes: async () => {
    const target = get().targetProjectKey;
    if (!target) return;
    await useSchemaCacheStore.getState().preWarm(target);
  },
}));
```

**Step 3 — Run tests:**

```bash
npx vitest run --no-coverage src/features/connections/__tests__/connectionStore.probe.test.ts
npx tsc --noEmit
```

All probe tests must pass; full project type-check stays green.
  </action>
  <verify>
    <automated>npx vitest run --no-coverage src/features/connections/__tests__/connectionStore.probe.test.ts 2>&1 | tail -10 && npx tsc --noEmit 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - File `src/features/connections/__tests__/connectionStore.probe.test.ts` exists
    - `grep -c "probeStatus" src/features/connections/connectionStore.ts` returns at least 5
    - `grep -c "runProbe" src/features/connections/connectionStore.ts` returns at least 2
    - `grep -c "dismissProbeBanner" src/features/connections/connectionStore.ts` returns at least 2
    - `grep -c "prewarmIssueTypes" src/features/connections/connectionStore.ts` returns at least 2
    - `grep -c "'probe_createmeta'" src/features/connections/connectionStore.ts` returns 1
    - `grep -c "useSchemaCacheStore" src/features/connections/connectionStore.ts` returns at least 1
    - `npx vitest run --no-coverage src/features/connections/__tests__/connectionStore.probe.test.ts` exits 0 (≥9 tests passing)
    - `npx tsc --noEmit` exits 0
    - Existing connectionStore consumers (ConnectionForm, SetupWizard, SettingsPage) still type-check (no breaking change to existing fields)
  </acceptance_criteria>
  <done>connectionStore extended with probe state + actions; all probe tests pass; project type-checks clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create ProbeStatusBanner component + tests, and add red status pill to ConnectionCard</name>
  <files>src/features/connections/ProbeStatusBanner.tsx, src/features/connections/__tests__/ProbeStatusBanner.test.tsx, src/features/connections/ConnectionCard.tsx</files>
  <read_first>
    - src/features/connections/ConnectionCard.tsx (existing component — see structure of cloud connection row)
    - src/features/tickets/TicketListPage.tsx lines 280-310 (warning banner JSX pattern to mirror)
    - src/features/connections/SettingsPage.tsx (where ProbeStatusBanner will also be reachable later — Plan 05 only ships banner, App.tsx renders it)
    - src/features/connections/__tests__/SetupWizard.test.tsx (existing RTL+vitest test pattern)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md §"src/features/connections/ProbeStatusBanner.tsx"
  </read_first>
  <behavior>
    - ProbeStatusBanner exports default React component
    - Renders nothing when probeStatus !== 'failed' OR probeBannerDismissed === true
    - When visible: red-tinted container with role="alert" data-testid="probe-status-banner"; main message "Required-field detection unavailable on Cloud target."; detail message includes endpoint URL + status code + hint exactly per D-07
    - Renders an X icon dismiss button (Lucide `X`); clicking calls dismissProbeBanner()
    - ConnectionCard receives an optional probeStatus prop OR reads from useConnectionStore; renders a small red pill with text "Discovery unavailable" data-testid="probe-status-pill" when the card represents the Cloud connection AND probeStatus === 'failed'
    - All vitest tests pass: banner visible/hidden, message content, dismiss interaction, pill visible only on Cloud row
  </behavior>
  <action>
**Step 1 — Create test file `src/features/connections/__tests__/ProbeStatusBanner.test.tsx`:**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProbeStatusBanner from '../ProbeStatusBanner';
import { useConnectionStore } from '../connectionStore';

vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: { getState: () => ({ preWarm: vi.fn() }) },
  schemaCacheKey: () => '',
}));

describe('ProbeStatusBanner', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      probeStatus: 'idle',
      probeError: null,
      probeEndpointUrl: null,
      probeStatusCode: null,
      probeBannerDismissed: false,
    });
  });

  it('renders nothing when probeStatus is "idle"', () => {
    render(<ProbeStatusBanner />);
    expect(screen.queryByTestId('probe-status-banner')).not.toBeInTheDocument();
  });

  it('renders nothing when probeStatus is "ok"', () => {
    useConnectionStore.setState({ probeStatus: 'ok' });
    render(<ProbeStatusBanner />);
    expect(screen.queryByTestId('probe-status-banner')).not.toBeInTheDocument();
  });

  it('renders banner when probeStatus is "failed"', () => {
    useConnectionStore.setState({
      probeStatus: 'failed',
      probeError: 'Your proxy may not expose the paginated createmeta endpoint.',
      probeEndpointUrl: 'https://example.com/rest/api/3/issue/createmeta/MYPROJ/issuetypes',
      probeStatusCode: 404,
    });
    render(<ProbeStatusBanner />);
    const banner = screen.getByTestId('probe-status-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Required-field detection unavailable');
    expect(banner.textContent).toContain('createmeta/MYPROJ/issuetypes');
    expect(banner.textContent).toContain('404');
    expect(banner.textContent).toContain('proxy');
  });

  it('hides banner once dismissed', () => {
    useConnectionStore.setState({
      probeStatus: 'failed',
      probeError: 'hint',
      probeEndpointUrl: 'http://x/y',
      probeStatusCode: 500,
      probeBannerDismissed: true,
    });
    render(<ProbeStatusBanner />);
    expect(screen.queryByTestId('probe-status-banner')).not.toBeInTheDocument();
  });

  it('clicking dismiss button calls dismissProbeBanner', () => {
    useConnectionStore.setState({
      probeStatus: 'failed',
      probeError: 'hint',
      probeEndpointUrl: 'http://x/y',
      probeStatusCode: 500,
    });
    render(<ProbeStatusBanner />);
    const btn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(btn);
    expect(useConnectionStore.getState().probeBannerDismissed).toBe(true);
  });
});
```

**Step 2 — Create `src/features/connections/ProbeStatusBanner.tsx`:**

```tsx
import { X } from 'lucide-react';
import { useConnectionStore } from './connectionStore';

export default function ProbeStatusBanner() {
  const probeStatus = useConnectionStore((s) => s.probeStatus);
  const probeError = useConnectionStore((s) => s.probeError);
  const probeEndpointUrl = useConnectionStore((s) => s.probeEndpointUrl);
  const probeStatusCode = useConnectionStore((s) => s.probeStatusCode);
  const probeBannerDismissed = useConnectionStore((s) => s.probeBannerDismissed);
  const dismissProbeBanner = useConnectionStore((s) => s.dismissProbeBanner);

  if (probeStatus !== 'failed' || probeBannerDismissed) {
    return null;
  }

  const detail = [
    probeEndpointUrl ? `Endpoint: ${probeEndpointUrl}` : null,
    probeStatusCode != null ? `HTTP ${probeStatusCode}` : null,
    probeError ?? null,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <div
      className="relative mx-4 mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3 pr-10"
      role="alert"
      data-testid="probe-status-banner"
    >
      <p className="text-sm text-red-400">Required-field detection unavailable on Cloud target.</p>
      <p className="text-xs text-brand-muted mt-1 break-all">{detail}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismissProbeBanner}
        className="absolute right-2 top-2 rounded p-1 text-brand-muted hover:bg-red-400/10"
        data-testid="probe-status-banner-dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

**Step 3 — Update `src/features/connections/ConnectionCard.tsx`** to render the red status pill on the Cloud connection row when probeStatus === 'failed'.

Locate the existing Cloud connection row in ConnectionCard (the variant where `connection.connection_type === 'cloud'` or the prop equivalent — read the file first and identify the existing render). Add the following pill render adjacent to the connection title/status indicator:

```tsx
import { useConnectionStore } from './connectionStore';

// inside the component body:
const probeStatus = useConnectionStore((s) => s.probeStatus);
const isCloudCard = /* existing detector based on connection prop type */;

// In the JSX, alongside existing status indicator(s):
{isCloudCard && probeStatus === 'failed' && (
  <span
    data-testid="probe-status-pill"
    className="ml-2 rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs text-red-400"
  >
    Discovery unavailable
  </span>
)}
```

If ConnectionCard is generic and renders both server/cloud variants, gate the pill render on whichever existing prop or context indicates "this row is the cloud connection". **Read ConnectionCard.tsx first** to identify the gate (likely `connection.connection_type === 'cloud'` or `kind === 'cloud'`).

**Step 4 — Run tests:**

```bash
npx vitest run --no-coverage src/features/connections/__tests__/ProbeStatusBanner.test.tsx
npx tsc --noEmit
```

All banner tests pass; project compiles.
  </action>
  <verify>
    <automated>npx vitest run --no-coverage src/features/connections/__tests__/ProbeStatusBanner.test.tsx 2>&1 | tail -10 && npx tsc --noEmit 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - File `src/features/connections/ProbeStatusBanner.tsx` exists
    - File `src/features/connections/__tests__/ProbeStatusBanner.test.tsx` exists
    - `grep -c 'data-testid="probe-status-banner"' src/features/connections/ProbeStatusBanner.tsx` returns 1
    - `grep -c 'Required-field detection unavailable' src/features/connections/ProbeStatusBanner.tsx` returns 1
    - `grep -c 'role="alert"' src/features/connections/ProbeStatusBanner.tsx` returns 1
    - `grep -c "from './connectionStore'" src/features/connections/ProbeStatusBanner.tsx` returns 1
    - `grep -c 'data-testid="probe-status-pill"' src/features/connections/ConnectionCard.tsx` returns 1
    - `grep -c 'Discovery unavailable' src/features/connections/ConnectionCard.tsx` returns 1
    - `npx vitest run --no-coverage src/features/connections/__tests__/ProbeStatusBanner.test.tsx` exits 0 (≥5 tests passing)
    - `npx tsc --noEmit` exits 0
    - `npx eslint src/features/connections/ProbeStatusBanner.tsx src/features/connections/ConnectionCard.tsx` exits 0
  </acceptance_criteria>
  <done>Banner component renders failure state per D-07 and is dismissable; ConnectionCard shows red pill on Cloud row when probe failed.</done>
</task>

<task type="auto">
  <name>Task 3: Wire runProbe into App.tsx launch flow and render ProbeStatusBanner in app shell</name>
  <files>src/App.tsx</files>
  <read_first>
    - src/App.tsx (full file — find where hasCompletedSetup is checked + where AppShell wraps the main routes; understand existing useEffect chain for connection validation)
    - src/features/connections/connectionStore.ts (after Task 1 — runProbe + clearConnections)
    - src/features/connections/ProbeStatusBanner.tsx (after Task 2)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md `<code_context>` "Connection-time probes at app launch"
  </read_first>
  <behavior>
    - On app launch, after the existing connection-validation flow concludes AND hasCompletedSetup() returns true, runProbe() is invoked exactly once
    - runProbe is also re-invoked when targetProjectKey changes (so saving a different target project triggers a new probe + pre-warm)
    - ProbeStatusBanner renders at the top of the main app shell layout (visible across all main routes; NOT shown during the SetupWizard since hasCompletedSetup is false there)
    - The existing route branches (wizard / settings / detail / main) are not disrupted; banner placement is purely additive
  </behavior>
  <action>
**Step 1 — Read App.tsx fully** to identify the existing route-branching pattern (per STATE.md `[Phase 02-03]`: three-branch conditional + later phases added a detail-page priority branch). Locate the place where the main app shell renders (the branch executed when hasCompletedSetup is true and not viewing settings/wizard/detail).

**Step 2 — Add a useEffect that runs runProbe on launch + when targetProjectKey changes:**

Near the top of the App component body (alongside other useEffect hooks):

```tsx
import { useEffect } from 'react';
import { useConnectionStore } from '@/features/connections/connectionStore';

// inside App component:
const hasCompletedSetup = useConnectionStore((s) => s.hasCompletedSetup());
const targetProjectKey = useConnectionStore((s) => s.targetProjectKey);
const runProbe = useConnectionStore((s) => s.runProbe);

useEffect(() => {
  if (hasCompletedSetup && targetProjectKey) {
    void runProbe();
  }
}, [hasCompletedSetup, targetProjectKey, runProbe]);
```

**Step 3 — Render ProbeStatusBanner at the top of the main shell:**

Import:
```tsx
import ProbeStatusBanner from '@/features/connections/ProbeStatusBanner';
```

Inside the JSX branch where the main app shell renders (the branch that's reached when not in wizard / settings / detail), add `<ProbeStatusBanner />` as the first child of the main content container, BEFORE the existing route content. Choose a placement that aligns with existing banners (e.g. immediately after the AppShell header). The banner is internally gated to render nothing when probeStatus !== 'failed', so the additive cost when probe is OK is zero.

**If the App layout uses an `<AppShell>` component** that wraps every main route, render ProbeStatusBanner inside AppShell (just below the header). If routing is ad-hoc, render it once per main route branch.

**Step 4 — Verify:**

```bash
npx vitest run --no-coverage
npx tsc --noEmit
npx eslint src/App.tsx
```

All must exit 0; no existing tests should regress.

**Step 5 — Update VALIDATION.md manual-only verifications** by setting the `nyquist_compliant` frontmatter field to `true` in `.planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md` once all Wave 0 + Wave 1 + Wave 2 automated tests are green. (Manual UAT for the visual banner + pill is already documented in VALIDATION.md §"Manual-Only Verifications" — no edit needed beyond setting `nyquist_compliant: true`.)
  </action>
  <verify>
    <automated>npx vitest run --no-coverage 2>&1 | tail -10 && npx tsc --noEmit 2>&1 | tail -3 && npx eslint src/App.tsx 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "ProbeStatusBanner" src/App.tsx` returns at least 2 (import + render)
    - `grep -c "runProbe" src/App.tsx` returns at least 1
    - `grep -c "useConnectionStore" src/App.tsx` returns at least 1
    - `grep -c "hasCompletedSetup" src/App.tsx` returns at least 1 (existing — confirm not removed)
    - `<ProbeStatusBanner />` is rendered in the main shell branch (not the wizard branch — `awk '/SetupWizard/{w=NR} /ProbeStatusBanner/{p=NR} END{exit !(p != w)}' src/App.tsx && echo ok` prints `ok`)
    - `npx vitest run --no-coverage` exits 0 (full frontend suite green)
    - `npx tsc --noEmit` exits 0
    - `npx eslint src/App.tsx src/features/connections/connectionStore.ts src/features/connections/ProbeStatusBanner.tsx src/features/connections/ConnectionCard.tsx` exits 0
    - `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server` still exits 0 (no Rust regression)
    - `nyquist_compliant: true` set in `.planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md` frontmatter
  </acceptance_criteria>
  <done>runProbe wired into app launch; banner renders in main shell; full vitest suite green; VALIDATION.md marked nyquist_compliant.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tauri invoke('probe_createmeta') return value → connectionStore | ProbeResult is structured; no free-form HTML; rendered as plain text |
| User-visible probe error message → React render | probeError + probeEndpointUrl interpolated as plain text via `{...}` (no dangerouslySetInnerHTML); React auto-escapes |
| dismissProbeBanner → per-session state | Not persisted; resets on app restart per D-05 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-18 | Tampering | ProbeResult fields rendered in banner | mitigate | Banner uses React text interpolation only — no dangerouslySetInnerHTML, no eval. Endpoint URL from Rust side already redacts credentials (T-17-03 from Plan 04). |
| T-17-19 | Information Disclosure | probeError stored in Zustand state | mitigate | probeError is only `result.hint` from ProbeResult — Plan 04 guarantees no credential leakage at the Rust serialization boundary. Plus Task-1 unit test verifies probe_redacts_credentials at the Rust side. |
| T-17-20 | DoS | runProbe useEffect dependency loop | mitigate | useEffect dependencies are stable selectors (hasCompletedSetup primitive boolean; targetProjectKey string; runProbe function reference is stable from Zustand `create`). No infinite re-render risk. |
| T-17-21 | Repudiation | Pre-warm fire-and-forget | accept | Pre-warm errors are silent per RESEARCH.md Open Question 3; the Rust audit middleware still logs the underlying HTTP attempt; user-visible state is unaffected. |
| T-17-22 | Spoofing | Banner appearance triggered by malicious probeStatus | mitigate | probeStatus state is only mutated via runProbe (which calls 'probe_createmeta') or clearConnections — no external API can set it to 'failed' |
</threat_model>

<verification>
- `npx vitest run --no-coverage` passes (full frontend suite, including new ProbeStatusBanner.test.tsx and connectionStore.probe.test.ts)
- `npx tsc --noEmit` exits 0
- `npx eslint src/...` for all modified files exits 0
- `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server` still passes (no Rust regression)
- App-launch flow calls runProbe() exactly when both hasCompletedSetup and targetProjectKey are truthy
- Banner shows endpoint URL + status code + hint per D-07 when probeStatus === 'failed'
- ConnectionCard renders red status pill on Cloud row in failure state (D-08)
- Pre-warm fires after probe success per D-01 reconciled with D-15 (issue-type LIST only, not per-issuetype schemas)
- `nyquist_compliant: true` set in 17-VALIDATION.md frontmatter
</verification>

<success_criteria>
- DISC-04: Connection-time probe verifies paginated createmeta is reachable; clear error UX when proxy/firewall blocks the endpoint
- D-05/D-08: Probe failure surfaces in two places (banner + status pill); both reachable via Settings → Connections + main app shell
- D-07: Error message includes exact endpoint URL + HTTP status code + one-line cause hint
- D-01: Pre-warm fetches issue-type list immediately after probe success
- D-15: Per-issuetype field schemas remain lazy (NOT pre-warmed) — verified by store contract (preWarm only stores IssueTypeRef[], never FieldSchema[])
- Banner is per-session-dismissable per D-05 (probeBannerDismissed resets on launch)
</success_criteria>

<output>
After completion, create `.planning/phases/17-field-discovery-mock-schema-fidelity/17-05-SUMMARY.md`
</output>
