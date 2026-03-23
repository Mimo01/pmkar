import { randomFillSync } from 'crypto';
import '@testing-library/jest-dom/vitest';
import './i18n/index';

// jsdom lacks WebCrypto — required for @tauri-apps/api/mocks
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (buf: BufferSource) => randomFillSync(buf as NodeJS.ArrayBufferView),
  },
});
