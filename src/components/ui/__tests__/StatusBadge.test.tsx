import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders label text', () => {
    render(<StatusBadge label="Mock Server" status="healthy" />);
    expect(screen.getByText('Mock Server')).toBeInTheDocument();
  });

  it('renders "Running" text for healthy status', () => {
    render(<StatusBadge label="Mock Server" status="healthy" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('renders "Unreachable" text for error status', () => {
    render(<StatusBadge label="Database" status="error" />);
    expect(screen.getByText('Unreachable')).toBeInTheDocument();
  });

  it('renders custom detail when provided', () => {
    render(<StatusBadge label="API" status="healthy" detail="v2.0.1" />);
    expect(screen.getByText('v2.0.1')).toBeInTheDocument();
  });

  it('overrides status text when detail is provided', () => {
    render(<StatusBadge label="API" status="healthy" detail="Custom detail" />);
    expect(screen.queryByText('Running')).toBeNull();
    expect(screen.getByText('Custom detail')).toBeInTheDocument();
  });

  it('has status role for accessibility', () => {
    render(<StatusBadge label="Test" status="loading" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
