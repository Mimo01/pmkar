import { beforeEach, describe, expect, it } from 'vitest';
import { useUpdateStore } from '../updateStore';

const initialState = {
  status: 'idle' as const,
  updateInfo: null,
  progress: 0,
  errorMessage: null,
  lastCheckedAt: null,
};

const mockUpdateInfo = {
  version: '1.2.3',
  body: 'Fix critical bug',
  rawUpdate: { version: '1.2.3' },
};

describe('updateStore', () => {
  beforeEach(() => {
    useUpdateStore.setState(initialState);
  });

  describe('initial state', () => {
    it('has idle status', () => {
      expect(useUpdateStore.getState().status).toBe('idle');
    });

    it('has null updateInfo', () => {
      expect(useUpdateStore.getState().updateInfo).toBeNull();
    });

    it('has 0 progress', () => {
      expect(useUpdateStore.getState().progress).toBe(0);
    });

    it('has null errorMessage', () => {
      expect(useUpdateStore.getState().errorMessage).toBeNull();
    });

    it('has null lastCheckedAt', () => {
      expect(useUpdateStore.getState().lastCheckedAt).toBeNull();
    });
  });

  describe('setChecking', () => {
    it('transitions status to checking', () => {
      useUpdateStore.getState().setChecking();
      expect(useUpdateStore.getState().status).toBe('checking');
    });

    it('clears errorMessage', () => {
      useUpdateStore.setState({ errorMessage: 'previous error' });
      useUpdateStore.getState().setChecking();
      expect(useUpdateStore.getState().errorMessage).toBeNull();
    });
  });

  describe('setAvailable', () => {
    it('transitions status to available', () => {
      useUpdateStore.getState().setAvailable(mockUpdateInfo);
      expect(useUpdateStore.getState().status).toBe('available');
    });

    it('stores updateInfo with version, body, and rawUpdate', () => {
      useUpdateStore.getState().setAvailable(mockUpdateInfo);
      const info = useUpdateStore.getState().updateInfo;
      expect(info?.version).toBe('1.2.3');
      expect(info?.body).toBe('Fix critical bug');
      expect(info?.rawUpdate).toEqual({ version: '1.2.3' });
    });

    it('sets lastCheckedAt to an ISO string', () => {
      useUpdateStore.getState().setAvailable(mockUpdateInfo);
      const lastCheckedAt = useUpdateStore.getState().lastCheckedAt;
      expect(lastCheckedAt).not.toBeNull();
      expect(() => new Date(lastCheckedAt!).toISOString()).not.toThrow();
    });
  });

  describe('setUpToDate', () => {
    it('transitions status to up-to-date', () => {
      useUpdateStore.getState().setUpToDate();
      expect(useUpdateStore.getState().status).toBe('up-to-date');
    });

    it('clears updateInfo', () => {
      useUpdateStore.setState({ updateInfo: mockUpdateInfo });
      useUpdateStore.getState().setUpToDate();
      expect(useUpdateStore.getState().updateInfo).toBeNull();
    });

    it('sets lastCheckedAt to an ISO string', () => {
      useUpdateStore.getState().setUpToDate();
      const lastCheckedAt = useUpdateStore.getState().lastCheckedAt;
      expect(lastCheckedAt).not.toBeNull();
      expect(() => new Date(lastCheckedAt!).toISOString()).not.toThrow();
    });
  });

  describe('setDownloading', () => {
    it('transitions status to downloading', () => {
      useUpdateStore.getState().setDownloading();
      expect(useUpdateStore.getState().status).toBe('downloading');
    });

    it('resets progress to 0', () => {
      useUpdateStore.setState({ progress: 50 });
      useUpdateStore.getState().setDownloading();
      expect(useUpdateStore.getState().progress).toBe(0);
    });
  });

  describe('setInstalling', () => {
    it('transitions status to installing', () => {
      useUpdateStore.getState().setInstalling();
      expect(useUpdateStore.getState().status).toBe('installing');
    });

    it('sets progress to 100', () => {
      useUpdateStore.getState().setInstalling();
      expect(useUpdateStore.getState().progress).toBe(100);
    });
  });

  describe('setProgress', () => {
    it('updates progress value', () => {
      useUpdateStore.getState().setProgress(42);
      expect(useUpdateStore.getState().progress).toBe(42);
    });

    it('does not change status', () => {
      useUpdateStore.setState({ status: 'downloading' });
      useUpdateStore.getState().setProgress(75);
      expect(useUpdateStore.getState().status).toBe('downloading');
    });
  });

  describe('setError', () => {
    it('transitions status to error', () => {
      useUpdateStore.getState().setError('Something went wrong');
      expect(useUpdateStore.getState().status).toBe('error');
    });

    it('stores the error message', () => {
      useUpdateStore.getState().setError('Connection failed');
      expect(useUpdateStore.getState().errorMessage).toBe('Connection failed');
    });
  });

  describe('dismiss', () => {
    it('returns status to idle', () => {
      useUpdateStore.setState({ status: 'available' });
      useUpdateStore.getState().dismiss();
      expect(useUpdateStore.getState().status).toBe('idle');
    });

    it('keeps updateInfo', () => {
      useUpdateStore.setState({ status: 'available', updateInfo: mockUpdateInfo });
      useUpdateStore.getState().dismiss();
      expect(useUpdateStore.getState().updateInfo).toEqual(mockUpdateInfo);
    });
  });

  describe('reset', () => {
    it('returns status to idle', () => {
      useUpdateStore.setState({ status: 'downloading' });
      useUpdateStore.getState().reset();
      expect(useUpdateStore.getState().status).toBe('idle');
    });

    it('clears updateInfo', () => {
      useUpdateStore.setState({ updateInfo: mockUpdateInfo });
      useUpdateStore.getState().reset();
      expect(useUpdateStore.getState().updateInfo).toBeNull();
    });

    it('resets progress to 0', () => {
      useUpdateStore.setState({ progress: 80 });
      useUpdateStore.getState().reset();
      expect(useUpdateStore.getState().progress).toBe(0);
    });

    it('clears errorMessage', () => {
      useUpdateStore.setState({ errorMessage: 'some error' });
      useUpdateStore.getState().reset();
      expect(useUpdateStore.getState().errorMessage).toBeNull();
    });
  });
});
