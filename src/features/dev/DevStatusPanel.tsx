import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StatusBadge, type BadgeStatus } from '../../components/ui/StatusBadge';

interface MockServerStatus {
  server_v2: boolean;
  cloud_v3: boolean;
}

export function DevStatusPanel() {
  const [serverV2, setServerV2] = useState<BadgeStatus>('loading');
  const [cloudV3, setCloudV3] = useState<BadgeStatus>('loading');
  const [keychain, setKeychain] = useState<BadgeStatus>('loading');

  useEffect(() => {
    async function checkStatus() {
      try {
        const result = await invoke<MockServerStatus>('ping_mock_servers');
        setServerV2(result.server_v2 ? 'healthy' : 'error');
        setCloudV3(result.cloud_v3 ? 'healthy' : 'error');
      } catch {
        setServerV2('error');
        setCloudV3('error');
      }

      try {
        const ok = await invoke<boolean>('ping_keychain');
        setKeychain(ok ? 'healthy' : 'error');
      } catch {
        setKeychain('error');
      }
    }

    checkStatus();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-[480px] p-6 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <h1 className="text-2xl font-semibold leading-tight text-slate-950 dark:text-slate-50 mb-1">
          pmkar
        </h1>
        <p className="text-sm font-normal leading-normal text-slate-500 dark:text-slate-400 mb-6">
          Development scaffold
        </p>
        <div className="space-y-1">
          <StatusBadge
            label="Jira Server mock (:8080)"
            status={serverV2}
            detail={serverV2 === 'error' ? 'Port 8080 unreachable' : undefined}
          />
          <StatusBadge
            label="Jira Cloud mock (:8081)"
            status={cloudV3}
            detail={cloudV3 === 'error' ? 'Port 8081 unreachable' : undefined}
          />
          <StatusBadge
            label="OS Keychain"
            status={keychain}
            detail={keychain === 'error' ? 'Keychain unavailable' : undefined}
          />
        </div>
      </div>
    </div>
  );
}
