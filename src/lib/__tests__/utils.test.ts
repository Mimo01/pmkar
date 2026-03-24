import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('cn (class name utility)', () => {
  it('returns a single class name unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('merges multiple class names with a space', () => {
    const result = cn('foo', 'bar');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });

  it('ignores undefined and null values', () => {
    const result = cn('foo', undefined, null, 'bar');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('null');
  });

  it('ignores false values', () => {
    const result = cn('foo', false, 'bar');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });

  it('handles conditional class (truthy)', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toContain('active');
  });

  it('handles conditional class (falsy)', () => {
    const isActive = false;
    const result = cn('base', isActive && 'active');
    expect(result).not.toContain('active');
    expect(result).toContain('base');
  });

  it('deduplicates conflicting Tailwind classes (tailwind-merge)', () => {
    // tailwind-merge resolves conflicts: later class wins
    const result = cn('p-4', 'p-2');
    expect(result).toBe('p-2');
  });

  it('merges Tailwind responsive modifiers correctly', () => {
    const result = cn('text-sm', 'md:text-lg');
    expect(result).toContain('text-sm');
    expect(result).toContain('md:text-lg');
  });

  it('handles empty string input', () => {
    const result = cn('');
    expect(result).toBe('');
  });

  it('handles no arguments', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('handles object class notation', () => {
    const result = cn({ active: true, disabled: false, 'text-bold': true });
    expect(result).toContain('active');
    expect(result).not.toContain('disabled');
    expect(result).toContain('text-bold');
  });

  it('handles array of classes', () => {
    const result = cn(['foo', 'bar']);
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });
});
