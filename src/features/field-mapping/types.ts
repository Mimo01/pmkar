/**
 * TypeScript mirror of Rust FieldMappingRow.
 *
 * Source of truth: src-tauri/src/field_transform/mod.rs:135
 * Serde: #[serde(rename_all = "camelCase")] — keys arrive as camelCase from Tauri invoke.
 *
 * Phase 21 Mapping Editor consumes this; Phase 22 Copy Preview Override Panel reuses it.
 */
import type { FieldSchemaType } from '@/types/fieldSchema';
import type { TransformerKind } from './transformerOptions';

export interface FieldMappingRow {
  sourceFieldId: string;
  /** Empty string `""` is the dismissed-suggestion sentinel (CONTEXT.md D-07). */
  targetFieldId: string;
  /** One of the TransformerKind literals. */
  transformerKind: TransformerKind;
  sourceSchema: FieldSchemaType;
  targetSchema: FieldSchemaType;
}
