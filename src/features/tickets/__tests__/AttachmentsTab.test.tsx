import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttachmentsTab } from '../tabs/AttachmentsTab';
import type { JiraAttachment } from '../types';

const makeAttachment = (overrides: Partial<JiraAttachment> = {}): JiraAttachment => ({
  id: 'att1',
  filename: 'screenshot.png',
  size: 2048,
  mimeType: 'image/png',
  content: 'https://server/attachments/att1',
  ...overrides,
});

describe('AttachmentsTab', () => {
  it('shows empty state when no attachments', () => {
    render(<AttachmentsTab attachments={[]} />);
    // Translation key detail.tab.attachments renders
    expect(screen.getByText(/attachment|detail\.tab\.attachments/i)).toBeInTheDocument();
  });

  it('renders filename for each attachment', () => {
    render(<AttachmentsTab attachments={[makeAttachment({ filename: 'report.pdf' })]} />);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('renders mime type', () => {
    render(<AttachmentsTab attachments={[makeAttachment({ mimeType: 'application/pdf' })]} />);
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
  });

  it('formats size in bytes for small files', () => {
    render(<AttachmentsTab attachments={[makeAttachment({ size: 512 })]} />);
    expect(screen.getByText('512 B')).toBeInTheDocument();
  });

  it('formats size in KB for medium files', () => {
    render(<AttachmentsTab attachments={[makeAttachment({ size: 2048 })]} />);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('formats size in MB for large files', () => {
    render(<AttachmentsTab attachments={[makeAttachment({ size: 2 * 1024 * 1024 })]} />);
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('renders multiple attachments', () => {
    const attachments = [
      makeAttachment({ id: '1', filename: 'file1.png' }),
      makeAttachment({ id: '2', filename: 'file2.pdf' }),
    ];
    render(<AttachmentsTab attachments={attachments} />);
    expect(screen.getByText('file1.png')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
  });
});
