import { vi, describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { SettingsPage } from '../SettingsPage';
import { useConnectionStore } from '../connectionStore';
import { useLanguageStore } from '../../../i18n/languageStore';
import i18n from '../../../i18n/index';

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
