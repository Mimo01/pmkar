import { type RenderOptions, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index';

export function renderWithI18n(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, {
    wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
    ...options,
  });
}
