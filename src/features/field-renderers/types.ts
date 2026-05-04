import type { JiraUser } from '@/features/tickets/types';
import type { FieldSchema } from '@/types/fieldSchema';

/**
 * Component reference for picker renderers (multi-select Components field).
 * Phase 17 discovery populates allowedValues with this shape.
 */
export interface JiraComponent {
  id?: string;
  name: string;
}

/**
 * Version reference for picker renderers (multi-select Versions / Fix Versions).
 * Phase 17 discovery populates allowedValues with this shape.
 */
export interface JiraVersion {
  id?: string;
  name: string;
  released?: boolean;
  archived?: boolean;
}

/**
 * Async callbacks injected by Phase 22 wiring. Renderers never call invoke directly (D-01).
 * When omitted, renderers default to returning empty arrays (D-05 graceful degradation).
 */
export interface SearchCallbacks {
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
  onFetchComponents?: () => Promise<JiraComponent[]>;
  onFetchVersions?: () => Promise<JiraVersion[]>;
}

/**
 * Unified prop bag for every renderer (D-04). Optional fields cover the union of all
 * renderer needs; each renderer reads only what it requires.
 *
 * - field: full FieldSchema including allowedValues + name + required
 * - value: current value (managed by Phase 22; renderers are controlled inputs)
 * - onChange: propagates updated value upward
 * - required: visual indicator only in Phase 20 (gating is Phase 22)
 * - disabled: passthrough
 * - onSearch: D-01 — only User/MultiUser pickers consume this
 * - initialQuery: D-03 — UserPickerRenderer auto-triggers onSearch(initialQuery) on mount
 */
export interface RendererProps {
  field: FieldSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  required?: boolean;
  disabled?: boolean;
  onSearch?: (q: string) => Promise<JiraUser[]>;
  initialQuery?: string;
}
