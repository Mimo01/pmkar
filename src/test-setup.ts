import '@testing-library/jest-dom/vitest';
import './i18n/index';

// jsdom lacks WebCrypto — polyfill using globalThis.crypto (available in Node 19+/jsdom)
// In TypeScript 6 we use globalThis.crypto directly (Node 19+ has it natively)
if (typeof (window as Window & typeof globalThis).crypto === 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: globalThis.crypto,
  });
}
