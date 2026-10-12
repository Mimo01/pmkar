import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n/index';
import { GROUP_COLOR_TOKENS } from '../colors';

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

describe('Phase 30 copy', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('en delete body plurals', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('groups.delete.body', { count: 1 })).toBe(
      '1 issue is in this group. The issues themselves are not affected.',
    );
    expect(i18n.t('groups.delete.body', { count: 3 })).toBe(
      '3 issues are in this group. The issues themselves are not affected.',
    );
  });

  it('sk delete body plurals', async () => {
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.delete.body', { count: 1 })).toBe(
      'V tejto skupine je 1 úloha. Samotné úlohy sa nezmenia.',
    );
    expect(i18n.t('groups.delete.body', { count: 3 })).toBe(
      'V tejto skupine sú 3 úlohy. Samotné úlohy sa nezmenia.',
    );
    expect(i18n.t('groups.delete.body', { count: 5 })).toBe(
      'V tejto skupine je 5 úloh. Samotné úlohy sa nezmenia.',
    );
  });

  it('sk has no zero plural category (empty needs its own key)', () => {
    const rules = new Intl.PluralRules('sk');
    expect(rules.select(0)).toBe('other');
    expect(rules.select(1)).toBe('one');
    expect(rules.select(3)).toBe('few');
  });

  it('move announcement', async () => {
    const o = { name: 'Sprint 12', position: 2, total: 5 };
    await i18n.changeLanguage('en');
    expect(i18n.t('groups.move.announce', o)).toBe('“Sprint 12” moved to position 2 of 5.');
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.move.announce', o)).toBe('„Sprint 12“ presunutá na pozíciu 2 z 5.');
  });

  it('delete title', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('groups.delete.title', { name: 'Sprint 12' })).toBe('Delete “Sprint 12”?');
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.delete.title', { name: 'Sprint 12' })).toBe('Odstrániť „Sprint 12“?');
  });

  it('color names exist in both locales', async () => {
    for (const lng of ['en', 'sk']) {
      await i18n.changeLanguage(lng);
      for (const token of GROUP_COLOR_TOKENS) {
        expect(i18n.exists(`groups.color.${token}`)).toBe(true);
      }
    }
  });
});

describe('Phase 31 copy', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('en bar count and toasts', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('groups.bar.count', { count: 1 })).toBe('1 selected');
    expect(i18n.t('groups.bar.count', { count: 3 })).toBe('3 selected');
    expect(i18n.t('groups.toast.addedWithSkipped', { count: 3, skipped: 2, name: 'QA' })).toBe(
      'Added 3 issues to ‘QA’ (2 already in group)',
    );
  });

  it('sk bar count plurals', async () => {
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.bar.count', { count: 1 })).toBe('1 vybraná');
    expect(i18n.t('groups.bar.count', { count: 3 })).toBe('3 vybrané');
    expect(i18n.t('groups.bar.count', { count: 5 })).toBe('5 vybraných');
  });

  it('sk toast added plurals', async () => {
    await i18n.changeLanguage('sk');
    const name = 'QA';
    expect(i18n.t('groups.toast.added', { count: 1, name })).toBe(
      'Pridaná 1 úloha do skupiny ‘QA’',
    );
    expect(i18n.t('groups.toast.added', { count: 3, name })).toBe(
      'Pridané 3 úlohy do skupiny ‘QA’',
    );
    expect(i18n.t('groups.toast.added', { count: 5, name })).toBe(
      'Pridaných 5 úloh do skupiny ‘QA’',
    );
  });

  it('sk bar removeConfirm plurals', async () => {
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.bar.removeConfirm', { count: 1, name: 'QA' })).toBe(
      'Odstrániť 1 úlohu zo skupiny ‘QA’?',
    );
    expect(i18n.t('groups.bar.removeConfirm', { count: 5, name: 'QA' })).toBe(
      'Odstrániť 5 úloh zo skupiny ‘QA’?',
    );
  });

  it('sk chip moreAria', async () => {
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.chip.moreAria', { count: 2, names: 'A, B' })).toBe(
      '2 ďalšie skupiny: A, B',
    );
  });

  it('D-18: empty body names the shipped labels', async () => {
    await i18n.changeLanguage('en');
    const en = i18n.t('groups.empty.body');
    expect(en).toContain(i18n.t('groups.picker.button'));
    expect(en).toContain(i18n.t('groups.bar.add'));
    expect(en).toContain('Groups');
    expect(en).toContain('Add to group');
    await i18n.changeLanguage('sk');
    const sk = i18n.t('groups.empty.body');
    expect(sk).toContain('Skupiny');
    expect(sk).toContain('Pridať do skupiny');
  });
});
