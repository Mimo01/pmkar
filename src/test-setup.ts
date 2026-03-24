import '@testing-library/jest-dom/vitest';
import './i18n/index';

// jsdom lacks WebCrypto — polyfill using globalThis.crypto (available in Node 19+/jsdom)
if (typeof (window as Window & typeof globalThis).crypto === 'undefined') {
  const { randomFillSync } = require('node:crypto') as {
    randomFillSync: (buf: ArrayBufferView) => ArrayBufferView;
  };
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (buf: ArrayBufferView) => randomFillSync(buf),
    },
  });
}
