import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

const enMap = en as Record<string, string>;
const skMap = sk as Record<string, string>;

const NEW_KEYS = [
  'detail.deny',
  'detail.deny.tooltip',
  'detail.restoreLink',
  'detail.restoreLink.tooltip',
  'detail.previouslyLinked',
];

const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => (s.match(/<\/?k>/g) ?? []).sort();

describe('detail.* Phase 36 strings', () => {
  it('exist and are non-empty in EN and SK', () => {
    for (const k of NEW_KEYS) {
      expect(enMap[k]?.length, `en.json missing "${k}"`).toBeGreaterThan(0);
      expect(skMap[k]?.length, `sk.json missing "${k}"`).toBeGreaterThan(0);
    }
  });

  it('SK never uses "úloh"', () => {
    for (const k of NEW_KEYS) {
      expect(/úloh/i.test(skMap[k]), `sk.json key "${k}" uses úloh`).toBe(false);
    }
  });

  it('SK tooltips mentioning the ticket noun use "tiket"', () => {
    expect(skMap['detail.deny.tooltip']).toMatch(/tiket/i);
    expect(skMap['detail.restoreLink.tooltip']).toMatch(/tiket/i);
  });

  it('SK Dismiss and Deny labels differ', () => {
    expect(skMap['detail.deny']).not.toBe(skMap['detail.ignore']);
  });

  it('placeholders and <k> tags match between EN and SK', () => {
    for (const k of NEW_KEYS) {
      expect(placeholders(skMap[k]), `placeholders of "${k}"`).toEqual(placeholders(enMap[k]));
      expect(tags(skMap[k]), `tags of "${k}"`).toEqual(tags(enMap[k]));
    }
    expect(tags(enMap['detail.previouslyLinked'])).toEqual(['</k>', '<k>']);
  });
});

describe('relations strings', () => {
  const KEYS = [
    'detail.description',
    'detail.relations.parent',
    'detail.relations.subtasks',
    'tickets.card.parentLabel',
    'tickets.card.subtasksLabel',
  ];

  it('exist and are non-empty in EN and SK without "úloh"', () => {
    for (const k of KEYS) {
      expect(enMap[k], `en ${k}`).toBeTruthy();
      expect(skMap[k], `sk ${k}`).toBeTruthy();
      expect(skMap[k]).not.toMatch(/úloh/i);
    }
  });

  it('SK relation labels use "tiket"', () => {
    expect(skMap['detail.relations.parent']).toMatch(/tiket/i);
    expect(skMap['tickets.card.parentLabel']).toMatch(/tiket/i);
    expect(skMap['detail.relations.subtasks']).toMatch(/tiket/i);
    expect(skMap['tickets.card.subtasksLabel']).toMatch(/tiket/i);
  });

  it('count placeholder matches between EN and SK', () => {
    expect(placeholders(skMap['tickets.card.subtasksLabel'])).toEqual(
      placeholders(enMap['tickets.card.subtasksLabel']),
    );
  });
});
