import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// OverviewTab -> AllFieldsSection reads source schema on mount.
vi.mock('@/stores/schemaCacheStore', () => ({
  useSchemaCacheStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        cache: { 'source|__null__|__null__': { status: 'success', fields: [] } },
        loadSchema: vi.fn(),
      }),
    {
      getState: () => ({
        cache: { 'source|__null__|__null__': { status: 'success', fields: [] } },
        loadSchema: vi.fn(),
      }),
    },
  ),
  schemaCacheKey: (side: string, pk: string | null, it: string | null) =>
    `${side}|${pk ?? '__null__'}|${it ?? '__null__'}`,
}));

import { useAnnouncerStore } from '../../../components/LiveAnnouncer';
import i18n from '../../../i18n/index';
import { useConnectionStore } from '../../connections/connectionStore';
import { TicketDetailPage } from '../TicketDetailPage';
import { TicketDetailPanel } from '../TicketDetailPanel';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket, JiraTicketDetail, TriageEntry } from '../types';

const KEY = 'PROJ-1';
const CLOUD = 'CL-1';
const BASE = 'http://server.example.com';

const AXE_OPTIONS = {
  rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
};

function mkTicket(key: string): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      status: {
        name: 'Open',
        id: '1',
        statusCategory: { key: 'new' },
      } as JiraTicket['fields']['status'],
      priority: { name: 'High', id: '2' },
      assignee: null,
      created: '2026-01-01T10:00:00.000Z',
      updated: '2026-01-01T10:00:00.000Z',
    },
  };
}

