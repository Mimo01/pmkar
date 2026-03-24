import '@testing-library/jest-dom/vitest';
import './i18n/index';

// jsdom lacks WebCrypto — polyfill using globalThis.crypto (available in Node 19+/jsdom)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (window as any).crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomFillSync } = require('node:crypto') as {
    randomFillSync: (buf: ArrayBufferView) => ArrayBufferView;
  };
  Object.defineProperty(window, 'crypto', {
    value: {
      getRandomValues: (buf: ArrayBufferView) => randomFillSync(buf),
    },
  });
}
