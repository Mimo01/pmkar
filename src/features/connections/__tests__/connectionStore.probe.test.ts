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
