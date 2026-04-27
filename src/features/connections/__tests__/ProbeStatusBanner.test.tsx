import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProbeStatusBanner from '../ProbeStatusBanner';
import { useConnectionStore } from '../connectionStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

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
