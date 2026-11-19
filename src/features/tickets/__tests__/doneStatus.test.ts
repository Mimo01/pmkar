import { describe, expect, it } from 'vitest';
import type { JiraStatus, JiraTicket } from '../types';
import { isDoneStatus, isDoneTicket } from '../utils';

describe('isDoneStatus', () => {
  it('is false for missing status', () => {
    expect(isDoneStatus(undefined)).toBe(false);
    expect(isDoneStatus(null)).toBe(false);
  });
  it('lets the status category win over the name', () => {
    expect(isDoneStatus({ name: 'Whatever', statusCategory: { key: 'done' } } as JiraStatus)).toBe(
      true,
    );
    expect(
      isDoneStatus({ name: 'Closed', statusCategory: { key: 'indeterminate' } } as JiraStatus),
    ).toBe(false);
  });
  it('falls back to the name without a category', () => {
    for (const name of ['Closed', 'Resolved', 'Done', 'closed']) {
      expect(isDoneStatus({ name })).toBe(true);
    }
    expect(isDoneStatus({ name: 'In Progress' })).toBe(false);
  });
  it('isDoneTicket delegates and tolerates malformed tickets', () => {
    expect(isDoneTicket({ fields: { status: { name: 'Done' } } } as unknown as JiraTicket)).toBe(
      true,
    );
    expect(isDoneTicket({ fields: {} } as unknown as JiraTicket)).toBe(false);
  });
});
