import { describe, expect, it } from 'vitest';
import { stripWikiMarkup } from '../wikiText';

describe('stripWikiMarkup', () => {
  it('strips headings and bold', () => {
    const r = stripWikiMarkup('h1. Title\n*bold* text');
    expect(r).toContain('Title');
    expect(r).toContain('bold text');
    expect(r).not.toContain('h1.');
    expect(r).not.toContain('*');
  });
  it('strips code macros keeping inner text', () => {
    const r = stripWikiMarkup('{code:java}int x = 1;{code}');
    expect(r).toContain('int x = 1;');
    expect(r).not.toContain('{code');
  });
  it('handles links and images', () => {
    const r = stripWikiMarkup('see [docs|http://x.y] and !img.png!');
    expect(r).toContain('docs');
    expect(r).toContain('http://x.y');
    expect(r).not.toContain('!img.png!');
  });
  it('strips tables', () => {
    const r = stripWikiMarkup('||A||B||\n|1|2|');
    for (const c of ['A', 'B', '1', '2']) expect(r).toContain(c);
    expect(r).not.toContain('|');
  });
  it('does not over-strip underscores', () => {
    const r = stripWikiMarkup('foo_bar snake_case_name');
    expect(r).toContain('foo_bar');
    expect(r).toContain('snake_case_name');
  });
  it('strips color macros', () => {
    expect(stripWikiMarkup('{color:red}Chyba{color}')).toBe('Chyba');
  });
});
