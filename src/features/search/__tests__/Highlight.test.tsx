import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Highlight } from '../Highlight';

describe('Highlight', () => {
  it('marks accented original text for folded query', () => {
    const { container } = render(<Highlight text="Chyba prihlásenia" words={['prihlasenia']} />);
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('prihlásenia');
    expect(container.textContent).toBe('Chyba prihlásenia');
  });

  it('renders no mark without words', () => {
    const { container } = render(<Highlight text="Hello" words={[]} />);
    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Hello');
  });

  it('renders HTML as literal text', () => {
    const { container } = render(<Highlight text="<img src=x onerror=alert(1)>" words={['src']} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('produces two marks for two matches', () => {
    const { container } = render(<Highlight text="foo bar foo" words={['foo']} />);
    expect(container.querySelectorAll('mark')).toHaveLength(2);
  });
});
