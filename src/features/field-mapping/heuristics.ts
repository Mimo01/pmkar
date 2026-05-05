import type { FieldSchema } from '@/types/fieldSchema';

/**
 * Synonym set for heuristic name matching. Keys and values are normalized
 * (lowercase, no separators). Phase 22 may extend this.
 */
const SYNONYMS: Record<string, string[]> = {
  description: ['desc', 'body', 'details'],
  priority: ['severity', 'importance', 'urgency'],
  assignee: ['assignedto', 'owner'],
  reporter: ['createdby', 'author', 'submitter'],
  labels: ['tags', 'label'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_ ]/g, '');
}

/**
 * Find a heuristic name-match for an unmapped source field among target fields.
 * Precedence: 1) exact fieldId, 2) normalized name equality, 3) synonym set.
 * Returns null if nothing matches.
 *
 * Acceptance: REQUIREMENTS.md EDIT-02 — case-insensitive equality + synonym set.
 */
export function findNameMatchSuggestion(
  sourceFieldId: string,
  sourceName: string,
  targetFields: FieldSchema[],
): FieldSchema | null {
  // 1. Exact field_id match (highest precedence)
  const byId = targetFields.find((f) => f.fieldId === sourceFieldId);
  if (byId) return byId;

  // 2. Normalized case-insensitive name match
  const lower = normalize(sourceName);
  const byName = targetFields.find((f) => normalize(f.name) === lower);
  if (byName) return byName;

  // 3. Synonym lookup
  // When the source name belongs to a synonym group, that group is exclusive:
  // return the match or null immediately — do not fall through to the next group.
  for (const [canonical, syns] of Object.entries(SYNONYMS)) {
    const allForms = [canonical, ...syns];
    if (allForms.includes(lower)) {
      const match = targetFields.find((f) => allForms.includes(normalize(f.name)));
      return match ?? null; // found or explicitly not found — do not continue
    }
  }
  return null;
}
