import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RememberedLinkHint } from '../RememberedLinkHint';
import type { TriageEntry } from '../types';

const ignored: TriageEntry = { state: 'ignored', copiedKey: 'CLD-9' };

describe('RememberedLinkHint', () => {
  it('renders the detail variant as a paragraph with a mono key', () => {
    const { container } = render(<RememberedLinkHint entry={ignored} variant="detail" />);
    const p = container.querySelector('p');
    expect(p).toBeTruthy();
    expect(p).toHaveTextContent(/^Previously linked to CLD-9$/);
    const mono = container.querySelector('.font-mono');
    expect(mono).toHaveTextContent('CLD-9');
  });

  it('renders the row variant as a muted nowrap span', () => {
    const { container } = render(<RememberedLinkHint entry={ignored} variant="row" />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.tagName).toBe('SPAN');
    expect(span).toHaveClass('text-xs', 'text-brand-text-secondary', 'whitespace-nowrap');
    expect(span).toHaveTextContent('Previously linked to CLD-9');
  });

  it('renders the hint for watched entries with a copiedKey in both variants', () => {
    const watched: TriageEntry = { state: 'watched', copiedKey: 'CLOUD-1' };
    const { container, unmount } = render(<RememberedLinkHint entry={watched} variant="detail" />);
    expect(container).toHaveTextContent('Previously linked to CLOUD-1');
    unmount();
    const row = render(<RememberedLinkHint entry={watched} variant="row" />);
    expect(row.container).toHaveTextContent('Previously linked to CLOUD-1');
  });

  it('renders nothing for watched without a copiedKey', () => {
    const { container } = render(
      <RememberedLinkHint entry={{ state: 'watched', copiedKey: null }} variant="detail" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each<[string, TriageEntry | undefined]>([
    ['undefined', undefined],
    ['ignored without key', { state: 'ignored', copiedKey: null }],
    ['seen with stale key', { state: 'seen', copiedKey: 'CLD-9' }],
    ['handled with stale key', { state: 'handled', copiedKey: 'CLD-9' }],
    ['copied', { state: 'copied', copiedKey: 'CLD-9' }],
  ])('renders nothing for %s', (_label, entry) => {
    const { container } = render(<RememberedLinkHint entry={entry} variant="detail" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is plain visible text: no tooltip role and not aria-hidden', () => {
    const { container } = render(<RememberedLinkHint entry={ignored} variant="detail" />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(container.closest('[aria-hidden="true"]')).toBeNull();
  });
});
