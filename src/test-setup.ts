import '@testing-library/jest-dom/vitest';
import './i18n/index';

// jsdom lacks WebCrypto — polyfill using globalThis.crypto (available in Node 19+/jsdom)
// In TypeScript 6 we use globalThis.crypto directly (Node 19+ has it natively)
if (typeof (window as Window & typeof globalThis).crypto === 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: globalThis.crypto,
  });
}

// Needed so Radix DropdownMenu and ContextMenu work under jsdom. Guarded so per-file mocks still win.
if (typeof Element.prototype.hasPointerCapture !== 'function') {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture !== 'function') {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture !== 'function') {
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}
