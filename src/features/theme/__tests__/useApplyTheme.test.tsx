import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useThemeStore } from '../themeStore';
import { useApplyTheme } from '../useApplyTheme';

function TestComponent() {
  useApplyTheme();
  return <div>test</div>;
}

describe('useApplyTheme', () => {
  it('removes dark class when resolved is light', () => {
    document.body.classList.add('dark'); // start with dark
    useThemeStore.setState({ mode: 'light', resolved: 'light' });
    render(<TestComponent />);
    expect(document.body.classList.contains('dark')).toBe(false);
  });

  it('adds dark class when resolved is dark', () => {
    document.body.classList.remove('dark'); // start without dark
    useThemeStore.setState({ mode: 'dark', resolved: 'dark' });
    render(<TestComponent />);
    expect(document.body.classList.contains('dark')).toBe(true);
  });
});
