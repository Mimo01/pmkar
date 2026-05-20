import type { FieldSchemaType } from '@/types/fieldSchema';

export type TransformerKind =
  | 'identity'
  | 'user'
  | 'user_name'
  | 'version'
  | 'component'
  | 'wiki_to_adf'
  | 'priority'
  | 'static';

export interface TransformerOption {
  value: TransformerKind;
  label: string;
  description: string;
}

type TFn = (key: string) => string;

function makeOptions(t: TFn) {
  const IDENTITY: TransformerOption = {
    value: 'identity',
    label: t('settings.transformer.identity.label'),
    description: t('settings.transformer.identity.description'),
  };
  const WIKI_TO_ADF: TransformerOption = {
    value: 'wiki_to_adf',
    label: t('settings.transformer.wikiToAdf.label'),
    description: t('settings.transformer.wikiToAdf.description'),
  };
  const USER: TransformerOption = {
    value: 'user',
    label: t('settings.transformer.user.label'),
    description: t('settings.transformer.user.description'),
  };
  const USER_NAME: TransformerOption = {
    value: 'user_name',
    label: t('settings.transformer.userName.label'),
    description: t('settings.transformer.userName.description'),
  };
  const VERSION: TransformerOption = {
    value: 'version',
    label: t('settings.transformer.version.label'),
    description: t('settings.transformer.version.description'),
  };
  const COMPONENT: TransformerOption = {
    value: 'component',
    label: t('settings.transformer.component.label'),
    description: t('settings.transformer.component.description'),
  };
  const PRIORITY: TransformerOption = {
    value: 'priority',
    label: t('settings.transformer.priority.label'),
    description: t('settings.transformer.priority.description'),
  };
  return { IDENTITY, WIKI_TO_ADF, USER, USER_NAME, VERSION, COMPONENT, PRIORITY };
}

function isUserSource(sourceSchema: FieldSchemaType | undefined): boolean {
  if (!sourceSchema) return false;
  return (
    sourceSchema.type === 'user' ||
    (sourceSchema.type === 'array' && 'items' in sourceSchema && sourceSchema.items === 'user')
  );
}

/**
 * Returns valid transformer options for a target FieldSchemaType (CONTEXT.md D-03).
 *
 * Pass `sourceSchema` to unlock cross-type transformers (e.g. user_name when
 * source=user and target=string).
 *
 * For `{type: 'any'}` returns ALL options — Pitfall 3 mitigation: seed mapping rows
 * have NULL source/target schema JSON, which deserializes to `{type: 'any'}`.
 */
export function getTransformerOptions(
  schema: FieldSchemaType,
  t: TFn,
  sourceSchema?: FieldSchemaType,
): TransformerOption[] {
  const { IDENTITY, WIKI_TO_ADF, USER, USER_NAME, VERSION, COMPONENT, PRIORITY } = makeOptions(t);

  // user → string: only USER_NAME makes sense (identity returns Null, user resolves accountId)
  if (isUserSource(sourceSchema) && schema.type === 'string') {
    return [USER_NAME];
  }

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
    default:
      return [IDENTITY, WIKI_TO_ADF, USER, USER_NAME, VERSION, COMPONENT, PRIORITY];
  }
}
