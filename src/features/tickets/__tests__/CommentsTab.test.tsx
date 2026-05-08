import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CommentsTab } from '../tabs/CommentsTab';
import type { JiraComment } from '../types';

const makeComment = (overrides: Partial<JiraComment> = {}): JiraComment => ({
  id: 'c1',
  author: { displayName: 'Alice', accountId: 'alice123' },
  body: 'This is a comment',
  created: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
  ...overrides,
});

describe('CommentsTab', () => {
  it('shows empty state when no comments', () => {
    render(<CommentsTab comments={[]} />);
    // Translation key detail.tab.comments renders
    expect(screen.getByText(/comment|detail\.tab\.comments/i)).toBeInTheDocument();
  });

  it('renders author display name', () => {
    render(<CommentsTab comments={[makeComment()]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders string comment body', () => {
    render(<CommentsTab comments={[makeComment({ body: 'Hello world' })]} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders ADF (object) comment body as JSON', () => {
    const adfBody = { type: 'doc', version: 1, content: [] };
    render(<CommentsTab comments={[makeComment({ body: adfBody })]} />);
    // Object body is JSON.stringified in a pre
    expect(screen.getByText(/"type"/)).toBeInTheDocument();
  });

  it('renders multiple comments', () => {
    const comments = [
      makeComment({ id: '1', author: { displayName: 'Alice' }, body: 'First comment' }),
      makeComment({ id: '2', author: { displayName: 'Bob' }, body: 'Second comment' }),
    ];
    render(<CommentsTab comments={comments} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('First comment')).toBeInTheDocument();
    expect(screen.getByText('Second comment')).toBeInTheDocument();
  });

  it('renders relative time for comment', () => {
    render(<CommentsTab comments={[makeComment()]} />);
    // Should render some form of relative time text (e.g. "2 minutes ago")
    expect(screen.getByText(/minute|second|hour|day/i)).toBeInTheDocument();
  });

  it('renders comments newest first by default', () => {
    const comments = [
      makeComment({ id: '1', body: 'Older comment', created: '2024-01-01T10:00:00.000Z' }),
      makeComment({ id: '2', body: 'Newer comment', created: '2024-06-01T10:00:00.000Z' }),
    ];
    render(<CommentsTab comments={comments} />);
    const items = screen.getAllByText(/comment/i);
    // "Newer comment" should appear before "Older comment" in the DOM
    expect(items[0].textContent).toMatch(/Newer comment/);
  });

  it('toggles to oldest first when sort button clicked', async () => {
    const user = userEvent.setup();
    const comments = [
      makeComment({ id: '1', body: 'Older comment', created: '2024-01-01T10:00:00.000Z' }),
      makeComment({ id: '2', body: 'Newer comment', created: '2024-06-01T10:00:00.000Z' }),
    ];
    render(<CommentsTab comments={comments} />);
    await user.click(screen.getByRole('button', { name: /toggle comment sort/i }));
    const items = screen.getAllByText(/comment/i);
    expect(items[0].textContent).toMatch(/Older comment/);
  });

  it('does not render sort toggle when there are no comments', () => {
    render(<CommentsTab comments={[]} />);
    expect(screen.queryByRole('button', { name: /toggle comment sort/i })).not.toBeInTheDocument();
  });
});
