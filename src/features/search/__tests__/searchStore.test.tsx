import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSearchStore } from '../searchStore';

function Probe() {
  const query = useSearchStore((s) => s.query);
  return <div data-testid="q">{query}</div>;
}

describe('searchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({ query: '' });
  });

  it('starts empty', () => {
    expect(useSearchStore.getState().query).toBe('');
  });

  it('setQuery and clearQuery', () => {
    useSearchStore.getState().setQuery('abc');
    expect(useSearchStore.getState().query).toBe('abc');
    useSearchStore.getState().clearQuery();
    expect(useSearchStore.getState().query).toBe('');
  });

  it('survives unmount and remount of a reader', () => {
    const first = render(<Probe />);
    useSearchStore.getState().setQuery('abc');
    first.unmount();
    render(<Probe />);
    expect(screen.getByTestId('q').textContent).toBe('abc');
  });
});
