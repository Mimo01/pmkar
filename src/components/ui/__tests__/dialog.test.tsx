import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from '../dialog';

describe('DialogContent', () => {
  it('renders the Close button by default', () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>T</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('omits the Close button with hideClose', () => {
    render(
      <Dialog open>
        <DialogContent hideClose aria-describedby={undefined}>
          <DialogTitle>T</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('forwards role=alertdialog', () => {
    render(
      <Dialog open>
        <DialogContent role="alertdialog" hideClose aria-describedby={undefined}>
          <DialogTitle>T</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });
});
