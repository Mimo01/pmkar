/**
 * Read-only source field value formatter (260429-ev2).
 *
 * Accepts (FieldSchemaType, value) and returns a React node for display in
 * AllFieldsSection, OverviewTab, and CopyPreviewModal source column.
 *
 * Mirrors the discrimination shape of registry.ts but emits read-only React nodes
 * instead of editable form controls — intentionally a parallel surface.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PriorityIcon } from '@/features/tickets/PriorityIcon';
import { StatusBadge } from '@/features/tickets/StatusBadge';
import type { JiraUser } from '@/features/tickets/types';
import { UserAvatar } from '@/features/tickets/UserAvatar';
import { formatDate } from '@/lib/format';
import type { FieldSchemaType } from '@/types/fieldSchema';

// ---------------------------------------------------------------------------
// isNoiseValue — returns true for values the UI should not display
// ---------------------------------------------------------------------------

/**
 * Returns true for values that are effectively empty / noise:
 * - null / undefined
 * - empty string
 * - empty array
 * - empty plain object
 * - workratio === -1 (Jira internal sentinel)
 * - all-zero progress shape for progress / aggregateprogress fields
 */
export function isNoiseValue(fieldId: string, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  ) {
    return true;
  }
  // workratio:-1 sentinel
  if (fieldId === 'workratio' && value === -1) return true;
  // all-zero progress sentinel
  if (
    (fieldId === 'progress' || fieldId === 'aggregateprogress') &&
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const p = value as Record<string, unknown>;
    if (p.progress === 0 && p.total === 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips HTML from a string value. Removes <style>/<script> blocks entirely
 * (including their inner text), then strips remaining tags. Returns empty string
 * if nothing meaningful remains.
 */
function stripHtml(s: string): string {
  return s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractOption(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  const obj = v as Record<string, unknown>;
  if (typeof obj.value === 'string') return obj.value;
  if (typeof obj.name === 'string') return obj.name;
  return String(v);
}

function isObjectWithName(v: unknown): v is { name: string } & Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return typeof (v as Record<string, unknown>).name === 'string';
}

function isStatusShape(v: unknown): v is { name: string; statusCategory: { key: string } } {
  if (!isObjectWithName(v)) return false;
  return typeof v.statusCategory === 'object' && v.statusCategory !== null;
}

function renderIssuetypeValue(value: unknown): ReactNode | null {
  if (!isObjectWithName(value)) return null;
  const iconUrl = typeof value.iconUrl === 'string' ? value.iconUrl : null;
  return (
    <span className="flex items-center gap-1.5">
      {iconUrl && <img src={iconUrl} alt="" aria-hidden="true" className="w-4 h-4" />}
      {value.name}
    </span>
  );
}

function renderPriorityValue(value: unknown): ReactNode | null {
  if (!isObjectWithName(value)) return null;
  return <PriorityIcon priority={value.name} size="sm" />;
}

// ---------------------------------------------------------------------------
// RawTag — small "raw" indicator rendered inside the 'any' fallback
// ---------------------------------------------------------------------------

function RawTag() {
  const { t } = useTranslation();
  return (
    <span
      className="text-[10px] uppercase ml-1.5 text-brand-muted"
      title={t('fieldDisplay.unknownFieldType')}
    >
      {t('fieldDisplay.raw')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// renderSourceFieldValue
// ---------------------------------------------------------------------------

/**
 * Discriminates on schema.type (mirroring registry.ts) and returns a read-only
 * React node for the given value, or null if the value is noise/empty.
 *
 * @param schema  - FieldSchemaType from the source schema cache
 * @param value   - Raw value from JiraTicketDetail.fields cast to unknown
 * @param opts    - Optional fieldId (for noise detection) and baseUrl
 */
export function renderSourceFieldValue(
  schema: FieldSchemaType,
  value: unknown,
  opts?: { fieldId?: string; baseUrl?: string },
): ReactNode | null {
  const fieldId = opts?.fieldId ?? '';

  // Top-level noise check (runs before type dispatch)
  if (isNoiseValue(fieldId, value)) return null;

  switch (schema.type) {
    // ── string ──────────────────────────────────────────────────────────────
    case 'string': {
      if (typeof value !== 'string') return null;
      // description is caller-managed (DescriptionRenderer); return truncated raw text
      if (schema.system === 'description') {
        const truncated = value.length > 240 ? `${value.slice(0, 240)}…` : value;
        return <span>{truncated}</span>;
      }
      const display = stripHtml(value) || value;
      const truncated = display.length > 240 ? `${display.slice(0, 240)}…` : display;
      return <span>{truncated}</span>;
    }

    // ── number ───────────────────────────────────────────────────────────────
    case 'number': {
      if (typeof value !== 'number') return null;
      return <span>{String(value)}</span>;
    }

    // ── date ─────────────────────────────────────────────────────────────────
    case 'date': {
      if (typeof value !== 'string') return null;
      const formatted = formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' });
      return <span>{formatted}</span>;
    }

    // ── datetime ─────────────────────────────────────────────────────────────
    case 'datetime': {
      if (typeof value !== 'string') return null;
      const formatted = formatDate(value, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      return <span>{formatted}</span>;
    }

    // ── user ─────────────────────────────────────────────────────────────────
    case 'user': {
      if (typeof value !== 'object' || value === null) return null;
      const u = value as Partial<JiraUser> & Record<string, unknown>;
      const name =
        u.displayName ??
        (typeof u.name === 'string' ? u.name : undefined) ??
        (typeof u.accountId === 'string' ? u.accountId : undefined) ??
        '—';
      const jiraUser: JiraUser = {
        displayName: typeof name === 'string' ? name : String(name),
        name: typeof u.name === 'string' ? u.name : undefined,
        accountId: typeof u.accountId === 'string' ? u.accountId : undefined,
        avatarUrls: u.avatarUrls as Record<string, string> | undefined,
        emailAddress: typeof u.emailAddress === 'string' ? u.emailAddress : undefined,
      };
      return (
        <span className="flex items-center gap-1.5">
          <UserAvatar user={jiraUser} size="sm" />
          {jiraUser.displayName}
        </span>
      );
    }

    // ── option ───────────────────────────────────────────────────────────────
    case 'option': {
      const label = extractOption(value);
      if (!label) return null;
      return <span>{label}</span>;
    }

    // ── option-with-child ────────────────────────────────────────────────────
    case 'option-with-child': {
      if (typeof value !== 'object' || value === null) return null;
      const obj = value as Record<string, unknown>;
      const parent =
        typeof obj.value === 'string'
          ? obj.value
          : typeof obj.name === 'string'
            ? obj.name
            : String(obj);
      const childObj =
        typeof obj.child === 'object' && obj.child !== null
          ? (obj.child as Record<string, unknown>)
          : null;
      const child = childObj
        ? typeof childObj.value === 'string'
          ? childObj.value
          : typeof childObj.name === 'string'
            ? childObj.name
            : ''
        : '';
      const display = child ? `${parent} / ${child}` : parent;
      return <span>{display}</span>;
    }

    // ── priority ─────────────────────────────────────────────────────────────
    case 'priority':
      return renderPriorityValue(value);

    // ── issuetype ────────────────────────────────────────────────────────────
    case 'issuetype':
      return renderIssuetypeValue(value);

    // ── array ────────────────────────────────────────────────────────────────
    case 'array': {
      if (!Array.isArray(value) || value.length === 0) return null;
      switch (schema.items) {
        case 'string': {
          const labels = (value as unknown[]).filter((v) => typeof v === 'string') as string[];
          if (labels.length === 0) return null;
          return <span>{labels.join(', ')}</span>;
        }
        case 'user': {
          return (
            <span className="flex flex-wrap gap-2">
              {(value as unknown[]).map((u, i) => {
                const user = u as Partial<JiraUser> & Record<string, unknown>;
                const displayName = user.displayName ?? String(u);
                const jiraUser: JiraUser = {
                  displayName: typeof displayName === 'string' ? displayName : String(displayName),
                  name: typeof user.name === 'string' ? user.name : undefined,
                  accountId: typeof user.accountId === 'string' ? user.accountId : undefined,
                  avatarUrls: user.avatarUrls as Record<string, string> | undefined,
                };
                // Use accountId/name/index as key — user arrays in Jira are stable order
                const key = jiraUser.accountId ?? jiraUser.name ?? `user-${i}`;
                return (
                  <span key={key} className="flex items-center gap-1">
                    <UserAvatar user={jiraUser} size="sm" />
                    {jiraUser.displayName}
                  </span>
                );
              })}
            </span>
          );
        }
        case 'option': {
          const labels = (value as unknown[]).map(extractOption).filter(Boolean);
          if (labels.length === 0) return null;
          return <span>{labels.join(', ')}</span>;
        }
        case 'component':
        case 'version': {
          const labels = (value as unknown[])
            .map((v) => {
              const obj = v as Record<string, unknown>;
              return typeof obj.name === 'string' ? obj.name : String(v);
            })
            .filter(Boolean);
          if (labels.length === 0) return null;
          return <span>{labels.join(', ')}</span>;
        }
        case 'group': {
          const labels = (value as unknown[])
            .map((v) => {
              const obj = v as Record<string, unknown>;
              return typeof obj.name === 'string'
                ? obj.name
                : typeof obj.groupId === 'string'
                  ? obj.groupId
                  : String(v);
            })
            .filter(Boolean);
          if (labels.length === 0) return null;
          return <span>{labels.join(', ')}</span>;
        }
        default: {
          // Unknown array items — JSON fallback per item
          const json = JSON.stringify(value);
          const truncated = json.length > 200 ? `${json.slice(0, 200)}...` : json;
          return (
            <>
              <code className="text-xs text-brand-muted bg-brand-surface-hover px-1.5 py-0.5 rounded">
                {truncated}
              </code>
              <RawTag />
            </>
          );
        }
      }
    }

    // ── any (and default) ────────────────────────────────────────────────────
    default: {
      // Field-id dispatch: Jira's /field endpoint returns schema.type values
      // (e.g. "status") that aren't in our enum and deserialize to 'any'.
      // Match by system field id so status/issuetype/priority still render properly.
      if (fieldId === 'status' && isObjectWithName(value)) {
        return <StatusBadge status={value.name} />;
      }
      if (fieldId === 'issuetype') {
        return renderIssuetypeValue(value);
      }
      if (fieldId === 'priority') {
        return renderPriorityValue(value);
      }
      if (fieldId === 'resolution' && isObjectWithName(value)) {
        return <span>{value.name}</span>;
      }
      if (fieldId === 'votes' && typeof value === 'object' && value !== null) {
        const v = value as Record<string, unknown>;
        if (typeof v.votes === 'number') {
          return <span>{v.votes === 1 ? '1 vote' : `${v.votes} votes`}</span>;
        }
      }
      if (fieldId === 'watches' && typeof value === 'object' && value !== null) {
        const v = value as Record<string, unknown>;
        if (typeof v.watchCount === 'number') {
          return <span>{v.watchCount === 1 ? '1 watcher' : `${v.watchCount} watchers`}</span>;
        }
      }
      // Shape-based: status object enriched with statusCategory (no fieldId match needed)
      if (isStatusShape(value)) {
        return <StatusBadge status={value.name} />;
      }
      // Plain string — strip HTML if present; fall back to original if nothing remains
      if (typeof value === 'string') {
        const display = stripHtml(value) || value;
        const truncated = display.length > 240 ? `${display.slice(0, 240)}…` : display;
        return <span>{truncated}</span>;
      }
      if (typeof value === 'number') {
        return <span>{String(value)}</span>;
      }
      if (typeof value === 'boolean') {
        return <span>{value ? 'Yes' : 'No'}</span>;
      }
      // Arrays of objects with name or value (custom multi-select cf, components, etc.)
      if (Array.isArray(value)) {
        const labels = value
          .map((v) => {
            if (isObjectWithName(v)) return v.name;
            if (typeof v === 'string') return v;
            const obj = v as Record<string, unknown>;
            if (typeof obj.value === 'string' && obj.value) return obj.value;
            return null;
          })
          .filter((s): s is string => typeof s === 'string' && s.length > 0);
        if (labels.length > 0) {
          return <span>{labels.join(', ')}</span>;
        }
      }
      // Generic object with `name` (project, parent, security level, custom user-pickers,
      // and any unmapped object whose primary identity is its name)
      if (isObjectWithName(value)) {
        return <span>{value.name}</span>;
      }
      // Object with `value` string property (Jira option/select custom fields without `name`)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        if (typeof obj.value === 'string' && obj.value) {
          return <span>{obj.value}</span>;
        }
      }
      // JSON fallback for shapes we genuinely can't read
      const json = JSON.stringify(value);
      const truncated = json.length > 200 ? `${json.slice(0, 200)}...` : json;
      return (
        <>
          <code className="text-xs text-brand-muted bg-brand-surface-hover px-1.5 py-0.5 rounded">
            {truncated}
          </code>
          <RawTag />
        </>
      );
    }
  }
}
