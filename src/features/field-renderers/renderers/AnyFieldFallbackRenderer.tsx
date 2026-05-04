import type { RendererProps } from '../types';
import { SingleSelectRenderer } from './SingleSelectRenderer';
import { StringRenderer } from './StringRenderer';

export function AnyFieldFallbackRenderer(props: RendererProps) {
  if (Array.isArray(props.field.allowedValues) && props.field.allowedValues.length > 0) {
    return <SingleSelectRenderer {...props} />;
  }
  return <StringRenderer {...props} />;
}
