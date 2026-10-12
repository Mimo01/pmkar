import type { JqlPreset, WatchedUser } from './types';

// The signature must cover every input that changes the fetched JQL (D-14; RESEARCH assumption A1).
// If a new fetch input is added, extend FetchSignatureInput and computeFetchSignature.

export interface FetchSignatureInput {
  baseUrl: string | null;
  username: string | null;
  preset: JqlPreset;
  custom: string | null;
  projectKey: string | null;
  watchedIdentifiers: readonly string[];
}

export function computeFetchSignature(input: FetchSignatureInput): string {
  return JSON.stringify([
    input.baseUrl,
    input.username,
    input.preset,
    input.preset === 'custom' ? input.custom : null,
    input.projectKey,
    input.preset === 'all_watched' ? [...input.watchedIdentifiers].sort() : [],
  ]);
}

export function currentFetchSignatureInput(
  ticket: { jqlPreset: JqlPreset; jqlCustom: string | null; watchedUsers: WatchedUser[] },
  conn: {
    serverConnection: { baseUrl: string; username: string } | null;
    sourceProjectKey: string | null;
  },
): FetchSignatureInput {
  return {
    baseUrl: conn.serverConnection?.baseUrl ?? null,
    username: conn.serverConnection?.username ?? null,
    preset: ticket.jqlPreset,
    custom: ticket.jqlCustom,
    projectKey: conn.sourceProjectKey,
    watchedIdentifiers: ticket.watchedUsers.map((u) => u.identifier),
  };
}
