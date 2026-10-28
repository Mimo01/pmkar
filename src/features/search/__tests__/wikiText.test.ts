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

describe('stripWikiMarkup pathological input (37.3-08 WR-03)', () => {
  const inputs: Record<string, string> = {
    star: ' *a'.repeat(6_666),
    bracket: ' [a'.repeat(6_666),
    code: '{code:'.repeat(3_333),
  };
  for (const [name, input] of Object.entries(inputs)) {
    it(`finishes quickly and shrinks: ${name}`, () => {
      const t0 = performance.now();
      const out = stripWikiMarkup(input);
      expect(performance.now() - t0).toBeLessThan(1000);
      expect(out.length).toBeLessThanOrEqual(input.length);
      expect(out).not.toContain('\n');
    });
  }

  it('still unwraps short spans', () => {
    expect(stripWikiMarkup('*bold* and _it_ text')).toBe('bold and it text');
  });

  it('leaves wrapped spans longer than 200 chars with markers', () => {
    const long = `*${'x'.repeat(300)}*`;
    expect(stripWikiMarkup(long)).toBe(long);
  });
});
