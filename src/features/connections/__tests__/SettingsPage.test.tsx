import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../i18n/index';
import { useLanguageStore } from '../../../i18n/languageStore';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useConnectionStore } from '../connectionStore';
import { useTicketStore } from '../../tickets/ticketStore';
import { useThemeStore } from '../../theme/themeStore';
import { SettingsPage } from '../SettingsPage';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

const mockConnection = {
  baseUrl: 'https://jira.example.com',
  username: 'jdoe',
  serverVersion: '8.20.0',
  lastTestedAt: new Date().toISOString(),
  status: 'ok' as const,
};

const noop = () => {};

describe('SettingsPage — Sidebar navigation', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    useConnectionStore.setState({
      serverConnection: mockConnection,
      cloudConnection: mockConnection,
    });
    useLanguageStore.setState({ language: 'en' });
    i18n.changeLanguage('en');
  });

  it('renders sidebar with three group headings', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    expect(screen.getByText(/connections/i)).toBeInTheDocument();
    expect(screen.getByText(/fetching/i)).toBeInTheDocument();
    expect(screen.getByText(/appearance/i)).toBeInTheDocument();
  });

  it('renders sidebar nav items', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    expect(screen.getByRole('button', { name: /^Source$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Destination$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^JQL Presets$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Watched Users$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Theme$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Language$/i })).toBeInTheDocument();
  });

  it('Source section is active by default', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    const sourceNavItem = screen.getByRole('button', { name: /^Source$/i });
    expect(sourceNavItem.className).toContain('border-l-2');
    expect(sourceNavItem.className).toContain('border-brand');
    expect(sourceNavItem.className).toContain('font-semibold');
  });

  it('clicking a nav item switches the content panel', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);

    // Click Theme nav item
    const themeNavItem = screen.getByRole('button', { name: /^Theme$/i });
    fireEvent.click(themeNavItem);

    // Theme toggle buttons should appear
    expect(screen.getByRole('button', { name: /Light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /System/i })).toBeInTheDocument();

    // Click Language nav item
    const languageNavItem = screen.getByRole('button', { name: /^Language$/i });
    fireEvent.click(languageNavItem);

    // Language buttons should appear
    expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Slovak/i })).toBeInTheDocument();
  });

  it('sidebar back button calls onClose', () => {
    const onClose = vi.fn();
    renderWithI18n(<SettingsPage onClose={onClose} />);
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsPage — Language section', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    // Set connections so SettingsPage renders the full form (not "no connections" state)
    useConnectionStore.setState({
      serverConnection: mockConnection,
      cloudConnection: mockConnection,
    });
    // Reset language store to English
    useLanguageStore.setState({ language: 'en' });
    i18n.changeLanguage('en');
  });

  it('renders Language section heading', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    // Navigate to Language section via sidebar
    const languageNavItem = screen.getByRole('button', { name: /^Language$/i });
    fireEvent.click(languageNavItem);
    const headings = screen.getAllByText(/language/i);
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders language toggle buttons', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    // Navigate to Language section via sidebar
    const languageNavItem = screen.getByRole('button', { name: /^Language$/i });
    fireEvent.click(languageNavItem);
    expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Slovak/i })).toBeInTheDocument();
  });

  it('English button is visually selected by default', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    // Navigate to Language section via sidebar
    const languageNavItem = screen.getByRole('button', { name: /^Language$/i });
    fireEvent.click(languageNavItem);
    const enButton = screen.getByRole('button', { name: /English/i });
    expect(enButton.className).toContain('border-brand');
    expect(enButton.className).toContain('font-medium');
  });

  it('clicking Slovak updates language store', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    // Navigate to Language section via sidebar
    const languageNavItem = screen.getByRole('button', { name: /^Language$/i });
    fireEvent.click(languageNavItem);
    const skButton = screen.getByRole('button', { name: /Slovak/i });
    fireEvent.click(skButton);
    await waitFor(() => {
      expect(useLanguageStore.getState().language).toBe('sk');
    });
  });

  it('clicking Slovak calls invoke set_app_language', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    // Navigate to Language section via sidebar
    const languageNavItem = screen.getByRole('button', { name: /^Language$/i });
    fireEvent.click(languageNavItem);
    const skButton = screen.getByRole('button', { name: /Slovak/i });
    fireEvent.click(skButton);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_app_language', { language: 'sk' });
    });
  });

  it('after switching to Slovak, Settings heading text becomes Slovak', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    // Navigate to Language section via sidebar
    const languageNavItem = screen.getByRole('button', { name: /^Language$/i });
    fireEvent.click(languageNavItem);
    const skButton = screen.getByRole('button', { name: /Slovak/i });
    fireEvent.click(skButton);
    await waitFor(() => {
      expect(screen.getByText('Nastavenia')).toBeInTheDocument();
    });
  });
});

