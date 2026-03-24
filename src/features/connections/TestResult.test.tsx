import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TestResult } from './TestResult';
import type { ConnectionTestResult } from './types';

const successServer: ConnectionTestResult = {
  success: true,
  username: 'jdoe',
  serverVersion: '8.20.0',
  errorKind: null,
  retryAfterSecs: null,
};

const successCloud: ConnectionTestResult = {
  success: true,
  username: 'jane.doe',
  serverVersion: '1001.0.0',
  errorKind: null,
  retryAfterSecs: null,
};

describe('TestResult', () => {
  it('renders nothing when result is null', () => {
    const { container } = render(<TestResult result={null} connectionType="server" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders success message with username and version for server', () => {
    render(<TestResult result={successServer} connectionType="server" />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Connected as jdoe — Jira Server v8.20.0');
  });

  it('renders success message for cloud', () => {
    render(<TestResult result={successCloud} connectionType="cloud" />);
    const el = screen.getByRole('status');
    expect(el).toHaveTextContent('Connected as jane.doe — Jira Cloud v1001.0.0');
  });

  it('renders auth error', () => {
    const result: ConnectionTestResult = {
      success: false,
      username: null,
      serverVersion: null,
      errorKind: 'auth',
      retryAfterSecs: null,
    };
    render(<TestResult result={result} connectionType="server" />);
    const el = screen.getByRole('alert');
    expect(el).toHaveTextContent('Authentication failed — check your PAT is valid');
  });

  it('renders forbidden error', () => {
    const result: ConnectionTestResult = {
      success: false,
      username: null,
      serverVersion: null,
      errorKind: 'forbidden',
      retryAfterSecs: null,
    };
    render(<TestResult result={result} connectionType="server" />);
    expect(screen.getByRole('alert')).toHaveTextContent('PAT lacks required permissions');
  });

  it('renders rate_limit error with seconds', () => {
    const result: ConnectionTestResult = {
      success: false,
      username: null,
      serverVersion: null,
      errorKind: 'rate_limit',
      retryAfterSecs: 30,
    };
    render(<TestResult result={result} connectionType="server" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Rate limited — try again in 30 seconds');
  });

  it('renders server_error', () => {
    const result: ConnectionTestResult = {
      success: false,
      username: null,
      serverVersion: null,
      errorKind: 'server_error',
      retryAfterSecs: null,
    };
    render(<TestResult result={result} connectionType="server" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Server error — try again later');
  });

  it('renders network error', () => {
    const result: ConnectionTestResult = {
      success: false,
      username: null,
      serverVersion: null,
      errorKind: 'network',
      retryAfterSecs: null,
    };
    render(<TestResult result={result} connectionType="server" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach server — check URL');
  });
});
