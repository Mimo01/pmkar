import { ArrowDownLeft, ArrowUpRight, Link2 } from 'lucide-react';
import { AllFieldsSection } from '../AllFieldsSection';
import { DescriptionRenderer } from '../DescriptionRenderer';
import { StatusBadge } from '../StatusBadge';
import type { JiraTicketDetail } from '../types';

interface OverviewTabProps {
  detail: JiraTicketDetail;
  baseUrl: string;
}

// Fields that have bespoke layout sections below AllFieldsSection, or that are
// shown in the page header (summary, created, updated).
const OVERVIEW_BESPOKE_FIELDS = [
  'description', // rendered by DescriptionRenderer below
  'subtasks', // rendered by Sub-tasks block below
  'issuelinks', // rendered by Linked Issues block below
  'comment', // shown in Comments tab; counts shown in tab label
  'attachment', // shown in Attachments tab; counts shown in tab label
  'worklog', // shown in Work Log tab
  'updated', // shown in page header
  'created', // shown in page header
  'summary', // shown in page header
];

export function OverviewTab({ detail, baseUrl }: OverviewTabProps) {
  const { fields } = detail;

  return (
    <div>
      {/* Dynamic field grid — all non-bespoke source fields */}
      <AllFieldsSection
        fields={detail.fields as unknown as Record<string, unknown>}
        skip={OVERVIEW_BESPOKE_FIELDS}
        skipLabels={['last comment']}
        baseUrl={baseUrl}
        fieldNames={detail.names}
      />

      {/* Description */}
      <div className="px-5 py-4 border-t border-brand-border-subtle">
        <div className="text-xs font-semibold text-brand-muted mb-3">Description</div>
        <DescriptionRenderer
          description={fields.description}
          renderedHtml={detail.renderedFields?.description}
          baseUrl={baseUrl}
        />
      </div>

      {/* Sub-tasks */}
      {fields.subtasks.length > 0 && (
        <div className="px-5 py-4 border-t border-brand-border-subtle">
          <div className="text-xs font-semibold text-brand-muted mb-2">Sub-tasks</div>
          {fields.subtasks.map((subtask) => (
            <div key={subtask.key} className="flex items-center gap-2 py-1">
              <span className="text-xs font-semibold text-brand-text-secondary">{subtask.key}</span>
              <span className="text-sm text-brand-text-secondary">{subtask.fields.summary}</span>
              <StatusBadge status={subtask.fields.status.name} />
            </div>
          ))}
        </div>
      )}

      {/* Linked Issues */}
      {fields.issuelinks.length > 0 &&
        (() => {
          const groups = new Map<
            string,
            {
              isOutward: boolean;
              items: Array<{ key: string; summary: string; statusName: string; linkId: string }>;
            }
          >();
          for (const link of fields.issuelinks) {
            const isOutward = !!link.outwardIssue;
            const linkedIssue = isOutward ? link.outwardIssue : link.inwardIssue;
            if (!linkedIssue) continue;
            const direction = isOutward ? link.type.outward : link.type.inward;
            if (!groups.has(direction)) {
              groups.set(direction, { isOutward, items: [] });
            }
            groups.get(direction)!.items.push({
              key: linkedIssue.key,
              summary: linkedIssue.fields.summary,
              statusName: linkedIssue.fields.status.name,
              linkId: link.id,
            });
          }

          return (
            <div className="px-5 py-4 border-t border-brand-border-subtle">
              <div className="text-xs font-semibold text-brand-muted mb-3">Linked Issues</div>
              {Array.from(groups.entries()).map(([direction, group], groupIndex) => {
                const DirectionIcon = group.isOutward ? ArrowUpRight : ArrowDownLeft;
                const fallbackIcon = !group.isOutward && !direction.toLowerCase().startsWith('is');
                const IconComponent = fallbackIcon ? Link2 : DirectionIcon;
                return (
                  <div key={direction}>
                    <div
                      className={`flex items-center gap-1.5 mb-1.5 mt-3 ${groupIndex === 0 ? 'first:mt-0 mt-0' : ''}`}
                    >
                      <IconComponent className="w-3.5 h-3.5 text-brand-muted" />
                      <span className="text-xs font-medium text-brand-muted capitalize">
                        {direction}
                      </span>
                    </div>
                    {group.items.map((item) => (
                      <div
                        key={item.linkId}
                        className="flex items-center gap-2.5 py-1.5 px-3 rounded-md hover:bg-brand-surface-hover transition-colors"
                      >
                        <span className="text-xs font-semibold font-mono text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded">
                          {item.key}
                        </span>
                        <span className="text-sm text-brand-text-secondary truncate flex-1">
                          {item.summary}
                        </span>
                        <StatusBadge status={item.statusName} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}
    </div>
  );
}