describe('SettingsPage — JQL Presets section', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    useConnectionStore.setState({
      serverConnection: mockConnection,
      cloudConnection: mockConnection,
    });
    useLanguageStore.setState({ language: 'en' });
    i18n.changeLanguage('en');
    useTicketStore.setState({
      tickets: [],
      triageMap: {},
      selectedTicketKey: null,
      fetchStatus: 'idle',
      fetchError: null,
      lastFetchedAt: null,
      totalCount: 0,
      newCount: 0,
      jqlPreset: 'assigned',
      jqlCustom: null,
      watchedUsers: [],
    });
  });

  it('navigates to JQL Presets section', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    const jqlNavItem = screen.getByRole('button', { name: /^JQL Presets$/i });
    fireEvent.click(jqlNavItem);
    expect(screen.getByRole('radiogroup', { name: /jql presets/i })).toBeInTheDocument();
  });

  it('shows all four preset options', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^JQL Presets$/i }));
    expect(screen.getByRole('radio', { name: /assigned/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /mentioned/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /all watched/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /custom/i })).toBeInTheDocument();
  });

  it('"Assigned to me" is selected by default', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^JQL Presets$/i }));
    const assignedRadio = screen.getByRole('radio', { name: /assigned/i });
    expect(assignedRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking a different preset updates the store', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^JQL Presets$/i }));
    fireEvent.click(screen.getByRole('radio', { name: /mentioned/i }));
    await waitFor(() => {
      expect(useTicketStore.getState().jqlPreset).toBe('mentioned');
    });
  });

  it('shows custom textarea when custom preset is selected', () => {
    useTicketStore.setState({ jqlPreset: 'custom' } as Parameters<typeof useTicketStore.setState>[0]);
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^JQL Presets$/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('SettingsPage — Theme section', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    useConnectionStore.setState({
      serverConnection: mockConnection,
      cloudConnection: mockConnection,
    });
    useLanguageStore.setState({ language: 'en' });
    i18n.changeLanguage('en');
    useThemeStore.setState({ mode: 'system', resolved: 'light' });
  });

  it('navigates to Theme section and shows theme buttons', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^Theme$/i }));
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
  });

  it('clicking Light updates theme store', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^Theme$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }));
    await waitFor(() => {
      expect(useThemeStore.getState().mode).toBe('light');
    });
  });

  it('clicking Dark updates theme store', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^Theme$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    await waitFor(() => {
      expect(useThemeStore.getState().mode).toBe('dark');
    });
  });
});

describe('SettingsPage — Source connection section', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    useConnectionStore.setState({
      serverConnection: mockConnection,
      cloudConnection: mockConnection,
    });
    useLanguageStore.setState({ language: 'en' });
    i18n.changeLanguage('en');
  });

  it('shows source connection card by default', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    // Source section is active by default — should show connection info (username appears in ConnectionCard)
    expect(screen.getAllByText(/jdoe|https:\/\/jira\.example\.com/i).length).toBeGreaterThan(0);
  });

  it('shows destination section when clicked', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^Destination$/i }));
    // Destination section should show a destination-related heading
    const destHeadings = screen.getAllByText(/destination/i);
    expect(destHeadings.length).toBeGreaterThan(0);
  });
});

describe('SettingsPage — Watched Users section', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    useConnectionStore.setState({
      serverConnection: mockConnection,
      cloudConnection: mockConnection,
    });
    useLanguageStore.setState({ language: 'en' });
    i18n.changeLanguage('en');
    useTicketStore.setState({
      tickets: [],
      triageMap: {},
      selectedTicketKey: null,
      fetchStatus: 'idle',
      fetchError: null,
      lastFetchedAt: null,
      totalCount: 0,
      newCount: 0,
      jqlPreset: 'assigned',
      jqlCustom: null,
      watchedUsers: [],
    });
  });

  it('shows search input in Watched Users section', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^Watched Users$/i }));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows empty state when no watched users', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^Watched Users$/i }));
    // Should show empty state text
    expect(screen.getByText(/no watched users|watchedUsers\.empty/i)).toBeInTheDocument();
  });

  it('shows existing watched users', () => {
    useTicketStore.setState({
      watchedUsers: ['alice'],
    } as Parameters<typeof useTicketStore.setState>[0]);
    renderWithI18n(<SettingsPage onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /^Watched Users$/i }));
    expect(screen.getByText('alice')).toBeInTheDocument();
  });
});
