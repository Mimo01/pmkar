import { useMemo } from 'react';
import { highlightRanges } from './normalize';

/** Renders text with matched words wrapped in neutral <mark>. Text nodes only (no HTML injection). */
export function Highlight({ text, words }: { text: string; words: readonly string[] }) {
  const parts = useMemo(() => {
    const ranges = highlightRanges(text, words);
    const out: { start: number; text: string; mark: boolean }[] = [];
    let pos = 0;
    for (const [s, e] of ranges) {
      if (s > pos) out.push({ start: pos, text: text.slice(pos, s), mark: false });
      out.push({ start: s, text: text.slice(s, e), mark: true });
      pos = e;
    }
    if (pos < text.length) out.push({ start: pos, text: text.slice(pos), mark: false });
    return out;
  }, [text, words]);

  return (
    <>
      {parts.map((p) =>
        p.mark ? (
          <mark
            key={p.start}
            className="bg-brand-surface-raised text-brand-text font-semibold rounded-sm"
          >
            {p.text}
          </mark>
        ) : (
          <span key={p.start}>{p.text}</span>
        ),
      )}
    </>
  );
}
