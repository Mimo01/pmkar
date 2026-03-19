import { randomFillSync } from 'crypto';
import '@testing-library/jest-dom/vitest';

// jsdom lacks WebCrypto — required for @tauri-apps/api/mocks
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (buf: BufferSource) => randomFillSync(buf as NodeJS.ArrayBufferView),
  },
});
