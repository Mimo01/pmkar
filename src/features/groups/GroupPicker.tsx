import { AlertCircle, Check, Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { JiraTicket } from '../tickets/types';
import { groupColorVar, pickDefaultColor } from './colors';
import { groupNameErrorKey } from './GroupNameForm';
import { selectGroupIdsForIssue, useGroupStore } from './groupStore';
import { addIssuesWithFeedback, membershipErrorKey } from './membershipActions';
import type { Group } from './types';
import { groupNameKey, normalizeGroupName, validateGroupName } from './validation';

interface CommonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trigger element, wrapped in PopoverTrigger asChild. */
  children: React.ReactElement;
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
}

type CheckboxProps = CommonProps & {
  mode: 'checkbox';
  issueKey: string;
  resolveTicket: () => JiraTicket | null;
};

type ListProps = CommonProps & {
  mode: 'list';
  tickets: readonly JiraTicket[];
  excludeGroupId?: number;
  onAddSucceeded: () => void;
};

export type GroupPickerProps = CheckboxProps | ListProps;

type BodyProps =
  | (Pick<CheckboxProps, 'mode' | 'issueKey' | 'resolveTicket'> & {
      onOpenChange: (open: boolean) => void;
      inputRef: React.RefObject<HTMLInputElement | null>;
    })
  | (Pick<ListProps, 'mode' | 'tickets' | 'excludeGroupId' | 'onAddSucceeded'> & {
      onOpenChange: (open: boolean) => void;
      inputRef: React.RefObject<HTMLInputElement | null>;
    });

export function GroupPicker(props: GroupPickerProps) {
  const { open, onOpenChange, children, side = 'bottom', align = 'start' } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const bodyProps: BodyProps =
    props.mode === 'checkbox'
      ? {
          mode: 'checkbox',
          issueKey: props.issueKey,
          resolveTicket: props.resolveTicket,
          onOpenChange,
          inputRef,
        }
      : {
          mode: 'list',
          tickets: props.tickets,
          excludeGroupId: props.excludeGroupId,
          onAddSucceeded: props.onAddSucceeded,
          onOpenChange,
          inputRef,
        };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-70 p-2"
        side={side}
        align={align}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {/* Radix unmounts content when closed, so query/active/error reset on every open. */}
        <GroupPickerBody {...bodyProps} />
      </PopoverContent>
    </Popover>
  );
}

