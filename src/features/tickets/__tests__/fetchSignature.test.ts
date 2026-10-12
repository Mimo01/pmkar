import { describe, expect, it } from 'vitest';
import { computeFetchSignature, type FetchSignatureInput } from '../fetchSignature';

const base: FetchSignatureInput = {
  baseUrl: 'https://jira.example.com',
  username: 'alice',
  preset: 'all_watched',
  custom: 'project = X',
  projectKey: 'PROJ',
  watchedIdentifiers: ['bob', 'carol'],
};

describe('computeFetchSignature', () => {
  it('is deterministic', () => {
    expect(computeFetchSignature(base)).toBe(computeFetchSignature({ ...base }));
  });

  it.each([
    ['preset', { preset: 'mine' as const }],
    ['projectKey', { projectKey: 'OTHER' }],
    ['baseUrl', { baseUrl: 'https://other.example.com' }],
    ['username', { username: 'dave' }],
    ['watched identifier', { watchedIdentifiers: ['bob', 'erin'] }],
  ])('differs when %s changes', (_n, patch) => {
    expect(computeFetchSignature({ ...base, ...patch })).not.toBe(computeFetchSignature(base));
  });

  it('differs when custom changes under custom preset', () => {
    const a = { ...base, preset: 'custom' as const, custom: 'a' };
    expect(computeFetchSignature(a)).not.toBe(computeFetchSignature({ ...a, custom: 'b' }));
  });

  it('ignores custom when preset is not custom', () => {
    expect(computeFetchSignature(base)).toBe(computeFetchSignature({ ...base, custom: 'zzz' }));
  });

  it('ignores watched identifiers when preset is not all_watched', () => {
    const m = { ...base, preset: 'mine' as const };
    expect(computeFetchSignature(m)).toBe(
      computeFetchSignature({ ...m, watchedIdentifiers: ['x'] }),
    );
  });

  it('ignores watched identifier order', () => {
    expect(computeFetchSignature(base)).toBe(
      computeFetchSignature({ ...base, watchedIdentifiers: ['carol', 'bob'] }),
    );
  });
});
