// Conservative Jira wiki-markup stripping. Constant, bounded regexes only (T-37.3-04);
// output is plain text, never HTML (T-37.3-06).
const MACRO_TAGS = /\{(?:code|noformat|quote|panel|color)(?::[^}]*)?\}/g;
const IMAGE_EMBED = /![^\s!]*\.[^\s!]*!/g;
const LINK_WITH_TEXT = /\[([^\]|]+)\|([^\]]+)\]/g;
const LINK_BARE = /\[([^\]]+)\]/g;
const HEADING = /^[ \t]*(?:h[1-6]|bq)\.[ \t]*/gm;
const TABLE_PIPES = /\|+/g;
const WRAPPED = /(^|\s)([*_+\-^~])(?=\S)([^\n]{0,200}?\S)\2(?=\s|$|[.,;:!?)])/g;
const SPACES = /\s+/g;

export function stripWikiMarkup(s: string): string {
  let t = s.replace(MACRO_TAGS, '');
  t = t.replace(IMAGE_EMBED, '');
  t = t.replace(LINK_WITH_TEXT, '$1 $2');
  t = t.replace(LINK_BARE, '$1');
  t = t.replace(HEADING, '');
  t = t.replace(TABLE_PIPES, ' ');
  // Run twice so adjacent wrapped words (sharing a whitespace boundary) both unwrap.
  t = t.replace(WRAPPED, '$1$3').replace(WRAPPED, '$1$3');
  return t.replace(SPACES, ' ').trim();
}
