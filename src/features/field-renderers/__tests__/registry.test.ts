import { describe, expect, it } from 'vitest';

import { getRenderer } from '../registry';
import { CheckboxRenderer } from '../renderers/CheckboxRenderer';
import { ComponentPickerRenderer } from '../renderers/ComponentPickerRenderer';
import { DateRenderer } from '../renderers/DateRenderer';
import { DateTimeRenderer } from '../renderers/DateTimeRenderer';
import { GroupPickerRenderer } from '../renderers/GroupPickerRenderer';
import { LabelsRenderer } from '../renderers/LabelsRenderer';
import { MultiSelectRenderer } from '../renderers/MultiSelectRenderer';
import { MultiUserPickerRenderer } from '../renderers/MultiUserPickerRenderer';
import { NumberRenderer } from '../renderers/NumberRenderer';
import { RadioRenderer } from '../renderers/RadioRenderer';
import { SingleSelectRenderer } from '../renderers/SingleSelectRenderer';
import { StringRenderer } from '../renderers/StringRenderer';
import { TextAreaRenderer } from '../renderers/TextAreaRenderer';
import { PriorityRenderer } from '../renderers/PriorityRenderer';
import { UnsupportedTypeRenderer } from '../renderers/UnsupportedTypeRenderer';
import { UrlRenderer } from '../renderers/UrlRenderer';
import { UserPickerRenderer } from '../renderers/UserPickerRenderer';
import { VersionPickerRenderer } from '../renderers/VersionPickerRenderer';

// CheckboxRenderer + RadioRenderer ARE routed via getRenderer for known Jira custom field IDs
// (multicheckboxes / radiobuttons). Imported here so the registry test can assert .toBe() identity.

describe('getRenderer registry', () => {
  it('CTRL-01 returns StringRenderer for type=string with no system', () => {
    expect(getRenderer({ type: 'string' })).toBe(StringRenderer);
  });

  it('CTRL-01 returns TextAreaRenderer for type=string with system=description', () => {
    expect(getRenderer({ type: 'string', system: 'description' })).toBe(TextAreaRenderer);
  });

  it('CTRL-01 returns UrlRenderer for type=string with system=url', () => {
    expect(getRenderer({ type: 'string', system: 'url' })).toBe(UrlRenderer);
  });

  it('CTRL-05 returns NumberRenderer for type=number', () => {
    expect(getRenderer({ type: 'number' })).toBe(NumberRenderer);
  });

  it('CTRL-05 returns DateRenderer for type=date', () => {
    expect(getRenderer({ type: 'date' })).toBe(DateRenderer);
  });

  it('CTRL-05 returns DateTimeRenderer for type=datetime', () => {
    expect(getRenderer({ type: 'datetime' })).toBe(DateTimeRenderer);
  });

  it('CTRL-02 returns UserPickerRenderer for type=user', () => {
    expect(getRenderer({ type: 'user' })).toBe(UserPickerRenderer);
  });

  it('CTRL-03 returns SingleSelectRenderer for type=option', () => {
    expect(getRenderer({ type: 'option' })).toBe(SingleSelectRenderer);
  });

  it('CTRL-02 returns MultiUserPickerRenderer for type=array items=user', () => {
    expect(getRenderer({ type: 'array', items: 'user' })).toBe(MultiUserPickerRenderer);
  });

  it('CTRL-03 returns MultiSelectRenderer for type=array items=option', () => {
    expect(getRenderer({ type: 'array', items: 'option' })).toBe(MultiSelectRenderer);
  });

  it('CTRL-04 returns ComponentPickerRenderer for type=array items=component', () => {
    expect(getRenderer({ type: 'array', items: 'component' })).toBe(ComponentPickerRenderer);
  });

  it('CTRL-04 returns VersionPickerRenderer for type=array items=version', () => {
    expect(getRenderer({ type: 'array', items: 'version' })).toBe(VersionPickerRenderer);
  });

  it('CTRL-03 returns LabelsRenderer for type=array items=string', () => {
    expect(getRenderer({ type: 'array', items: 'string' })).toBe(LabelsRenderer);
  });

  it('CTRL-02 returns GroupPickerRenderer for type=array items=group', () => {
    expect(getRenderer({ type: 'array', items: 'group' })).toBe(GroupPickerRenderer);
  });

  it('CTRL-07 returns UnsupportedTypeRenderer for type=any', () => {
    expect(getRenderer({ type: 'any' })).toBe(UnsupportedTypeRenderer);
  });

  it('CTRL-07 returns UnsupportedTypeRenderer for type=issuetype', () => {
    expect(getRenderer({ type: 'issuetype' })).toBe(UnsupportedTypeRenderer);
  });

  it('CTRL-07 returns PriorityRenderer for type=priority', () => {
    expect(getRenderer({ type: 'priority' })).toBe(PriorityRenderer);
  });

  it('CTRL-07 returns UnsupportedTypeRenderer for type=option-with-child', () => {
    expect(getRenderer({ type: 'option-with-child' })).toBe(UnsupportedTypeRenderer);
  });

  it('CTRL-07 returns UnsupportedTypeRenderer for unknown array items kind', () => {
    // @ts-expect-error — intentionally invalid items value to exercise default branch
    expect(getRenderer({ type: 'array', items: 'never-heard-of-this' })).toBe(UnsupportedTypeRenderer);
  });

  // CTRL-06 — checkbox/radio routing via schema.custom (planner Option A; revision iteration 1 of Phase 20 plan)
  it('CTRL-06 returns RadioRenderer for type=option with custom=radiobuttons', () => {
    expect(
      getRenderer({
        type: 'option',
        custom: 'com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons',
      }),
    ).toBe(RadioRenderer);
  });

  it('CTRL-06 returns CheckboxRenderer for type=array items=option with custom=multicheckboxes', () => {
    expect(
      getRenderer({
        type: 'array',
        items: 'option',
        custom: 'com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes',
      }),
    ).toBe(CheckboxRenderer);
  });

  it('CTRL-06 falls back to SingleSelectRenderer for option with no custom marker', () => {
    expect(getRenderer({ type: 'option' })).toBe(SingleSelectRenderer);
  });

  it('CTRL-06 falls back to SingleSelectRenderer for option with unrelated custom marker', () => {
    expect(
      getRenderer({
        type: 'option',
        custom: 'com.atlassian.jira.plugin.system.customfieldtypes:select',
      }),
    ).toBe(SingleSelectRenderer);
  });

  it('CTRL-06 falls back to MultiSelectRenderer for array items=option with no custom marker', () => {
    expect(getRenderer({ type: 'array', items: 'option' })).toBe(MultiSelectRenderer);
  });
});
