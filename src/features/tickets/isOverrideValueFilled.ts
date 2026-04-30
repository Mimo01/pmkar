import type { FieldSchemaType } from '@/types/fieldSchema';

/**
 * Returns true when `value` is considered a "filled-in" override for a field
 * of the given schema. Used by the copy preview to decide whether a
 * required-but-unmapped (gap) field has been satisfied by user input and
 * therefore should no longer block the Copy button.
 *
 * Rules:
 *   - undefined / null   → not filled
 *   - empty string (after trim) → not filled
 *   - empty array        → not filled
 *   - empty object       → not filled (covers user objects with no accountId/name/key)
 *   - everything else    → filled
 *
 * The schema is currently used only as a hint for array-typed fields (we
 * already handle them via the array branch), but the parameter is kept so
 * future schema-specific tightening (e.g. validating user-picker shapes) can
 * be added without touching callers.
 */
export function isOverrideValueFilled(value: unknown, _schema?: FieldSchemaType): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    // Treat empty plain objects as unfilled (e.g. cleared user picker that left {}).
    // Any populated object — user picker result, option object, etc. — counts as filled.
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  // numbers, booleans, etc. — any explicit primitive value is filled.
  return true;
}
