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
    const headings = screen.getAllByText(/language/i);
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders language toggle buttons', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Slovak/i })).toBeInTheDocument();
  });

  it('English button is visually selected by default', () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    const enButton = screen.getByRole('button', { name: /English/i });
    expect(enButton.className).toContain('border-brand');
    expect(enButton.className).toContain('font-semibold');
  });

  it('clicking Slovak updates language store', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    const skButton = screen.getByRole('button', { name: /Slovak/i });
    fireEvent.click(skButton);
    await waitFor(() => {
      expect(useLanguageStore.getState().language).toBe('sk');
    });
  });

  it('clicking Slovak calls invoke set_app_language', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    const skButton = screen.getByRole('button', { name: /Slovak/i });
    fireEvent.click(skButton);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_app_language', { language: 'sk' });
    });
  });

  it('after switching to Slovak, Settings heading text becomes Slovak', async () => {
    renderWithI18n(<SettingsPage onClose={noop} />);
    const skButton = screen.getByRole('button', { name: /Slovak/i });
    fireEvent.click(skButton);
    await waitFor(() => {
      expect(screen.getByText('Nastavenia')).toBeInTheDocument();
    });
  });
});
