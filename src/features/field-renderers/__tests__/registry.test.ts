import { describe, it } from 'vitest';

describe('getRenderer registry', () => {
  it.todo('CTRL-07 returns UnsupportedTypeRenderer for type=any');
  it.todo('CTRL-07 returns UnsupportedTypeRenderer for type=issuetype');
  it.todo('CTRL-07 returns UnsupportedTypeRenderer for type=priority');
  it.todo('CTRL-07 returns UnsupportedTypeRenderer for type=option-with-child');
  it.todo('CTRL-07 returns UnsupportedTypeRenderer for unknown array items kind');
  it.todo('CTRL-01 returns TextAreaRenderer for type=string with system=description');
  it.todo('CTRL-01 returns UrlRenderer for type=string with system=url');
  it.todo('CTRL-01 returns StringRenderer for type=string with no system');
  it.todo('CTRL-02 returns UserPickerRenderer for type=user');
  it.todo('CTRL-02 returns MultiUserPickerRenderer for type=array items=user');
  it.todo('CTRL-02 returns GroupPickerRenderer for type=array items=group');
  it.todo('CTRL-03 returns SingleSelectRenderer for type=option');
  it.todo('CTRL-03 returns MultiSelectRenderer for type=array items=option');
  it.todo('CTRL-03 returns LabelsRenderer for type=array items=string');
  it.todo('CTRL-04 returns ComponentPickerRenderer for type=array items=component');
  it.todo('CTRL-04 returns VersionPickerRenderer for type=array items=version');
  it.todo('CTRL-05 returns DateRenderer for type=date');
  it.todo('CTRL-05 returns DateTimeRenderer for type=datetime');
  it.todo('CTRL-05 returns NumberRenderer for type=number');
});
