import { useLanguageStore } from '../i18n/languageStore';

const LOCALE_MAP = { en: 'en-US', sk: 'sk-SK' } as const;

export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  const lang = useLanguageStore.getState().language;
  const locale = LOCALE_MAP[lang];
  return new Intl.DateTimeFormat(
    locale,
    options ?? {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  ).format(new Date(iso));
}

export function formatRelativeTime(iso: string): string {
  const lang = useLanguageStore.getState().language;
  const locale = LOCALE_MAP[lang];
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSeconds = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const absDiff = Math.abs(diffSeconds);
  if (absDiff < 60) return rtf.format(diffSeconds, 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffSeconds / 86400), 'day');
}

export function formatTimestamp(iso: string): string {
  const lang = useLanguageStore.getState().language;
  const locale = LOCALE_MAP[lang];
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}
