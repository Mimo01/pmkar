import { useTranslation } from 'react-i18next';
import type { JiraUser } from '@/features/tickets/types';
import { UserAvatar } from '@/features/tickets/UserAvatar';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { RendererProps } from '../types';

function isJiraUser(v: unknown): v is JiraUser {
  return Boolean(v && typeof v === 'object' && typeof (v as JiraUser).displayName === 'string');
}

export function UserPickerRenderer({
  field,
  value,
  onChange,
  required,
  disabled,
  onSearch,
  initialQuery,
}: RendererProps) {
  const { t } = useTranslation();
  const selected: JiraUser | null = isJiraUser(value) ? value : null;

  // D-01: onSearch is required for user pickers; tests pass mock; Phase 22 injects real Tauri call.
  // When omitted (D-05 graceful), the picker reverts to "no results" — no crash.
  return (
    <VirtualizedCombobox<JiraUser>
      items={[]} // async-only: items come from onSearch results
      value={selected}
      onChange={(u) => onChange(u)}
      displayLabel={(u) => u.displayName}
      filterFn={() => true} // filter is server-side via onSearch
      placeholder={t('fieldRenderer.placeholder.searchUsers')}
      searchPlaceholder={t('fieldRenderer.placeholder.searchUsers')}
      disabled={disabled}
      onSearch={onSearch}
      initialQuery={initialQuery}
      ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
      renderItem={(u) => (
        <span className="flex items-center gap-2">
          <UserAvatar user={u} size="sm" />
          <span className="truncate">{u.displayName}</span>
          {u.emailAddress && (
            <span className="text-xs text-muted-foreground truncate">{u.emailAddress}</span>
          )}
        </span>
      )}
    />
  );
}
