import { DescriptionRenderer } from '../DescriptionRenderer';
import type { JiraTicketDetail } from '../types';

interface OverviewTabProps {
  detail: JiraTicketDetail;
  baseUrl: string;
}

function FieldItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-brand-muted mb-1">{label}</div>
      <div className="text-sm text-brand-text-secondary">{value}</div>
    </div>
  );
}

export function OverviewTab({ detail, baseUrl }: OverviewTabProps) {
  const { fields } = detail;

  return (
    <div>
      {/* Field grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
        <FieldItem label="Assignee" value={fields.assignee?.displayName ?? 'Unassigned'} />
        <FieldItem label="Reporter" value={fields.reporter?.displayName ?? 'Unknown'} />
        <FieldItem label="Status" value={fields.status.name} />
        <FieldItem label="Priority" value={fields.priority.name} />
        <FieldItem
          label="Labels"
          value={fields.labels.length > 0 ? fields.labels.join(', ') : 'None'}
        />
        <FieldItem
          label="Components"
          value={
            fields.components.length > 0 ? fields.components.map((c) => c.name).join(', ') : 'None'
          }
        />
        <FieldItem
          label="Fix Versions"
          value={
            fields.fixVersions.length > 0
              ? fields.fixVersions.map((v) => v.name).join(', ')
              : 'None'
          }
        />
      </div>

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
              <span className="text-xs text-brand-muted">{subtask.fields.status.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Linked Issues */}
      {fields.issuelinks.length > 0 && (
        <div className="px-5 py-4 border-t border-brand-border-subtle">
          <div className="text-xs font-semibold text-brand-muted mb-2">Linked Issues</div>
          {fields.issuelinks.map((link) => {
            const isOutward = !!link.outwardIssue;
            const linkedIssue = isOutward ? link.outwardIssue : link.inwardIssue;
            const direction = isOutward ? link.type.outward : link.type.inward;

            if (!linkedIssue) return null;

            return (
              <div key={link.id} className="flex items-center gap-2 py-1">
                <span className="text-xs text-brand-text-secondary">{direction}</span>
                <span className="text-xs font-semibold text-brand-text-secondary">
                  {linkedIssue.key}
                </span>
                <span className="text-sm text-brand-text-secondary">
                  {linkedIssue.fields.summary}
                </span>
                <span className="text-xs text-brand-muted">{linkedIssue.fields.status.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
