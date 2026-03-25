import { beforeEach, describe, expect, it } from 'vitest';
import { useConnectionStore } from '../connectionStore';
import type { ConnectionMeta } from '../types';

const makeConnectionMeta = (baseUrl: string): ConnectionMeta => ({
  baseUrl,
  username: 'testuser',
  serverVersion: '9.0.0',
  lastTestedAt: '2024-01-01T00:00:00.000Z',
  status: 'ok',
});

const initialState = {
  serverConnection: null,
  cloudConnection: null,
};

describe('connectionStore', () => {
  beforeEach(() => {
    useConnectionStore.setState(initialState);
  });

  describe('initial state', () => {
    it('has null serverConnection', () => {
      expect(useConnectionStore.getState().serverConnection).toBeNull();
    });

    it('has null cloudConnection', () => {
      expect(useConnectionStore.getState().cloudConnection).toBeNull();
    });
  });

  describe('setServerConnection', () => {
    it('sets serverConnection to provided meta', () => {
      const meta = makeConnectionMeta('http://server.example.com');
      useConnectionStore.getState().setServerConnection(meta);
      expect(useConnectionStore.getState().serverConnection).toEqual(meta);
    });

    it('updates serverConnection when called again', () => {
      const meta1 = makeConnectionMeta('http://old-server.com');
      const meta2 = makeConnectionMeta('http://new-server.com');
      useConnectionStore.getState().setServerConnection(meta1);
      useConnectionStore.getState().setServerConnection(meta2);
      expect(useConnectionStore.getState().serverConnection?.baseUrl).toBe('http://new-server.com');
    });
  });

  describe('setCloudConnection', () => {
    it('sets cloudConnection to provided meta', () => {
      const meta = makeConnectionMeta('https://mycompany.atlassian.net');
      useConnectionStore.getState().setCloudConnection(meta);
      expect(useConnectionStore.getState().cloudConnection).toEqual(meta);
    });

    it('does not affect serverConnection', () => {
      const serverMeta = makeConnectionMeta('http://server.example.com');
      const cloudMeta = makeConnectionMeta('https://mycompany.atlassian.net');
      useConnectionStore.getState().setServerConnection(serverMeta);
      useConnectionStore.getState().setCloudConnection(cloudMeta);

      expect(useConnectionStore.getState().serverConnection).toEqual(serverMeta);
    });
  });

  describe('clearConnections', () => {
    it('resets both connections to null', () => {
      const serverMeta = makeConnectionMeta('http://server.example.com');
      const cloudMeta = makeConnectionMeta('https://mycompany.atlassian.net');
      useConnectionStore.getState().setServerConnection(serverMeta);
      useConnectionStore.getState().setCloudConnection(cloudMeta);

      useConnectionStore.getState().clearConnections();

      expect(useConnectionStore.getState().serverConnection).toBeNull();
      expect(useConnectionStore.getState().cloudConnection).toBeNull();
    });
  });

  describe('setSourceProjectKey', () => {
    it('sets sourceProjectKey to the provided key', () => {
      useConnectionStore.getState().setSourceProjectKey('MYPROJ');
      expect(useConnectionStore.getState().sourceProjectKey).toBe('MYPROJ');
    });

    it('sets sourceProjectKey to null', () => {
      useConnectionStore.getState().setSourceProjectKey('MYPROJ');
      useConnectionStore.getState().setSourceProjectKey(null);
      expect(useConnectionStore.getState().sourceProjectKey).toBeNull();
    });

    it('does not affect cloudConnection', () => {
      const cloud = makeConnectionMeta('https://cloud.atlassian.net');
      useConnectionStore.getState().setCloudConnection(cloud);
      useConnectionStore.getState().setSourceProjectKey('MYPROJ');
      expect(useConnectionStore.getState().cloudConnection).toEqual(cloud);
    });
  });

  describe('setTargetProjectKey', () => {
    it('sets targetProjectKey to the provided key', () => {
      useConnectionStore.getState().setTargetProjectKey('DESTPROJ');
      expect(useConnectionStore.getState().targetProjectKey).toBe('DESTPROJ');
    });

    it('sets targetProjectKey to null', () => {
      useConnectionStore.getState().setTargetProjectKey('DESTPROJ');
      useConnectionStore.getState().setTargetProjectKey(null);
      expect(useConnectionStore.getState().targetProjectKey).toBeNull();
    });
  });

  describe('setSourceProjectName', () => {
    it('sets sourceProjectName', () => {
      useConnectionStore.getState().setSourceProjectName('My Source Project');
      expect(useConnectionStore.getState().sourceProjectName).toBe('My Source Project');
    });

    it('sets sourceProjectName to null', () => {
      useConnectionStore.getState().setSourceProjectName('Name');
      useConnectionStore.getState().setSourceProjectName(null);
      expect(useConnectionStore.getState().sourceProjectName).toBeNull();
    });
  });

  describe('setTargetProjectName', () => {
    it('sets targetProjectName', () => {
      useConnectionStore.getState().setTargetProjectName('My Target Project');
      expect(useConnectionStore.getState().targetProjectName).toBe('My Target Project');
    });

    it('sets targetProjectName to null', () => {
      useConnectionStore.getState().setTargetProjectName('Name');
      useConnectionStore.getState().setTargetProjectName(null);
      expect(useConnectionStore.getState().targetProjectName).toBeNull();
    });
  });

  describe('hasCompletedSetup', () => {
    it('returns false when both connections are null', () => {
      expect(useConnectionStore.getState().hasCompletedSetup()).toBe(false);
    });

    it('returns false when only serverConnection is set', () => {
      useConnectionStore.getState().setServerConnection(makeConnectionMeta('http://server'));
      expect(useConnectionStore.getState().hasCompletedSetup()).toBe(false);
    });

    it('returns false when only cloudConnection is set', () => {
      useConnectionStore.getState().setCloudConnection(makeConnectionMeta('https://cloud'));
      expect(useConnectionStore.getState().hasCompletedSetup()).toBe(false);
    });

    it('returns true when both connections are set', () => {
      useConnectionStore.getState().setServerConnection(makeConnectionMeta('http://server'));
      useConnectionStore.getState().setCloudConnection(makeConnectionMeta('https://cloud'));
      expect(useConnectionStore.getState().hasCompletedSetup()).toBe(true);
    });

    it('returns false after clearConnections', () => {
      useConnectionStore.getState().setServerConnection(makeConnectionMeta('http://server'));
      useConnectionStore.getState().setCloudConnection(makeConnectionMeta('https://cloud'));
      useConnectionStore.getState().clearConnections();

      expect(useConnectionStore.getState().hasCompletedSetup()).toBe(false);
    });
  });
});
