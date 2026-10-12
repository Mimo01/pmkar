import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n/index';

describe('groups.tab.aria plurals', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('en', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 1 })).toBe('Sprint, 1 issue');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 3 })).toBe('Sprint, 3 issues');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 0 })).toBe('Sprint, 0 issues');
  });

  it('sk', async () => {
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 1 })).toBe('Sprint, 1 úloha');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 3 })).toBe('Sprint, 3 úlohy');
    expect(i18n.t('groups.tab.aria', { name: 'Sprint', count: 5 })).toBe('Sprint, 5 úloh');
  });
});
