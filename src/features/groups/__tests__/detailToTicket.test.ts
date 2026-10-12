import { beforeEach, describe, expect, it } from 'vitest';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicketDetail } from '../../tickets/types';
import { detailToTicket, resolveTicketForIssue } from '../detailToTicket';
import { isRenderableTicket } from '../useGroupMembers';

function mkDetail(withCreated = true): JiraTicketDetail {
  return {
    id: '10',
    key: 'P-1',
    fields: {
      summary: 'Sum',
      status: { name: 'Open' },
      priority: { name: 'High', id: '2' },
      assignee: null,
      reporter: null,
      description: 'long text',
      labels: ['a'],
      components: [],
      fixVersions: [],
      comment: { comments: [] },
      attachment: [],
      subtasks: [],
      issuelinks: [],
      ...(withCreated ? { created: '2024-01-01T00:00:00.000Z' } : {}),
      updated: '2024-06-01T00:00:00.000Z',
    },
    changelog: { histories: [] },
  };
}

describe('detailToTicket', () => {
  beforeEach(() => {
    useTicketStore.setState({ tickets: [] });
  });

  it('produces a minimal renderable snapshot', () => {
    const t = detailToTicket(mkDetail());
    expect(isRenderableTicket(t)).toBe(true);
    expect(Object.keys(t).sort()).toEqual(['fields', 'id', 'key']);
    const allowed = ['summary', 'status', 'priority', 'assignee', 'created', 'updated'];
    for (const k of Object.keys(t.fields)) expect(allowed).toContain(k);
    expect('comment' in t.fields).toBe(false);
    expect('labels' in t.fields).toBe(false);
  });

  it('omits created when absent and stays renderable', () => {
    const t = detailToTicket(mkDetail(false));
    expect('created' in t.fields).toBe(false);
    expect(isRenderableTicket(t)).toBe(true);
  });

  it('resolve prefers the store ticket (same reference)', () => {
    const stored = detailToTicket(mkDetail());
    useTicketStore.setState({ tickets: [stored] });
    expect(resolveTicketForIssue('P-1', mkDetail())).toBe(stored);
  });

  it('resolve falls back to the detail snapshot', () => {
    expect(resolveTicketForIssue('P-1', mkDetail())).toEqual(detailToTicket(mkDetail()));
  });

  it('resolve returns null with no store entry and no detail', () => {
    expect(resolveTicketForIssue('P-1', null)).toBeNull();
  });
});
