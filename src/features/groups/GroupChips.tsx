import { useMemo } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CardGroupChip } from './GroupChip';
import { selectGroupIdsForIssue, useGroupStore } from './groupStore';

export function GroupChips({ issueKey, hideGroupId }: { issueKey: string; hideGroupId?: number }) {
  const ids = useGroupStore(selectGroupIdsForIssue(issueKey));
  const groups = useGroupStore((s) => s.groups);
  const chips = useMemo(() => {
    const set = new Set(ids ?? []);
    return groups.filter((g) => set.has(g.id) && g.id !== hideGroupId);
  }, [ids, groups, hideGroupId]);

  if (chips.length === 0) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
        {chips.map((g) => (
          <CardGroupChip key={g.id} group={g} />
        ))}
      </div>
    </TooltipProvider>
  );
}
