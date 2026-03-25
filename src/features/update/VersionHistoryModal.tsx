import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import changelogRaw from '../../../CHANGELOG.md?raw';

interface VersionEntry {
  version: string;
  body: string;
}

interface CategorySection {
  category: string;
  items: string[];
}

function parseChangelog(raw: string): VersionEntry[] {
  // Split on version headings: ## [vX.Y.Z] or ## [X.Y.Z]
  const versionHeadingRegex = /^## \[([^\]]+)\]/m;
  const parts = raw.split(/(?=^## \[[^\]]+\])/m);

  const entries: VersionEntry[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = versionHeadingRegex.exec(trimmed);
    if (!match) continue;

    const version = match[1];
    // Get the body after the heading line
    const headingEnd = trimmed.indexOf('\n');
    const body = headingEnd >= 0 ? trimmed.slice(headingEnd + 1).trim() : '';

    entries.push({ version, body });
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
      if (currentCategory !== null) {
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

// For changelog without version headings (unreleased section at top)
function parseUnversionedSections(raw: string): CategorySection[] {
  // Get the portion before the first version heading
  const firstVersionIdx = raw.search(/^## \[[^\]]+\]/m);
  const topContent = firstVersionIdx >= 0 ? raw.slice(0, firstVersionIdx) : raw;
  return parseSections(topContent.trim());
}

interface VersionHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionHistoryModal({ open, onOpenChange }: VersionHistoryModalProps) {
  const { t } = useTranslation();
  const entries = parseChangelog(changelogRaw);

  // Also parse any unreleased content at the top (before first version heading)
  const unreleasedSections = parseUnversionedSections(changelogRaw);

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
          {entries.length === 0 && unreleasedSections.length === 0 ? (
            <p className="text-[13px] text-brand-muted py-4 text-center">
              {t('about.versionHistory.noEntries')}
            </p>
          ) : (
            <div className="space-y-6 py-1">
              {/* Unreleased section (no version tag) */}
              {unreleasedSections.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-brand text-white text-[11px] font-semibold">
                      Unreleased
                    </Badge>
                  </div>
                  <div className="space-y-3 pl-1">
                    {unreleasedSections.map((section) => (
                      <div key={section.category}>
                        <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-1">
                          {section.category}
                        </p>
                        <ul className="space-y-1">
                          {section.items.map((item, idx) => (
                            <li
                              key={idx}
                              className="text-[13px] text-brand-text-secondary flex gap-1.5"
                            >
                              <span className="text-brand-muted mt-0.5">·</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Versioned entries */}
              {entries.map((entry) => {
                const sections = parseSections(entry.body);
                return (
                  <div key={entry.version} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-brand text-white text-[11px] font-semibold">
                        {entry.version}
                      </Badge>
                    </div>
                    {sections.length > 0 ? (
                      <div className="space-y-3 pl-1">
                        {sections.map((section) => (
                          <div key={section.category}>
                            <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider mb-1">
                              {section.category}
                            </p>
                            <ul className="space-y-1">
                              {section.items.map((item, idx) => (
                                <li
                                  key={idx}
                                  className="text-[13px] text-brand-text-secondary flex gap-1.5"
                                >
                                  <span className="text-brand-muted mt-0.5">·</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-brand-muted pl-1">{entry.body || '—'}</p>
                    )}
                    <div className="border-t border-brand-border" />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
