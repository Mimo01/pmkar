import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test-setup.ts',
        'src/test-utils/**',
        'src/main.tsx',
        '**/*.test.{ts,tsx}',
        '**/__tests__/**',
        '**/types.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 65,
        statements: 79,
      },
      reporter: ['text', 'lcov'],
    },
  },
});
