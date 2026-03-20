export type ConnectionStatus = 'unconfigured' | 'ok' | 'error';

export interface ConnectionMeta {
  baseUrl: string;
  username: string;         // displayName from /myself (Server: name, Cloud: displayName)
  serverVersion: string;    // version from /serverInfo
  lastTestedAt: string;     // ISO 8601 timestamp
  status: ConnectionStatus;
}

// Mirrors Rust ConnectionTestResult (camelCase — Tauri serializes snake_case to camelCase)
export interface ConnectionTestResult {
  success: boolean;
  username: string | null;
  serverVersion: string | null;
  errorKind: string | null;   // "auth" | "forbidden" | "rate_limit" | "server_error" | "network"
  retryAfterSecs: number | null;
}

export type ConnectionType = 'server' | 'cloud';
