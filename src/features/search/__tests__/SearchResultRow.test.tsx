import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useGroupStore } from '../../groups/groupStore';
import type { Group } from '../../groups/types';
import type { JiraTicket } from '../../tickets/types';
import { SearchResultRow } from '../SearchResultRow';
import type { SearchHit } from '../types';

function g(id: number, name: string): Group {
  return {
    id,
    name,
    color: 'blue',
    position: id,
    createdAt: '2026-01-01T00:00:00Z',
    memberCount: 1,
  };
}

function hit(over: Partial<SearchHit> = {}, assignee = true): SearchHit {
  const ticket = {
    id: '1',
    key: 'P-1',
    fields: {
      summary: 'Login broken',
      status: { name: 'Open', statusCategory: { key: 'new' } },
      priority: { id: '2', name: 'High' },
      assignee: assignee ? { displayName: 'Jane Doe' } : null,
      updated: '2026-01-01T00:00:00Z',
    },
  } as unknown as JiraTicket;
  return { item: { ticket, category: 'linked', copiedKey: null }, rank: 1, snippet: null, ...over };
}

function renderRow(h: SearchHit, active = false, cbs = { onSelect: vi.fn(), onHover: vi.fn() }) {
  return renderWithI18n(
    <ul>
      <SearchResultRow hit={h} words={['login']} id="opt-1" active={active} {...cbs} />
    </ul>,
  );
}

describe('SearchResultRow', () => {
  beforeEach(() => {
    useGroupStore.setState({
      groups: [g(1, 'Alpha'), g(2, 'Beta')],
      groupIdsByIssue: {},
      hydrated: true,
    });
  });

  it('renders option with key, marked summary, badge, priority', () => {
    const { container } = renderRow(hit(), true);
    const opt = screen.getByRole('option');
    expect(opt.id).toBe('opt-1');
    expect(opt.getAttribute('aria-selected')).toBe('true');
    expect(opt.className).toContain('bg-brand-surface-hover');
    expect(container.querySelector('mark')?.textContent).toBe('Login');
    expect(screen.getByText('P-1')).toBeTruthy();
    expect(screen.getByText('Linked')).toBeTruthy();
    expect(screen.getAllByText('Priority: High').length).toBeGreaterThan(0);
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  it('shows no badge for Done and no assignee name when unassigned', () => {
    const h = hit({}, false);
    h.item.category = null;
    renderRow(h);
    for (const b of ['New', 'Dismissed', 'Linked', 'Watched']) {
      expect(screen.queryByText(b)).toBeNull();
    }
    expect(screen.queryByText('Jane Doe')).toBeNull();
  });

  it('renders non-interactive group chips', () => {
    useGroupStore.setState({ groupIdsByIssue: { 'P-1': [1, 2] } });
    const { container } = renderRow(hit());
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('renders snippet only when present, with prefix except for description', () => {
    const first = renderRow(hit());
    expect(screen.queryByText(/Labels:/)).toBeNull();
    first.unmount();
    const second = renderRow(hit({ snippet: { field: 'labels', text: 'ui, backend' } }));
    expect(screen.getByText(/Labels:/)).toBeTruthy();
    second.unmount();
    renderRow(hit({ snippet: { field: 'description', text: 'some text' } }));
    expect(screen.getByText('some text').parentElement?.textContent).toBe('some text');
  });

  it('mousedown selects and prevents default; hover calls onHover', () => {
    const cbs = { onSelect: vi.fn(), onHover: vi.fn() };
    renderRow(hit(), false, cbs);
    const opt = screen.getByRole('option');
    const notPrevented = fireEvent.mouseDown(opt);
    expect(notPrevented).toBe(false);
    expect(cbs.onSelect).toHaveBeenCalled();
    fireEvent.mouseEnter(opt);
    expect(cbs.onHover).toHaveBeenCalled();
  });
});
