/**
 * TS mirror of the Rust group-name rules (groups_db.rs). UX only: Rust is
 * authoritative and re-validates every write (D-16). Verified against
 * src/test-fixtures/group-vectors.json.
 */
import en from '../../i18n/locales/en.json';
import sk from '../../i18n/locales/sk.json';

export const MAX_GROUP_NAME_CHARS = 40;

export function normalizeGroupName(raw: string): string {
  return raw.trim().normalize('NFC');
}

export function groupNameKey(display: string): string {
  return display.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC').toLowerCase();
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
  if (RESERVED_NAME_KEYS.has(key)) return { ok: false, code: 'reserved' };
  const taken = existingNames.some((n) => groupNameKey(normalizeGroupName(n)) === key);
  if (taken) return { ok: false, code: 'duplicate' };
  return { ok: true, display, key };
}
