import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders scaffold text', () => {
    render(<App />);
    expect(screen.getByText('pmkar scaffold')).toBeInTheDocument();
  });
});
