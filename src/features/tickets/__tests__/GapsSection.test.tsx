import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FieldSchema } from '@/types/fieldSchema';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'copy.preview.gapsHeader') return 'Required fields with no mapping';
      if (key === 'copy.preview.mapLink') return 'Map field';
      return key;
    },
  }),
}));

// Capture renderer props per fieldId so we can assert on them.
const capturedRendererProps: Record<string, any> = {};

vi.mock('@/features/field-renderers/registry', () => ({
  getRenderer: (schema: any) => {
    const RendererStub = (props: any) => {
      capturedRendererProps[props.field.fieldId] = props;
      const isUser = schema.type === 'user' || (schema.type === 'array' && schema.items === 'user');
      return (
        <input
          data-testid={`renderer-${props.field.fieldId}`}
          data-is-user={isUser ? 'true' : 'false'}
          value={typeof props.value === 'string' ? props.value : ''}
          onChange={(e) => props.onChange(e.target.value)}
        />
      );
    };
    return RendererStub;
  },
}));

import { GapsSection } from '../GapsSection';

const fSchema = (fieldId: string, name: string, type: 'string' | 'user'): FieldSchema => ({
  fieldId,
  name,
  required: true,
  schema: { type } as any,
});

describe('GapsSection', () => {
  it('renders nothing when gapFields is empty', () => {
    const { container } = render(
      <GapsSection
        gapFields={[]}
        overrideValues={{}}
        onOverrideChange={vi.fn()}
        onMapLink={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders amber header with title text when gaps exist', () => {
    render(
      <GapsSection
        gapFields={[fSchema('environment', 'Environment', 'string')]}
        overrideValues={{}}
        onOverrideChange={vi.fn()}
        onMapLink={vi.fn()}
      />,
    );
    expect(screen.getByText('Required fields with no mapping')).toBeInTheDocument();
    expect(screen.getByTestId('gaps-section')).toBeInTheDocument();
  });

  it('renders one row per gap with name + asterisk + Map link', () => {
    render(
      <GapsSection
        gapFields={[
          fSchema('environment', 'Environment', 'string'),
          fSchema('components', 'Components', 'string'),
        ]}
        overrideValues={{}}
        onOverrideChange={vi.fn()}
        onMapLink={vi.fn()}
      />,
    );
    expect(screen.getByTestId('gap-row-environment')).toBeInTheDocument();
    expect(screen.getByTestId('gap-row-components')).toBeInTheDocument();
    expect(screen.getByTestId('gap-map-link-environment')).toBeInTheDocument();
    expect(screen.getByTestId('gap-map-link-components')).toBeInTheDocument();
    // Asterisks rendered (one per row)
    expect(screen.getAllByText('*').length).toBeGreaterThanOrEqual(2);
  });

  it('renders the typed renderer for each gap field schema', () => {
    render(
      <GapsSection
        gapFields={[
          fSchema('environment', 'Environment', 'string'),
          fSchema('assignee', 'Assignee', 'user'),
        ]}
        overrideValues={{}}
        onOverrideChange={vi.fn()}
        onMapLink={vi.fn()}
      />,
    );
    expect(screen.getByTestId('renderer-environment')).toBeInTheDocument();
    expect(screen.getByTestId('renderer-assignee')).toBeInTheDocument();
  });

  it('wires renderer onChange to onOverrideChange(fieldId, value)', () => {
    const onOverrideChange = vi.fn();
    render(
      <GapsSection
        gapFields={[fSchema('environment', 'Environment', 'string')]}
        overrideValues={{}}
        onOverrideChange={onOverrideChange}
        onMapLink={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('renderer-environment'), {
      target: { value: 'prod' },
    });
    expect(onOverrideChange).toHaveBeenCalledWith('environment', 'prod');
  });

  it('clicking Map field invokes onMapLink', () => {
    const onMapLink = vi.fn();
    render(
      <GapsSection
        gapFields={[fSchema('environment', 'Environment', 'string')]}
        overrideValues={{}}
        onOverrideChange={vi.fn()}
        onMapLink={onMapLink}
      />,
    );
    fireEvent.click(screen.getByTestId('gap-map-link-environment'));
    expect(onMapLink).toHaveBeenCalledTimes(1);
  });

  it('passes onSearchUsers to user-type gap rows only', () => {
    const onSearchUsers = vi.fn();
    // Reset captures.
    for (const k of Object.keys(capturedRendererProps)) delete capturedRendererProps[k];
    render(
      <GapsSection
        gapFields={[
          fSchema('environment', 'Environment', 'string'),
          fSchema('assignee', 'Assignee', 'user'),
        ]}
        overrideValues={{}}
        onOverrideChange={vi.fn()}
        onMapLink={vi.fn()}
        onSearchUsers={onSearchUsers}
      />,
    );
    expect(capturedRendererProps['environment'].onSearch).toBeUndefined();
    expect(capturedRendererProps['assignee'].onSearch).toBe(onSearchUsers);
  });

  it('section has role=region with aria-label set to header text', () => {
    render(
      <GapsSection
        gapFields={[fSchema('environment', 'Environment', 'string')]}
        overrideValues={{}}
        onOverrideChange={vi.fn()}
        onMapLink={vi.fn()}
      />,
    );
    const region = screen.getByRole('region', {
      name: 'Required fields with no mapping',
    });
    expect(region).toBeInTheDocument();
  });

  it('reads existing overrideValues for renderer value prop', () => {
    render(
      <GapsSection
        gapFields={[fSchema('environment', 'Environment', 'string')]}
        overrideValues={{ environment: 'staging' }}
        onOverrideChange={vi.fn()}
        onMapLink={vi.fn()}
      />,
    );
    const input = screen.getByTestId('renderer-environment') as HTMLInputElement;
    expect(input.value).toBe('staging');
  });
});
