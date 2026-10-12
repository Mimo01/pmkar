import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NavigationContext, useGroupNavigation } from '../NavigationContext';

function Consumer({ onResult }: { onResult?: (r: unknown) => void }) {
  const { navigateToGroup } = useGroupNavigation();
  return (
    <button
      type="button"
      onClick={() => {
        const r = navigateToGroup(5);
        onResult?.(r);
      }}
    >
      go
    </button>
  );
}

describe('NavigationContext', () => {
  it('default navigateToGroup is a no-op that does not throw and returns undefined', async () => {
    const result = vi.fn();
    render(<Consumer onResult={result} />);
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(result).toHaveBeenCalledWith(undefined);
  });

  it('provider value receives the group id', async () => {
    const spy = vi.fn();
    render(
      <NavigationContext.Provider value={{ navigateToGroup: spy }}>
        <Consumer />
      </NavigationContext.Provider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(spy).toHaveBeenCalledWith(5);
  });
});
