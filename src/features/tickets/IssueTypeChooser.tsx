import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import { useSchemaCacheStore } from '@/stores/schemaCacheStore';
import type { IssueTypeRef } from '@/types/fieldSchema';

export interface IssueTypeChooserProps {
  projectKey: string;
  sourceIssueTypeName: string;
  value: string | null;
  onChange: (issueTypeId: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Phase 22 — Issue-type chooser at the top of the right column of CopyPreviewPage.
 *
 * - D-03: VirtualizedCombobox with [&_button]:min-h-9 compactness wrapper.
 * - D-04: Reads from schemaCacheStore.prewarmedIssueTypes[projectKey]; parent owns
 *   on-demand pre-warm fallback (copyStore.startPreview from Plan 22-01).
 * - D-05: Default selection logic lives in copyStore (Plan 22-01); this component
 *   only renders the current value.
 * - D-06: "Defaulted" caption appears only when the current selection's name does
 *   not match sourceIssueTypeName case-insensitively AND no name-match exists in
 *   the list (i.e., we truly fell back to first). Disappears once user picks a
 *   matching item or when source name has a match in the list (user can pick it).
 *
 * The component is fully controlled — `onChange` propagates the new id; the parent
 * (copyStore.setTargetIssueTypeId via CopyPreviewPage in Plan 22-04) is responsible
 * for triggering schema reload and recalculating gaps. The `loading` prop tells us
 * to show an inline spinner during that reload.
 */
export function IssueTypeChooser({
  projectKey,
  sourceIssueTypeName,
  value,
  onChange,
  loading = false,
  disabled = false,
}: IssueTypeChooserProps) {
  const { t } = useTranslation();

  const issueTypes = useSchemaCacheStore(
    (s) => s.prewarmedIssueTypes[projectKey] ?? [],
  );

  const selected: IssueTypeRef | null = useMemo(() => {
    if (!value) return null;
    return issueTypes.find((it) => it.id === value) ?? null;
  }, [issueTypes, value]);

  const isDefaulted = useMemo(() => {
    if (!selected || !sourceIssueTypeName) return false;
    const src = sourceIssueTypeName.toLowerCase();
    // Selected matches source → not defaulted.
    if (selected.name.toLowerCase() === src) return false;
    // List contains a source-name match but user picked something else → manual pick, not defaulted.
    const listHasMatch = issueTypes.some((it) => it.name.toLowerCase() === src);
    if (listHasMatch) return false;
    // Selected does not match source AND no match exists → fell back to first → defaulted.
    return true;
  }, [selected, sourceIssueTypeName, issueTypes]);

  const noIssueTypes = issueTypes.length === 0;

  return (
    <div className="mb-3">
      <label
        htmlFor="copy-target-issuetype"
        className="text-xs text-brand-muted block mb-1"
      >
        {t('copy.preview.issueType')}
      </label>
      <div
        className="[&_button]:min-h-9 relative"
        data-testid="issue-type-chooser-wrapper"
      >
        <VirtualizedCombobox<IssueTypeRef>
          items={issueTypes}
          value={selected}
          onChange={(it) => onChange(it.id)}
          displayLabel={(it) => it.name}
          filterFn={(it, q) =>
            it.name.toLowerCase().includes(q.toLowerCase())
          }
          placeholder={
            noIssueTypes
              ? t('copy.preview.issueTypeEmpty')
              : t('copy.preview.issueTypePlaceholder')
          }
          searchPlaceholder={t('copy.preview.issueTypePlaceholder')}
          ariaLabel={t('copy.preview.issueTypeAriaLabel')}
          disabled={disabled || noIssueTypes}
        />
        {loading && (
          <span
            className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2"
            aria-hidden="true"
            data-testid="issue-type-loader"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-muted" />
          </span>
        )}
      </div>
      {isDefaulted && !loading && (
        <p
          className="text-xs text-brand-muted mt-1"
          data-testid="issue-type-defaulted-notice"
        >
          {t('copy.preview.issueTypeDefaulted', {
            sourceTypeName: sourceIssueTypeName,
          })}
        </p>
      )}
    </div>
  );
}
