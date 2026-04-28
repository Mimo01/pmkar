import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RendererProps } from '../types';

export function UnsupportedTypeRenderer({ field }: RendererProps) {
  const { t } = useTranslation();
  const typeStr = field.schema.type;
  return (
    <Badge
      variant="outline"
      role="status"
      aria-label={`Unsupported field type: ${typeStr}`}
      className={cn('text-xs font-medium text-muted-foreground gap-1 inline-flex items-center')}
    >
      <AlertCircle className="w-3 h-3" aria-hidden="true" />
      <span>{t('fieldRenderer.unsupportedType', { type: typeStr, defaultValue: `Unsupported: ${typeStr}` })}</span>
    </Badge>
  );
}
