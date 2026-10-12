/**
 * TS mirror of the Rust group-name rules (groups_db.rs). UX only: Rust is
 * authoritative and re-validates every write (D-16). Verified against
 * src/test-fixtures/group-vectors.json.
 */
import en from '../../i18n/locales/en.json';
import sk from '../../i18n/locales/sk.json';

export const MAX_GROUP_NAME_CHARS = 40;

/**
 * Bidi embedding/override/isolate controls (U+061C, U+202A..U+202E,
 * U+2066..U+2069) are removed from the display name so they cannot visually
 * reorder a tab label (identical list in Rust). Trim set shared with Rust:
 * Unicode White_Space plus U+FEFF. JS `\s` already covers U+FEFF but not
 * U+0085, which is added explicitly.
 */
export function normalizeGroupName(raw: string): string {
  return raw
    .replace(/[\u061C\u202A-\u202E\u2066-\u2069]/gu, '')
    .replace(/^[\s\u0085\uFEFF]+|[\s\u0085\uFEFF]+$/gu, '')
    .normalize('NFC');
}

/**
 * Comparison key: NFD, strip combining marks and the ignored invisible
 * characters (identical list in Rust), NFC, lower-case. Ignored: U+00AD,
 * U+061C, U+115F, U+1160, U+180E, U+200B..U+200F, U+202A..U+202E,
 * U+2060..U+2064, U+2066..U+2069, U+2800, U+3164, U+FEFF, U+FFA0.
 */
export function groupNameKey(display: string): string {
  return display
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(
      /[\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u2800\u3164\uFEFF\uFFA0]/gu,
      '',
    )
    .normalize('NFC')
    .toLowerCase();
}

function buildReservedKeys(): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const locale of [en, sk] as Record<string, string>[]) {
    for (const label of [locale['nav.new'], locale['nav.notMine'], locale['nav.linked']]) {
      if (typeof label === 'string') keys.add(groupNameKey(normalizeGroupName(label)));
    }
  }
  return keys;
}

export const RESERVED_NAME_KEYS: ReadonlySet<string> = buildReservedKeys();

export type GroupNameValidation =
  | { ok: true; display: string; key: string }
  | { ok: false; code: 'empty' | 'too_long' | 'reserved' | 'duplicate' };

/**
 * Validate a group name. When renaming, pass existing names EXCLUDING the
 * group being renamed.
 */
export function validateGroupName(
  raw: string,
  existingNames: readonly string[],
): GroupNameValidation {
  const display = normalizeGroupName(raw);
  if (display.length === 0) return { ok: false, code: 'empty' };
  if ([...display].length > MAX_GROUP_NAME_CHARS) return { ok: false, code: 'too_long' };
  const key = groupNameKey(display);
  if (key.length === 0) return { ok: false, code: 'empty' };
  if (RESERVED_NAME_KEYS.has(key)) return { ok: false, code: 'reserved' };
  const taken = existingNames.some((n) => groupNameKey(normalizeGroupName(n)) === key);
  if (taken) return { ok: false, code: 'duplicate' };
  return { ok: true, display, key };
}
