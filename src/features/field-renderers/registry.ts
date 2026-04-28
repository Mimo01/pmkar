import type React from 'react';
import type { FieldSchemaType } from '@/types/fieldSchema';
import type { RendererProps } from './types';

import { CheckboxRenderer } from './renderers/CheckboxRenderer';
import { ComponentPickerRenderer } from './renderers/ComponentPickerRenderer';
import { DateRenderer } from './renderers/DateRenderer';
import { DateTimeRenderer } from './renderers/DateTimeRenderer';
import { GroupPickerRenderer } from './renderers/GroupPickerRenderer';
import { LabelsRenderer } from './renderers/LabelsRenderer';
import { MultiSelectRenderer } from './renderers/MultiSelectRenderer';
import { MultiUserPickerRenderer } from './renderers/MultiUserPickerRenderer';
import { NumberRenderer } from './renderers/NumberRenderer';
import { RadioRenderer } from './renderers/RadioRenderer';
import { SingleSelectRenderer } from './renderers/SingleSelectRenderer';
import { StringRenderer } from './renderers/StringRenderer';
import { TextAreaRenderer } from './renderers/TextAreaRenderer';
import { UnsupportedTypeRenderer } from './renderers/UnsupportedTypeRenderer';
import { UrlRenderer } from './renderers/UrlRenderer';
import { UserPickerRenderer } from './renderers/UserPickerRenderer';
import { VersionPickerRenderer } from './renderers/VersionPickerRenderer';

// Jira custom-field-type strings that select dedicated checkbox / radio renderers
// (CTRL-06). These are the standard Jira custom field IDs surfaced via FieldSchema.custom
// from Phase 17 discovery (mirrored from src-tauri/src/field_discovery.rs).
const RADIO_CUSTOM_TYPES = new Set<string>([
  'com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons',
]);

const CHECKBOX_CUSTOM_TYPES = new Set<string>([
  'com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes',
]);

/**
 * Single discrimination function for the renderer registry (D-10/D-11/D-12).
 *
 * Returns a React component constructor matching the FieldSchemaType variant.
 * Adding a new field type = one new renderer file + one new case here. No changes to
 * DynamicTargetForm. (D-12 extension contract.)
 *
 * CTRL-06 routing — checkbox/radio renderers (decision: Option A, planner-recorded):
 * Jira's wire schema does NOT have a discrete `type: 'checkbox'` or `type: 'radio'`. Instead,
 * checkbox/radio custom fields surface as `type: 'array' items: 'option'` (multi-checkboxes) or
 * `type: 'option'` (radio buttons), discriminated by the `schema.custom` string from Phase 17
 * discovery. This switch checks `schema.custom` BEFORE falling through to the default
 * SingleSelectRenderer / MultiSelectRenderer routes. Standard option/multi-select fields
 * (no `custom` marker, or a different custom string) continue to use the combobox renderers
 * — matching the dominant Jira UX pattern.
 *
 * Adding additional custom field IDs that should route to checkbox/radio = add to the
 * RADIO_CUSTOM_TYPES / CHECKBOX_CUSTOM_TYPES sets above. No new file or switch case needed.
 */
export function getRenderer(schema: FieldSchemaType): React.ComponentType<RendererProps> {
  switch (schema.type) {
    case 'string':
      // D-11: string discriminates on schema.system
      if (schema.system === 'description') return TextAreaRenderer;
      if (schema.system === 'url') return UrlRenderer;
      return StringRenderer;
    case 'number':
      return NumberRenderer;
    case 'date':
      return DateRenderer;
    case 'datetime':
      return DateTimeRenderer;
    case 'user':
      return UserPickerRenderer;
    case 'option':
      // CTRL-06: route radio-style custom fields to RadioRenderer
      if (schema.custom && RADIO_CUSTOM_TYPES.has(schema.custom)) return RadioRenderer;
      return SingleSelectRenderer;
    case 'array':
      // D-10: array discriminates on items
      switch (schema.items) {
        case 'user':
          return MultiUserPickerRenderer;
        case 'option':
          // CTRL-06: route multi-checkbox custom fields to CheckboxRenderer
          if (schema.custom && CHECKBOX_CUSTOM_TYPES.has(schema.custom)) return CheckboxRenderer;
          return MultiSelectRenderer;
        case 'component':
          return ComponentPickerRenderer;
        case 'version':
          return VersionPickerRenderer;
        case 'string':
          return LabelsRenderer;
        case 'group':
          return GroupPickerRenderer;
        default:
          return UnsupportedTypeRenderer;
      }
    case 'option-with-child':
    case 'issuetype':
    case 'priority':
    case 'any':
    default:
      return UnsupportedTypeRenderer;
  }
}

/**
 * Returns true when a schema type has an editable renderer in GapsSection.
 * Types that fall through to UnsupportedTypeRenderer (priority, option-with-child,
 * issuetype, any, unknown array items) return false.
 */
export function isEditableSchemaType(schema: FieldSchemaType): boolean {
  switch (schema.type) {
    case 'string':
    case 'number':
    case 'date':
    case 'datetime':
    case 'user':
    case 'option':
      return true;
    case 'array':
      switch (schema.items) {
        case 'user':
        case 'option':
        case 'component':
        case 'version':
        case 'string':
        case 'group':
          return true;
        default:
          return false;
      }
    default:
      return false;
  }
}

// Re-export CheckboxRenderer + RadioRenderer so Phase 21 (Mapping Editor) can opt into them
// when a renderer override is selected (e.g., admin forces a non-default routing).
export { CheckboxRenderer, RadioRenderer };
