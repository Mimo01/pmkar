import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionForm } from './ConnectionForm';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

const noop = () => {};

describe('ConnectionForm', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders Base URL and PAT fields for server type', () => {
    render(
      <ConnectionForm
        connectionType="server"
        onTestSuccess={noop}
        onTestInvalidated={noop}
      />,
    );
    expect(screen.getByLabelText('Base URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Personal Access Token')).toBeInTheDocument();
  });

  it('renders Base URL, Email, and API Token fields for cloud type', () => {
    render(
      <ConnectionForm
        connectionType="cloud"
        onTestSuccess={noop}
        onTestInvalidated={noop}
      />,
    );
    expect(screen.getByLabelText('Base URL')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
  });

  it('shows URL validation error on blur for non-https URL', () => {
    render(
      <ConnectionForm
        connectionType="server"
        onTestSuccess={noop}
        onTestInvalidated={noop}
      />,
    );
    const urlInput = screen.getByLabelText('Base URL');
    fireEvent.change(urlInput, { target: { value: 'http://example.com' } });
    fireEvent.blur(urlInput);
    expect(screen.getByText('HTTPS required for non-local URLs')).toBeInTheDocument();
  });

  it('strips trailing slash on blur', () => {
    render(
      <ConnectionForm
        connectionType="server"
        onTestSuccess={noop}
        onTestInvalidated={noop}
      />,
    );
    const urlInput = screen.getByLabelText('Base URL');
    fireEvent.change(urlInput, { target: { value: 'https://jira.example.com/' } });
    fireEvent.blur(urlInput);
    expect(urlInput).toHaveValue('https://jira.example.com');
  });

  it('Test Connection calls correct invoke for server', async () => {
    const successResult = {
      success: true,
      username: 'jdoe',
      serverVersion: '8.20.0',
      errorKind: null,
      retryAfterSecs: null,
    };
    mockInvoke.mockResolvedValueOnce(successResult);

    render(
      <ConnectionForm
        connectionType="server"
        onTestSuccess={noop}
        onTestInvalidated={noop}
      />,
    );

    const urlInput = screen.getByLabelText('Base URL');
    fireEvent.change(urlInput, { target: { value: 'https://jira.example.com' } });
    fireEvent.blur(urlInput);

    const patInput = screen.getByLabelText('Personal Access Token');
    fireEvent.change(patInput, { target: { value: 'my-pat-token' } });

    const testBtn = screen.getByRole('button', { name: 'Test Connection' });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('test_jira_server_connection', {
        baseUrl: 'https://jira.example.com',
        pat: 'my-pat-token',
      });
    });
  });

  it('Test Connection calls correct invoke for cloud', async () => {
    const successResult = {
      success: true,
      username: 'jane.doe',
      serverVersion: '1001.0.0',
      errorKind: null,
      retryAfterSecs: null,
    };
    mockInvoke.mockResolvedValueOnce(successResult);

    render(
      <ConnectionForm
        connectionType="cloud"
        onTestSuccess={noop}
        onTestInvalidated={noop}
      />,
    );

    const urlInput = screen.getByLabelText('Base URL');
    fireEvent.change(urlInput, { target: { value: 'https://mycompany.atlassian.net' } });
    fireEvent.blur(urlInput);

    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'user@company.com' } });

    const apiTokenInput = screen.getByLabelText('API Token');
    fireEvent.change(apiTokenInput, { target: { value: 'my-api-token' } });

    const testBtn = screen.getByRole('button', { name: 'Test Connection' });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('test_jira_cloud_connection', {
        baseUrl: 'https://mycompany.atlassian.net',
        email: 'user@company.com',
        apiToken: 'my-api-token',
      });
    });
  });

  it('Test Connection button disabled during test', async () => {
    let resolveTest!: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveTest = resolve;
    });
    mockInvoke.mockReturnValueOnce(pendingPromise);

    render(
      <ConnectionForm
        connectionType="server"
        onTestSuccess={noop}
        onTestInvalidated={noop}
      />,
    );

    const urlInput = screen.getByLabelText('Base URL');
    fireEvent.change(urlInput, { target: { value: 'https://jira.example.com' } });
    fireEvent.blur(urlInput);

    const patInput = screen.getByLabelText('Personal Access Token');
    fireEvent.change(patInput, { target: { value: 'my-pat' } });

    const testBtn = screen.getByRole('button', { name: 'Test Connection' });
    fireEvent.click(testBtn);

    // While testing, the button changes to "Testing..." and is disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Testing...' })).toBeDisabled();
    });

    // Clean up
    resolveTest({
      success: false,
      username: null,
      serverVersion: null,
      errorKind: 'network',
      retryAfterSecs: null,
    });
  });
});
