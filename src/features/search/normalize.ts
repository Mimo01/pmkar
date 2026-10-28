// Diacritic-insensitive folding with index maps. The only regexes are module
// constants; nothing is ever built from user input (T-37.3-04).
const MARKS = /\p{M}/gu;
const WHITESPACE = /\s+/;

export function foldText(s: string): string {
  return s.normalize('NFD').replace(MARKS, '').toLowerCase();
}

/**
 * Fold `s` and record, for every folded UTF-16 unit, the original UTF-16 index
 * of the code point it came from. A final sentinel entry equals s.length.
 */
export function foldWithMap(s: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  let i = 0;
  for (const ch of s) {
    const f = foldText(ch);
    for (let k = 0; k < f.length; k++) map.push(i);
    folded += f;
    i += ch.length;
  }
  map.push(s.length);
  return { folded, map };
}

export function parseQuery(raw: string): string[] {
  return foldText(raw).split(WHITESPACE).filter(Boolean);
}

export function mergeRanges(r: [number, number][]): [number, number][] {
  const sorted = r
    .map((x): [number, number] => [x[0], x[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) {
      if (end > last[1]) last[1] = end;
    } else {
      out.push([start, end]);
    }
  }
  return out;
}

/** Ranges in `original` (UTF-16 indexes) covering every occurrence of any word. */
export function highlightRanges(original: string, words: readonly string[]): [number, number][] {
  const { folded, map } = foldWithMap(original);
  const ranges: [number, number][] = [];
  for (const word of words) {
    if (!word) continue;
    let from = 0;
    for (;;) {
      const idx = folded.indexOf(word, from);
      if (idx === -1) break;
      const endIdx = idx + word.length;
      ranges.push([map[idx], map[endIdx] ?? original.length]);
      from = idx + 1;
    }
  }
  return mergeRanges(ranges);
}
