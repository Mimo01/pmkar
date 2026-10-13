import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n/index';
import sk from '../../../i18n/locales/sk.json';
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
      'Added 3 issues to “QA” (2 already in group)',
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
      'Pridaná 1 úloha do skupiny „QA“',
    );
    expect(i18n.t('groups.toast.added', { count: 3, name })).toBe(
      'Pridané 3 úlohy do skupiny „QA“',
    );
    expect(i18n.t('groups.toast.added', { count: 5, name })).toBe(
      'Pridaných 5 úloh do skupiny „QA“',
    );
  });

  it('sk bar removeConfirm plurals', async () => {
    await i18n.changeLanguage('sk');
    expect(i18n.t('groups.bar.removeConfirm', { count: 1, name: 'QA' })).toBe(
      'Odstrániť 1 úlohu zo skupiny „QA“?',
    );
    expect(i18n.t('groups.bar.removeConfirm', { count: 5, name: 'QA' })).toBe(
      'Odstrániť 5 úloh zo skupiny „QA“?',
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

describe('Phase 32 missing copy', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  const NEW_KEYS = [
    'groups.missing.hint',
    'groups.missing.heading',
    'groups.missing.remove',
    'groups.missing.removeAria',
    'groups.missing.removeConfirm',
    'groups.missing.removeAll',
    'groups.missing.removeAllConfirm',
    'groups.missing.removeError',
    'groups.missing.removeAllError',
    'groups.menu.removeMissing',
  ];

  it('en hint and heading', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('groups.missing.hint')).toBe('No longer in results');
    expect(i18n.t('groups.missing.heading', { count: 1 })).toBe('No longer in results (1)');
    expect(i18n.t('groups.missing.heading', { count: 3 })).toBe('No longer in results (3)');
  });

  it('en removeAllConfirm plurals', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('groups.missing.removeAllConfirm', { count: 1, name: 'Sprint' })).toBe(
      'Remove 1 issue from “Sprint”? It is no longer in results.',
    );
    expect(i18n.t('groups.missing.removeAllConfirm', { count: 3, name: 'Sprint' })).toBe(
      'Remove 3 issues from “Sprint”? They are no longer in results.',
    );
  });

  it('sk plurals', async () => {
    await i18n.changeLanguage('sk');
    const c = (count: number) => i18n.t('groups.missing.removeAllConfirm', { count, name: 'S' });
    expect(c(1)).toContain('1 úlohu');
    expect(c(3)).toContain('3 úlohy');
    expect(c(5)).toContain('5 úloh');
    expect(i18n.t('groups.missing.heading', { count: 1 })).toBe('Už nie je vo výsledkoch (1)');
    expect(i18n.t('groups.missing.heading', { count: 3 })).toBe('Už nie sú vo výsledkoch (3)');
  });

  it('new keys exist in both locales', async () => {
    for (const lng of ['en', 'sk']) {
      await i18n.changeLanguage(lng);
      for (const key of NEW_KEYS) {
        const v = i18n.t(key, { count: 2, name: 'N', key: 'K' });
        expect(v, `${lng}:${key}`).not.toBe(key);
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('SK plural resolution for all groups.* plural bases (D-16/D-17)', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  const skMap = sk as Record<string, string>;
  const bases = Object.keys(skMap)
    .filter((k) => k.startsWith('groups.') && k.endsWith('_one'))
    .map((k) => k.replace(/_one$/, ''));

  it('resolves the Intl.PluralRules category key without leftover placeholders', async () => {
    await i18n.changeLanguage('sk');
    expect(bases.length).toBeGreaterThan(0);
    const rules = new Intl.PluralRules('sk');
    for (const b of bases) {
      for (const n of [1, 3, 5, 1.5]) {
        const o = {
          lng: 'sk',
          count: n,
          name: 'Sprint',
          key: 'PROJ-1',
          query: 'abc',
          names: 'A, B',
          skipped: 2,
        };
        const got = i18n.t(b, o);
        expect(got, `${b} n=${n}`).toBe(i18n.t(`${b}_${rules.select(n)}`, o));
        expect(got, `${b} n=${n}`).not.toContain('{{');
      }
    }
  });

  it('renders Slovak count agreement', async () => {
    await i18n.changeLanguage('sk');
    const tab = (count: number) => i18n.t('groups.tab.aria', { name: 'S', count });
    expect(tab(1)).toBe('S, 1 úloha');
    expect(tab(3)).toBe('S, 3 úlohy');
    expect(tab(5)).toBe('S, 5 úloh');
    expect(i18n.t('groups.bar.count', { count: 1 })).toBe('1 vybraná');
    expect(i18n.t('groups.bar.count', { count: 3 })).toBe('3 vybrané');
    expect(i18n.t('groups.bar.count', { count: 5 })).toBe('5 vybraných');
  });
});
