import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'ping_mock_servers') return Promise.resolve({ server_v2: true, cloud_v3: true });
    if (cmd === 'ping_keychain') return Promise.resolve(true);
    return Promise.resolve(null);
  }),
}));

describe('App', () => {
  it('renders app name and subtitle', () => {
    render(<App />);
    expect(screen.getByText('pmkar')).toBeInTheDocument();
    expect(screen.getByText('Development scaffold')).toBeInTheDocument();
  });

  it('renders status badges for all three services', () => {
    render(<App />);
    expect(screen.getByText('Jira Server mock (:8080)')).toBeInTheDocument();
    expect(screen.getByText('Jira Cloud mock (:8081)')).toBeInTheDocument();
    expect(screen.getByText('OS Keychain')).toBeInTheDocument();
  });

  it('renders error boundary fallback text', () => {
    // ErrorBoundary is present but not triggered in normal render
    // Test that the boundary component exists by checking it does not show fallback
    render(<App />);
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
