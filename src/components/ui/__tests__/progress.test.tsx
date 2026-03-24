import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Progress } from '../progress';

describe('Progress', () => {
  it('renders without errors', () => {
    const { container } = render(<Progress value={50} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<Progress value={50} className="custom-progress" />);
    expect(container.querySelector('.custom-progress')).toBeTruthy();
  });

  it('renders with 0% value', () => {
    const { container } = render(<Progress value={0} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with 100% value', () => {
    const { container } = render(<Progress value={100} />);
    expect(container.firstChild).toBeTruthy();
  });
});