function mkDetail(key: string): JiraTicketDetail {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary ${key}`,
      status: { name: 'Open', id: '1', statusCategory: { key: 'new' } },
      priority: { name: 'High', id: '2' },
      assignee: null,
      reporter: null,
      description: null,
      labels: [],
      components: [],
      fixVersions: [],
      comment: { comments: [] },
      attachment: [],
      subtasks: [],
      issuelinks: [],
      updated: '2026-01-01T10:00:00.000Z',
    },
  } as unknown as JiraTicketDetail;
}

let relinkImpl: () => Promise<unknown> = () => Promise.resolve(CLOUD);

function callsOf(cmd: string) {
  return invokeMock.mock.calls.filter((c) => c[0] === cmd);
}

function seed(entry: TriageEntry | undefined) {
  useTicketStore.setState({
    tickets: [mkTicket(KEY)],
    triageMap: entry ? { [KEY]: entry } : {},
    selectedTicketKey: null,
  });
}

const LINKED: TriageEntry = { state: 'copied', copiedKey: CLOUD };
const DENIED: TriageEntry = { state: 'ignored', copiedKey: CLOUD };

type Surface = 'page' | 'panel';

async function renderSurface(surface: Surface) {
  if (surface === 'page') {
    render(<TicketDetailPage issueKey={KEY} onBack={vi.fn()} />);
  } else {
    render(<TicketDetailPanel issueKey={KEY} baseUrl={BASE} onClose={vi.fn()} />);
  }
  // Wait for detail to load (the Overview tab / content appears once fetched)
  await waitFor(() => expect(callsOf('fetch_ticket_detail').length).toBeGreaterThan(0));
  await screen.findAllByText(`Summary ${KEY}`);
  // Start tabbing from the document start (the panel focuses its close button on load).
  await waitFor(() => expect(document.activeElement).not.toBeNull());
  (document.activeElement as HTMLElement | null)?.blur();
}

async function tabTo(user: ReturnType<typeof userEvent.setup>, name: string) {
  const target = await screen.findByRole('button', { name });
  for (let i = 0; i < 40; i++) {
    if (document.activeElement === target) return target;
    await user.tab();
  }
  expect(document.activeElement).toBe(target);
  return target;
}

/** Keyboard-confirm the open dialog: Cancel is focused first, Tab to Confirm, Enter. */
async function keyboardConfirm(user: ReturnType<typeof userEvent.setup>) {
  const dlg = await screen.findByRole('alertdialog');
  const cancel = within(dlg).getByRole('button', { name: i18n.t('triage.confirm.cancel') });
  await waitFor(() => expect(document.activeElement).toBe(cancel));
  await user.tab();
  expect((document.activeElement as HTMLElement).textContent).not.toBe(
    i18n.t('triage.confirm.cancel'),
  );
  await user.keyboard('{Enter}');
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
}

describe.each<Surface>(['page', 'panel'])('triage keyboard operability: %s (D-06)', (surface) => {
  const deny = () => i18n.t('detail.deny');
  const restoreLink = () => i18n.t('detail.restoreLink', { key: CLOUD });
  const restore = () => i18n.t('ignored.restore');
  const dismiss = () => i18n.t('detail.ignore');

  beforeEach(() => {
    invokeMock.mockReset();
    relinkImpl = () => Promise.resolve(CLOUD);
    invokeMock.mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === 'fetch_ticket_detail') {
        return Promise.resolve(mkDetail((args as { issueKey: string }).issueKey));
      }
      if (cmd === 'set_triage_state') return Promise.resolve(undefined);
      if (cmd === 'relink_ticket') return relinkImpl();
      return Promise.resolve([]);
    });
    useConnectionStore.setState({
      serverConnection: {
        baseUrl: BASE,
        username: 'u',
        serverVersion: '9.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
      cloudConnection: {
        baseUrl: 'https://company.atlassian.net',
        username: 'c',
        serverVersion: '1000.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
    });
  });

  describe.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('activation with %s', (_label, keys) => {
    it('Deny: Tab reaches it, activates, focus lands on Restore link', async () => {
      seed(LINKED);
      await renderSurface(surface);
      const user = userEvent.setup();
      await tabTo(user, deny());
      await user.keyboard(keys);
      await keyboardConfirm(user);
      await waitFor(() =>
        expect(callsOf('set_triage_state')[0]?.[1]).toMatchObject({
          ticketKey: KEY,
          state: 'ignored',
        }),
      );
      const primary = await screen.findByRole('button', { name: restoreLink() });
      await waitFor(() => expect(document.activeElement).toBe(primary));
    });

    it('Restore link: activates relink_ticket, focus lands on Linked badge', async () => {
      seed(DENIED);
      await renderSurface(surface);
      const user = userEvent.setup();
      await tabTo(user, restoreLink());
      await user.keyboard(keys);
      await keyboardConfirm(user);
      await waitFor(() => expect(callsOf('relink_ticket').length).toBe(1));
      await waitFor(() => {
        const active = document.activeElement as HTMLElement;
        expect(active.getAttribute('tabindex')).toBe('-1');
        expect(active.textContent).toContain(CLOUD);
      });
    });

    it('Restore: relinks a remembered key, focus lands on Linked badge', async () => {
      seed(DENIED);
      await renderSurface(surface);
      const user = userEvent.setup();
      await tabTo(user, restore());
      await user.keyboard(keys);
      await waitFor(() => expect(callsOf('relink_ticket').length).toBe(1));
      expect(callsOf('set_triage_state')).toHaveLength(0);
      await waitFor(() => {
        const active = document.activeElement as HTMLElement;
        expect(active.getAttribute('tabindex')).toBe('-1');
        expect(active.textContent).toContain(CLOUD);
      });
    });

    it('Restore: falls back to seen when relink fails, focus lands on Dismiss', async () => {
      seed(DENIED);
      relinkImpl = () => Promise.reject(new Error('x'));
      await renderSurface(surface);
      const user = userEvent.setup();
      await tabTo(user, restore());
      await user.keyboard(keys);
      await waitFor(() =>
        expect(callsOf('set_triage_state')[0]?.[1]).toMatchObject({ state: 'seen' }),
      );
      const dismissBtn = await screen.findByRole('button', { name: dismiss() });
      await waitFor(() => expect(document.activeElement).toBe(dismissBtn));
    });
  });

  it('Dismiss: reachable by Tab and Enter denies', async () => {
    seed(undefined);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, dismiss());
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(callsOf('set_triage_state')[0]?.[1]).toMatchObject({ state: 'ignored' }),
    );
  });

  it('keeps focus on the primary button while a link is in flight and cannot double submit', async () => {
    relinkImpl = () => new Promise(() => {});
    seed(DENIED);
    await renderSurface(surface);
    const user = userEvent.setup();
    const primary = await tabTo(user, restoreLink());
    await user.keyboard('{Enter}');
    await keyboardConfirm(user);
    await waitFor(() => expect(callsOf('relink_ticket').length).toBe(1));
    await waitFor(() => expect(primary).toHaveAttribute('aria-disabled', 'true'));
    expect(primary).not.toHaveAttribute('disabled');
    expect(document.activeElement).toBe(primary);
    await user.keyboard('{Enter}');
    expect(callsOf('relink_ticket').length).toBe(1);
    expect(document.activeElement).toBe(primary);
  });

  it('Deny via Space then Escape: focus back on Deny, nothing written', async () => {
    seed(LINKED);
    await renderSurface(surface);
    const user = userEvent.setup();
    const denyBtn = await tabTo(user, deny());
    await user.keyboard(' ');
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(callsOf('set_triage_state').length).toBe(0);
    await waitFor(() => expect(document.activeElement).toBe(denyBtn));
  });

  it('dialog traps focus with Tab and Shift+Tab', async () => {
    seed(LINKED);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, deny());
    await user.keyboard('{Enter}');
    const dlg = await screen.findByRole('alertdialog');
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(dlg.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      await user.tab({ shift: true });
      expect(dlg.contains(document.activeElement)).toBe(true);
    }
  });

  it('has no axe violations with the deny and link dialogs open', async () => {
    seed(LINKED);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, deny());
    await user.keyboard('{Enter}');
    await screen.findByRole('alertdialog');
    expect(await axe(document.body, AXE_OPTIONS)).toHaveNoViolations();
  });

  it('has no axe violations with the link dialog open', async () => {
    seed(DENIED);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, restoreLink());
    await user.keyboard('{Enter}');
    await screen.findByRole('alertdialog');
    expect(await axe(document.body, AXE_OPTIONS)).toHaveNoViolations();
  });

  it('SK: deny dialog title is localized', async () => {
    await i18n.changeLanguage('sk');
    try {
      seed(LINKED);
      await renderSurface(surface);
      const user = userEvent.setup();
      await tabTo(user, i18n.t('detail.deny'));
      await user.keyboard('{Enter}');
      const dlg = await screen.findByRole('alertdialog');
      expect(dlg.textContent).toContain('Zamietnuté');
      expect(dlg.textContent).toContain('Presunúť');
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  describe('static button audit', () => {
    const cases: [string, TriageEntry | undefined, () => string][] = [
      ['Deny', LINKED, deny],
      ['Restore link', DENIED, restoreLink],
      ['Restore', DENIED, restore],
      ['Dismiss', undefined, dismiss],
      [
        'Copy',
        undefined,
        () => i18n.t('detail.copy', { name: i18n.t('wizard.destination.subtitle') }),
      ],
    ];

    it.each(
      cases,
    )('%s: native button, named by visible label, ringed, not hidden', async (_n, entry, label) => {
      seed(entry);
      await renderSurface(surface);
      const el = await screen.findByRole('button', { name: label() });
      expect(el.tagName).toBe('BUTTON');
      // shadcn Button omits type (inert outside a form); raw panel buttons must be type=button.
      if (surface === 'panel') expect(el).toHaveAttribute('type', 'button');
      expect(el).not.toHaveAttribute('type', 'submit');
      expect(el).not.toHaveAttribute('tabindex', '-1');
      expect(el.closest('[aria-hidden="true"]')).toBeNull();
      expect((el.textContent ?? '').trim()).toBe(label());
      expect(el.className).toContain('focus-visible:ring-2');
    });
  });

  it('has no axe violations (linked and denied)', async () => {
    seed(LINKED);
    await renderSurface(surface);
    await screen.findByRole('button', { name: deny() });
    expect(await axe(document.body, AXE_OPTIONS)).toHaveNoViolations();
  });
});

const WATCHED: TriageEntry = { state: 'watched', copiedKey: CLOUD };

describe.each<Surface>(['page', 'panel'])('Watched keyboard operability: %s (D-12)', (surface) => {
  const watch = () => i18n.t('detail.watch');
  const deny = () => i18n.t('detail.deny');
  const restoreLink = () => i18n.t('detail.restoreLink', { key: CLOUD });
  const restoreWatched = () => i18n.t('watched.restore');
  const dismiss = () => i18n.t('detail.ignore');
  const announced = () => useAnnouncerStore.getState().message;
  const notBody = () => expect(document.activeElement).not.toBe(document.body);

  beforeEach(() => {
    invokeMock.mockReset();
    vi.mocked(toast).mockClear();
    useAnnouncerStore.setState({ message: '', nonce: 0 });
    invokeMock.mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === 'fetch_ticket_detail') {
        return Promise.resolve(mkDetail((args as { issueKey: string }).issueKey));
      }
      if (cmd === 'set_triage_state') return Promise.resolve(undefined);
      if (cmd === 'relink_ticket') return Promise.resolve(CLOUD);
      return Promise.resolve([]);
    });
    useConnectionStore.setState({
      serverConnection: {
        baseUrl: BASE,
        username: 'u',
        serverVersion: '9.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
      cloudConnection: {
        baseUrl: 'https://company.atlassian.net',
        username: 'c',
        serverVersion: '1000.0.0',
        lastTestedAt: '2024-01-01T00:00:00.000Z',
        status: 'ok',
      },
    });
  });

  it('Linked -> Watched: Cancel focused, Escape returns to Watch, confirm announces and focuses Restore link', async () => {
    seed(LINKED);
    await renderSurface(surface);
    const user = userEvent.setup();
    const watchBtn = await tabTo(user, watch());
    await user.keyboard('{Enter}');
    const dlg = await screen.findByRole('alertdialog');
    const cancel = within(dlg).getByRole('button', { name: i18n.t('triage.confirm.cancel') });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(callsOf('set_triage_state')).toHaveLength(0);
    await waitFor(() => expect(document.activeElement).toBe(watchBtn));

    await user.keyboard('{Enter}');
    await keyboardConfirm(user);
    await waitFor(() =>
      expect(callsOf('set_triage_state')[0]?.[1]).toMatchObject({
        ticketKey: KEY,
        state: 'watched',
      }),
    );
    await waitFor(() => expect(announced()).toBe(i18n.t('a11y.watched', { key: KEY })));
    expect(announced()).toContain('moved to Watched');
    const primary = await screen.findByRole('button', { name: restoreLink() });
    await waitFor(() => expect(document.activeElement).toBe(primary));
    notBody();
  });

  it('Dismissed -> Watched: instant, announced, focus on primary, Undo offered', async () => {
    seed(DENIED);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, watch());
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(announced()).toBe(i18n.t('a11y.watched', { key: KEY })));
    const primary = await screen.findByRole('button', { name: restoreLink() });
    await waitFor(() => expect(document.activeElement).toBe(primary));
    notBody();
    const call = vi.mocked(toast).mock.calls.find((c) => c[1]?.id === `watch-${KEY}`);
    expect((call?.[1] as { action?: { label: string } }).action?.label).toBe(i18n.t('triage.undo'));
  });

  it('Watched -> Dismissed: Deny is instant, announced, focus on primary', async () => {
    seed(WATCHED);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, deny());
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(announced()).toBe(i18n.t('a11y.denied', { key: KEY })));
    expect(announced()).toContain('moved to Dismissed');
    const primary = await screen.findByRole('button', { name: restoreLink() });
    await waitFor(() => expect(document.activeElement).toBe(primary));
    notBody();
  });

  it('Watched -> Linked: Restore link confirms, announces, focus on Linked badge', async () => {
    seed(WATCHED);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, restoreLink());
    await user.keyboard('{Enter}');
    await keyboardConfirm(user);
    await waitFor(() => expect(callsOf('relink_ticket').length).toBe(1));
    await waitFor(() =>
      expect(announced()).toBe(i18n.t('a11y.linked', { key: KEY, cloudKey: CLOUD })),
    );
    await waitFor(() => {
      const active = document.activeElement as HTMLElement;
      expect(active.getAttribute('tabindex')).toBe('-1');
      expect(active.textContent).toContain(CLOUD);
    });
    notBody();
  });

  it('Watched -> seen: Restore announces and focus lands on Dismiss', async () => {
    seed(WATCHED);
    await renderSurface(surface);
    const user = userEvent.setup();
    await tabTo(user, restoreWatched());
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(callsOf('set_triage_state')[0]?.[1]).toMatchObject({ state: 'seen' }),
    );
    await waitFor(() => expect(announced()).toBe(i18n.t('a11y.restored', { key: KEY })));
    const dismissBtn = await screen.findByRole('button', { name: dismiss() });
    await waitFor(() => expect(document.activeElement).toBe(dismissBtn));
    notBody();
  });
});
