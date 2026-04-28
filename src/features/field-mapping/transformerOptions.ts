import type { FieldSchemaType } from '@/types/fieldSchema';

export interface TransformerOption {
  value: 'identity' | 'user' | 'version' | 'component' | 'wiki_to_adf' | 'priority';
  label: string;
  description: string;
}

type TFn = (key: string) => string;

function makeOptions(t: TFn) {
  const IDENTITY: TransformerOption = { value: 'identity', label: t('settings.transformer.identity.label'), description: t('settings.transformer.identity.description') };
  const WIKI_TO_ADF: TransformerOption = { value: 'wiki_to_adf', label: t('settings.transformer.wikiToAdf.label'), description: t('settings.transformer.wikiToAdf.description') };
  const USER: TransformerOption = { value: 'user', label: t('settings.transformer.user.label'), description: t('settings.transformer.user.description') };
  const VERSION: TransformerOption = { value: 'version', label: t('settings.transformer.version.label'), description: t('settings.transformer.version.description') };
  const COMPONENT: TransformerOption = { value: 'component', label: t('settings.transformer.component.label'), description: t('settings.transformer.component.description') };
  const PRIORITY: TransformerOption = { value: 'priority', label: t('settings.transformer.priority.label'), description: t('settings.transformer.priority.description') };
  return { IDENTITY, WIKI_TO_ADF, USER, VERSION, COMPONENT, PRIORITY };
}

/**
 * Returns valid transformer options for a target FieldSchemaType (CONTEXT.md D-03).
 *
 * For `{type: 'any'}` returns ALL options — Pitfall 3 mitigation: seed mapping rows
 * have NULL source/target schema JSON, which deserializes to `{type: 'any'}`.
 */
export function getTransformerOptions(schema: FieldSchemaType, t: TFn): TransformerOption[] {
  const { IDENTITY, WIKI_TO_ADF, USER, VERSION, COMPONENT, PRIORITY } = makeOptions(t);
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
