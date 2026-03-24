import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { SecretInput } from './SecretInput';

const mockInvoke = vi.mocked(invoke);

const noop = () => {};

describe('SecretInput', () => {
  it('renders as password input by default', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl="https://example.com"
      />,
    );
    const input = screen.getByLabelText('Personal Access Token');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('eye icon toggles to text and back', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value="my-secret"
        onChange={noop}
        helpUrl="https://example.com"
      />,
    );
    const input = screen.getByLabelText('Personal Access Token');
    const toggleBtn = screen.getByRole('button', { name: 'Show token' });

    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide token' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('aria-label changes on toggle', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl="https://example.com"
      />,
    );
    const toggleBtn = screen.getByRole('button', { name: 'Show token' });
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show token');

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: 'Hide token' })).toHaveAttribute(
      'aria-label',
      'Hide token',
    );
  });

  it('renders help button with correct label', () => {
    const helpUrl = 'https://confluence.atlassian.com/help';
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl={helpUrl}
      />,
    );
    const helpBtn = screen.getByRole('button', { name: 'Where do I find this?' });
    expect(helpBtn).toBeInTheDocument();
  });

  it('disabled state applies to input', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl="https://example.com"
        disabled={true}
      />,
    );
    const input = screen.getByLabelText('Personal Access Token');
    expect(input).toBeDisabled();
  });

  it('clicking help button calls open_external_url invoke', () => {
    mockInvoke.mockResolvedValue(undefined);
    const helpUrl = 'https://docs.example.com/pat';
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl={helpUrl}
      />,
    );
    const helpBtn = screen.getByRole('button', { name: 'Where do I find this?' });
    fireEvent.click(helpBtn);
    expect(mockInvoke).toHaveBeenCalledWith('open_external_url', { url: helpUrl });
  });
});
