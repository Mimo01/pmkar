import { render, screen } from '@testing-library/react';
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
});
