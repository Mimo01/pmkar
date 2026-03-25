import { ChevronDown, History } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import changelogRaw from '../../../CHANGELOG.md?raw';

const categoryKeys: Record<string, string> = {
  Features: 'changelog.features',
  'Bug Fixes': 'changelog.bugFixes',
  Refactoring: 'changelog.refactoring',
  Performance: 'changelog.performance',
  Testing: 'changelog.testing',
  Documentation: 'changelog.documentation',
  Miscellaneous: 'changelog.miscellaneous',
  'CI/CD': 'changelog.cicd',
};

/** Categories to hide from user-facing changelog (internal noise) */
const hiddenCategories = new Set(['Documentation', 'Miscellaneous', 'Testing', 'CI/CD']);

interface VersionEntry {
  version: string;
  body: string;
}

interface CategorySection {
  category: string;
  items: string[];
}

function parseChangelog(raw: string): VersionEntry[] {
  const versionHeadingRegex = /^## \[([^\]]+)\]/m;
  const parts = raw.split(/(?=^## \[[^\]]+\])/m);

  const entries: VersionEntry[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = versionHeadingRegex.exec(trimmed);
    if (!match) continue;

    const version = match[1];
    const headingEnd = trimmed.indexOf('\n');
    const body = headingEnd >= 0 ? trimmed.slice(headingEnd + 1).trim() : '';

    entries.push({ version, body });
  }

  // Merge "Unreleased" into the next version entry — those commits are part
  // of the current build even though they landed after the last git tag.
  const unreleasedIdx = entries.findIndex((e) => e.version.toLowerCase() === 'unreleased');
  if (unreleasedIdx !== -1) {
    const unreleased = entries[unreleasedIdx];
    const nextVersionIdx = unreleasedIdx + 1;
    if (nextVersionIdx < entries.length) {
      entries[nextVersionIdx].body = `${unreleased.body}\n${entries[nextVersionIdx].body}`;
    }
    // Drop the Unreleased entry either way
    entries.splice(unreleasedIdx, 1);
  }

  return entries;
}

function parseSections(body: string): CategorySection[] {
  const lines = body.split('\n');
  const sections: CategorySection[] = [];
  let currentCategory: string | null = null;
  let currentItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      if (currentCategory !== null && currentItems.length > 0) {
        sections.push({ category: currentCategory, items: currentItems });
      }
      currentCategory = trimmed.slice(4).trim();
      currentItems = [];
    } else if (trimmed.startsWith('- ') && currentCategory !== null) {
      currentItems.push(trimmed.slice(2).trim());
    }
  }

  if (currentCategory !== null && currentItems.length > 0) {
    sections.push({ category: currentCategory, items: currentItems });
  }

  return sections;
}

/** Filter out internal/noise categories and "bump version" commits */
function filterSections(sections: CategorySection[]): CategorySection[] {
  return sections
    .filter((s) => !hiddenCategories.has(s.category))
    .map((s) => ({
      ...s,
      items: s.items.filter((item) => !item.toLowerCase().startsWith('bump version')),
    }))
    .filter((s) => s.items.length > 0);
}

function countItems(sections: CategorySection[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0);
}

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function VersionBlock({
  version,
  sections,
  isLatest,
  defaultOpen,
}: {
  version: string;
  sections: CategorySection[];
  isLatest: boolean;
  defaultOpen: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const itemCount = countItems(sections);

  return (
    <div className="border border-brand-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-brand-surface/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Badge
            className={
              isLatest
                ? 'bg-brand text-white text-[11px] font-semibold'
                : 'bg-brand-surface text-brand-text-secondary text-[11px] font-semibold border border-brand-border'
            }
          >
            v{version}
          </Badge>
          {isLatest && (
            <span className="text-[11px] text-brand font-medium">
              {t('about.versionHistory.current')}
            </span>
          )}
          {!open && (
            <span className="text-[11px] text-brand-muted">
              {itemCount}{' '}
              {itemCount === 1
                ? t('about.versionHistory.change')
                : t('about.versionHistory.changes')}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-brand-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && sections.length > 0 && (
        <div className="px-3 pb-3 space-y-3 border-t border-brand-border pt-2.5">
          {sections.map((section) => (
            <div key={section.category}>
              <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-1">
                {categoryKeys[section.category]
                  ? t(categoryKeys[section.category])
                  : section.category}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item} className="text-[13px] text-brand-text-secondary flex gap-1.5">
                    <span className="text-brand-muted mt-0.5">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {open && sections.length === 0 && (
        <div className="px-3 pb-3 border-t border-brand-border pt-2.5">
          <p className="text-[13px] text-brand-muted">{t('about.versionHistory.noChanges')}</p>
        </div>
      )}
    </div>
  );
}

export function VersionHistoryModal({ open, onOpenChange }: VersionHistoryModalProps) {
  const { t } = useTranslation();
  const entries = parseChangelog(changelogRaw);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand" aria-hidden="true" />
            {t('about.versionHistory.title')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          {entries.length === 0 ? (
            <p className="text-[13px] text-brand-muted py-4 text-center">
              {t('about.versionHistory.noEntries')}
            </p>
          ) : (
            <div className="space-y-2 py-1">
              {entries.map((entry, idx) => {
                const sections = filterSections(parseSections(entry.body));
                return (
                  <VersionBlock
                    key={entry.version}
                    version={entry.version}
                    sections={sections}
                    isLatest={idx === 0}
                    defaultOpen={idx === 0}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
