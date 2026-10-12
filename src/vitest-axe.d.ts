import 'vitest';

declare module 'vitest' {
  // biome-ignore lint/suspicious/noExplicitAny: matches vitest's Assertion<T = any> declaration
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}
