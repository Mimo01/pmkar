import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { JiraUser } from '@/features/tickets/types';
import { UserAvatar } from '@/features/tickets/UserAvatar';
import { VirtualizedCombobox } from '../components/VirtualizedCombobox';
import type { RendererProps } from '../types';

function isJiraUser(v: unknown): v is JiraUser {
  return Boolean(v && typeof v === 'object' && typeof (v as JiraUser).displayName === 'string');
}

export function MultiUserPickerRenderer({
  field,
  value,
  onChange,
  required,
  disabled,
  onSearch,
}: RendererProps) {
  const { t } = useTranslation();
  // D-02: only render JiraUser shapes; UnresolvedPerson gap chips are Phase 22's responsibility
  const users: JiraUser[] = Array.isArray(value) ? value.filter(isJiraUser) : [];

  function removeAt(idx: number) {
    const next = users.filter((_, i) => i !== idx);
    onChange(next);
  }

  function addUser(u: JiraUser) {
    // De-duplicate by accountId or name
    const id = u.accountId ?? u.name ?? u.displayName;
    const exists = users.some(
      (existing) => (existing.accountId ?? existing.name ?? existing.displayName) === id,
    );
    if (!exists) onChange([...users, u]);
  }

  return (
    <div className="flex flex-col gap-2">
      {users.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {users.map((u, idx) => (
            <span
              key={u.accountId ?? u.name ?? u.displayName ?? String(idx)}
              className="inline-flex items-center gap-1.5 bg-muted text-foreground text-xs rounded-full px-2.5 py-1 h-8"
            >
              <UserAvatar user={u} size="sm" />
              <span className="truncate max-w-[160px]">{u.displayName}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeAt(idx)}
                aria-label={t('fieldRenderer.removeItem', {
                  item: u.displayName,
                  defaultValue: `Remove ${u.displayName}`,
                })}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <VirtualizedCombobox<JiraUser>
        id={field.fieldId}
        items={[]}
        value={null}
        onChange={addUser}
        displayLabel={(u) => u.displayName}
        filterFn={() => true}
        placeholder={t('fieldRenderer.placeholder.searchUsers')}
        searchPlaceholder={t('fieldRenderer.placeholder.searchUsers')}
        disabled={disabled}
        onSearch={onSearch}
        ariaLabel={`${field.name}${required ? ' (required)' : ''}`}
        renderItem={(u) => (
          <span className="flex items-center gap-2">
            <UserAvatar user={u} size="sm" />
            <span className="truncate">{u.displayName}</span>
          </span>
        )}
      />
    </div>
  );
}