function GroupPickerBody(props: BodyProps) {
  const { t } = useTranslation();
  const { inputRef, onOpenChange } = props;
  const listboxId = useId();
  const groups = useGroupStore((s) => s.groups);
  const issueKey = props.mode === 'checkbox' ? props.issueKey : '';
  const ids = useGroupStore(selectGroupIdsForIssue(issueKey));
  const memberSet = useMemo(() => new Set(ids ?? []), [ids]);

  const [query, setQuery] = useState('');
  const [userActive, setUserActive] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [creating, setCreating] = useState(false);
  const inFlightToggles = useRef<Set<number>>(new Set());
  const inFlightCreateRef = useRef(false);
  const inFlightListRef = useRef(false);
  // Incremented when the body unmounts (popover closed): late results are stale.
  const openSeqRef = useRef(0);
  useEffect(() => {
    const seqRef = openSeqRef;
    return () => {
      seqRef.current += 1;
    };
  }, []);

  const excludeGroupId = props.mode === 'list' ? props.excludeGroupId : undefined;
  const candidates = useMemo(
    () => (excludeGroupId === undefined ? groups : groups.filter((g) => g.id !== excludeGroupId)),
    [groups, excludeGroupId],
  );

  const queryKey = groupNameKey(normalizeGroupName(query));
  const filtered = useMemo(
    () => candidates.filter((g) => groupNameKey(normalizeGroupName(g.name)).includes(queryKey)),
    [candidates, queryKey],
  );

  // Duplicate checks run against ALL groups, matching Rust uniqueness.
  const validation = useMemo(
    () =>
      validateGroupName(
        query,
        groups.map((g) => g.name),
      ),
    [query, groups],
  );

  const createState: 'none' | 'enabled' | 'disabled' = validation.ok
    ? 'enabled'
    : validation.code === 'too_long' || validation.code === 'reserved'
      ? 'disabled'
      : 'none';
  const hasCreateRow = createState !== 'none';
  const optionCount = filtered.length + (hasCreateRow ? 1 : 0);

  let defaultActive = 0;
  if (!validation.ok && validation.code === 'duplicate') {
    const idx = filtered.findIndex((g) => groupNameKey(normalizeGroupName(g.name)) === queryKey);
    if (idx >= 0) defaultActive = idx;
  }
  const activeIdx =
    optionCount === 0 ? -1 : Math.min(Math.max(userActive ?? defaultActive, 0), optionCount - 1);
  const createIdx = hasCreateRow ? filtered.length : -1;

  const optionId = (idx: number) =>
    idx === createIdx ? `${listboxId}-create` : `${listboxId}-g-${filtered[idx]?.id}`;
  const activeOptionId = activeIdx >= 0 ? optionId(activeIdx) : undefined;

  useEffect(() => {
    if (!activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeOptionId]);

  // Inline error: explicit action error wins, else the validation message for the Create row.
  const validationMessage =
    !validation.ok && (validation.code === 'too_long' || validation.code === 'reserved')
      ? t(groupNameErrorKey(validation.code, 'create'))
      : null;
  const message = error ?? validationMessage;

  function hasMembership(groupId: number): boolean {
    return useGroupStore.getState().groupIdsByIssue[issueKey]?.includes(groupId) ?? false;
  }

  async function toggle(g: Group) {
    if (props.mode !== 'checkbox') return;
    if (inFlightToggles.current.has(g.id)) return;
    const seq = openSeqRef.current;
    const isMember = memberSet.has(g.id);
    inFlightToggles.current.add(g.id);
    try {
      let r: Awaited<ReturnType<ReturnType<typeof useGroupStore.getState>['addToGroup']>>;
      if (isMember) {
        r = await useGroupStore.getState().removeFromGroup(g.id, [issueKey]);
      } else {
        const ticket = props.resolveTicket();
        if (!ticket) {
          setError(t('groups.error.membership'));
          return;
        }
        r = await useGroupStore.getState().addToGroup(g.id, [ticket]);
      }
      if (seq !== openSeqRef.current) return;
      if (!r.ok) {
        setError(t(membershipErrorKey(r.code)));
        return;
      }
      // Pitfall 6: never trust an ok result without confirming the store reflects it.
      if (hasMembership(g.id) === isMember) {
        setError(t('groups.error.membership'));
        return;
      }
      setError(null);
      setAnnounce(
        t(isMember ? 'groups.picker.announceRemoved' : 'groups.picker.announceAdded', {
          name: g.name,
        }),
      );
    } finally {
      inFlightToggles.current.delete(g.id);
    }
  }

  async function activateList(g: Group) {
    if (props.mode !== 'list') return;
    if (inFlightListRef.current) return;
    inFlightListRef.current = true;
    try {
      const ok = await addIssuesWithFeedback({ id: g.id, name: g.name }, props.tickets, t);
      onOpenChange(false);
      if (ok) props.onAddSucceeded();
    } finally {
      inFlightListRef.current = false;
    }
  }

  async function handleCreate() {
    if (inFlightCreateRef.current || !validation.ok) return;
    inFlightCreateRef.current = true;
    setCreating(true);
    const seq = openSeqRef.current;
    try {
      const existing = useGroupStore.getState().groups;
      const r = await useGroupStore
        .getState()
        .createGroup(validation.display, pickDefaultColor(existing.map((g) => g.color)));
      if (!r.ok) {
        if (seq === openSeqRef.current) setError(t(groupNameErrorKey(r.code, 'create')));
        return;
      }
      const created = r.value;
      if (props.mode === 'list') {
        const ok = await addIssuesWithFeedback(
          { id: created.id, name: created.name },
          props.tickets,
          t,
        );
        onOpenChange(false);
        if (ok) props.onAddSucceeded();
        return;
      }
      // Checkbox mode: add the issue, keep the picker open, never navigate (D-04).
      const ticket = props.resolveTicket();
      if (!ticket) {
        if (seq === openSeqRef.current) setError(t('groups.error.membership'));
        return;
      }
      const added = await useGroupStore.getState().addToGroup(created.id, [ticket]);
      if (seq !== openSeqRef.current) return;
      // The group is kept even when the add fails (no rollback delete).
      if (!added.ok) {
        setError(t(membershipErrorKey(added.code)));
        return;
      }
      if (!hasMembership(created.id)) {
        setError(t('groups.error.membership'));
        return;
      }
      setError(null);
      setQuery('');
      setUserActive(null);
      setAnnounce(t('groups.picker.announceAdded', { name: created.name }));
    } finally {
      inFlightCreateRef.current = false;
      setCreating(false);
    }
  }

  function activate(idx: number) {
    if (idx < 0) return;
    if (idx === createIdx) {
      if (createState === 'enabled' && !creating) void handleCreate();
      return;
    }
    const g = filtered[idx];
    if (!g) return;
    if (props.mode === 'checkbox') void toggle(g);
    else void activateList(g);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const last = optionCount - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (optionCount > 0) setUserActive(Math.min(activeIdx + 1, last));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (optionCount > 0) setUserActive(Math.max(activeIdx - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        if (optionCount > 0) setUserActive(0);
        break;
      case 'End':
        e.preventDefault();
        if (optionCount > 0) setUserActive(last);
        break;
      case 'Enter':
        e.preventDefault();
        activate(activeIdx);
        break;
      case ' ':
        // Accepted deviation from UI-SPEC "Space or Enter" (RESEARCH A5): Space toggles
        // only while the search is empty; otherwise it types a space into the query.
        if (query === '') {
          e.preventDefault();
          activate(activeIdx);
        }
        break;
      default:
        break;
    }
  }

  const checkbox = props.mode === 'checkbox';

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={t('groups.picker.searchLabel')}
        placeholder={t('groups.picker.searchPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setUserActive(null);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border border-brand-border bg-transparent px-2 py-1.5 text-sm text-brand-text outline-none focus:border-brand focus:ring-2 focus:ring-brand"
      />
      <div
        id={listboxId}
        role="listbox"
        aria-label={t('groups.picker.searchLabel')}
        aria-multiselectable={checkbox ? 'true' : undefined}
        className="mt-1 max-h-60 overflow-y-auto"
      >
        {filtered.map((g, idx) => {
          const selected = memberSet.has(g.id);
          return (
            <div
              key={g.id}
              id={optionId(idx)}
              role="option"
              aria-selected={checkbox ? selected : undefined}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => activate(idx)}
              onKeyDown={undefined}
              className={`flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-sm text-brand-text ${
                idx === activeIdx ? 'bg-brand-surface-hover' : ''
              }`}
            >
              {checkbox && (
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-brand-border ${
                    selected ? 'bg-brand text-white' : ''
                  }`}
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
              )}
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: groupColorVar(g.color) }}
              />
              <span className="truncate" title={g.name}>
                {g.name}
              </span>
            </div>
          );
        })}
        {hasCreateRow && (
          <div
            id={`${listboxId}-create`}
            role="option"
            aria-disabled={createState === 'disabled' || creating ? 'true' : undefined}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => activate(createIdx)}
            onKeyDown={undefined}
            className={`flex h-8 items-center gap-2 rounded px-2 text-sm ${
              createState === 'disabled' || creating
                ? 'cursor-not-allowed text-brand-muted'
                : 'cursor-pointer text-brand-text'
            } ${createIdx === activeIdx ? 'bg-brand-surface-hover' : ''}`}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {t('groups.picker.create', {
                name: validation.ok ? validation.display : normalizeGroupName(query),
              })}
            </span>
          </div>
        )}
      </div>
      {candidates.length === 0 && !hasCreateRow && (
        <p className="px-2 py-1.5 text-sm text-brand-text-secondary">
          {t('groups.picker.emptyNone')}
        </p>
      )}
      {candidates.length > 0 && filtered.length === 0 && createState !== 'enabled' && (
        <p className="px-2 py-1.5 text-sm text-brand-text-secondary">
          {t('groups.picker.noMatch', { query: normalizeGroupName(query) })}
        </p>
      )}
      <p role="alert" className="mt-1 min-h-4 flex items-center gap-1 text-xs text-destructive">
        {message && (
          <>
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {message}
          </>
        )}
      </p>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
