import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SecretInput } from './SecretInput';

const noop = () => {};

describe('SecretInput', () => {
  it('renders as password input by default', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl="https://example.com"
      />,
    );
    const input = screen.getByLabelText('Personal Access Token');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('eye icon toggles to text and back', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value="my-secret"
        onChange={noop}
        helpUrl="https://example.com"
      />,
    );
    const input = screen.getByLabelText('Personal Access Token');
    const toggleBtn = screen.getByRole('button', { name: 'Show token' });

    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide token' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('aria-label changes on toggle', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl="https://example.com"
      />,
    );
    const toggleBtn = screen.getByRole('button', { name: 'Show token' });
    expect(toggleBtn).toHaveAttribute('aria-label', 'Show token');

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: 'Hide token' })).toHaveAttribute(
      'aria-label',
      'Hide token',
    );
  });

  it('renders help button with correct label', () => {
    const helpUrl = 'https://confluence.atlassian.com/help';
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl={helpUrl}
      />,
    );
    const helpBtn = screen.getByRole('button', { name: 'Where do I find this?' });
    expect(helpBtn).toBeInTheDocument();
  });

  it('disabled state applies to input', () => {
    render(
      <SecretInput
        id="test-secret"
        label="Personal Access Token"
        value=""
        onChange={noop}
        helpUrl="https://example.com"
        disabled={true}
      />,
    );
    const input = screen.getByLabelText('Personal Access Token');
    expect(input).toBeDisabled();
  });
});
