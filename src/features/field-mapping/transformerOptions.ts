import type { FieldSchemaType } from '@/types/fieldSchema';

export interface TransformerOption {
  value: 'identity' | 'user' | 'version' | 'component' | 'wiki_to_adf' | 'priority';
  label: string;
  description: string;
}

const IDENTITY: TransformerOption = { value: 'identity', label: 'Identity', description: 'Copy the value as-is' };
const WIKI_TO_ADF: TransformerOption = { value: 'wiki_to_adf', label: 'Wiki → ADF', description: 'Convert Wiki markup to Atlassian Document Format' };
const USER: TransformerOption = { value: 'user', label: 'User', description: 'Match users by display name or email' };
const VERSION: TransformerOption = { value: 'version', label: 'Version', description: 'Match fix versions by name' };
const COMPONENT: TransformerOption = { value: 'component', label: 'Component', description: 'Match components by name' };
const PRIORITY: TransformerOption = { value: 'priority', label: 'Priority', description: 'Map priority levels (e.g. High → High)' };

/**
 * Returns valid transformer options for a target FieldSchemaType (CONTEXT.md D-03).
 *
 * For `{type: 'any'}` returns ALL options — Pitfall 3 mitigation: seed mapping rows
 * have NULL source/target schema JSON, which deserializes to `{type: 'any'}`.
 */
export function getTransformerOptions(schema: FieldSchemaType): TransformerOption[] {
  switch (schema.type) {
    case 'string':
      return [IDENTITY, WIKI_TO_ADF];
    case 'user':
      return [USER, IDENTITY];
    case 'array':
      if (schema.items === 'user') return [USER, IDENTITY];
      if (schema.items === 'version') return [VERSION, IDENTITY];
      if (schema.items === 'component') return [COMPONENT, IDENTITY];
      return [IDENTITY];
    case 'priority':
      return [PRIORITY, IDENTITY];
    case 'number':
    case 'date':
    case 'datetime':
    case 'option':
    case 'option-with-child':
    case 'issuetype':
      return [IDENTITY];
    case 'any':
    default:
      return [IDENTITY, WIKI_TO_ADF, USER, VERSION, COMPONENT, PRIORITY];
  }
}
