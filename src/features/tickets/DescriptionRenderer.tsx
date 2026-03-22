import { useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DescriptionRendererProps {
  description: string | Record<string, unknown> | null;
  renderedHtml?: string;
  baseUrl: string;
}

export function DescriptionRenderer({
  description,
  renderedHtml,
  baseUrl,
}: DescriptionRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!renderedHtml || !containerRef.current) return;

    const images = containerRef.current.querySelectorAll('img');
    let cancelled = false;

    images.forEach(async (img) => {
      const originalSrc = img.src;
      if (!originalSrc) return;

      try {
        const dataUrl = await invoke<string>('fetch_jira_image', {
          imageUrl: originalSrc,
          baseUrl,
        });
        if (!cancelled) {
          img.src = dataUrl;
        }
      } catch {
        if (!cancelled) {
          img.alt = '[image unavailable]';
          img.removeAttribute('src');
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [renderedHtml, baseUrl]);

  // Rendered HTML from renderedFields (v2 Server)
  if (renderedHtml && renderedHtml.trim().length > 0) {
    return (
      <div
        ref={containerRef}
        className="text-sm text-slate-300 leading-relaxed [&_h1]:text-slate-200 [&_h1]:font-semibold [&_h1]:text-lg [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-slate-200 [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-3 [&_h2]:mb-1 [&_a]:text-blue-400 [&_a]:hover:underline [&_code]:bg-brand-surface-hover [&_code]:px-1 [&_code]:py-1 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-emerald-300 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-border [&_blockquote]:pl-3 [&_blockquote]:text-brand-text-secondary [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  // Plain text string description
  if (typeof description === 'string' && description.trim().length > 0) {
    return (
      <pre className="text-sm text-slate-300 whitespace-pre-wrap">
        {description}
      </pre>
    );
  }

  // ADF object (Cloud v3) — show raw JSON for now, proper ADF rendering deferred
  if (description !== null && typeof description === 'object') {
    return (
      <pre className="text-xs text-brand-text-secondary font-mono whitespace-pre-wrap">
        {JSON.stringify(description, null, 2)}
      </pre>
    );
  }

  // No description
  return <p className="text-xs text-brand-muted italic">No description</p>;
}
