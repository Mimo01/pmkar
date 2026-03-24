import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { DescriptionRenderer } from '../DescriptionRenderer';

describe('DescriptionRenderer', () => {
  it('renders "No description" when description is null and no renderedHtml', () => {
    render(<DescriptionRenderer description={null} baseUrl="http://server" />);
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('renders plain text description as pre element', () => {
    render(<DescriptionRenderer description="Plain text description" baseUrl="http://server" />);
    expect(screen.getByText('Plain text description')).toBeInTheDocument();
  });

  it('renders ADF object as JSON string', () => {
    const adf = { type: 'doc', version: 1, content: [] };
    render(<DescriptionRenderer description={adf} baseUrl="http://server" />);
    expect(screen.getByText(/"type"/)).toBeInTheDocument();
  });

  it('renders HTML from renderedHtml when provided', () => {
    render(
      <DescriptionRenderer
        description={null}
        renderedHtml="<p>HTML description</p>"
        baseUrl="http://server"
      />,
    );
    expect(screen.getByText('HTML description')).toBeInTheDocument();
  });

  it('prefers renderedHtml over plain text description when both provided', () => {
    render(
      <DescriptionRenderer
        description="Plain text"
        renderedHtml="<p>HTML version</p>"
        baseUrl="http://server"
      />,
    );
    expect(screen.getByText('HTML version')).toBeInTheDocument();
    expect(screen.queryByText('Plain text')).toBeNull();
  });

  it('shows "No description" for empty string description', () => {
    render(<DescriptionRenderer description="" baseUrl="http://server" />);
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('shows "No description" for whitespace-only description', () => {
    render(<DescriptionRenderer description="   " baseUrl="http://server" />);
    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('falls back to plain text when renderedHtml is empty', () => {
    render(
      <DescriptionRenderer
        description="Fallback text"
        renderedHtml=""
        baseUrl="http://server"
      />,
    );
    expect(screen.getByText('Fallback text')).toBeInTheDocument();
  });
});
