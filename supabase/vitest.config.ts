import { defineConfig } from 'vitest/config';

// Pure logic shared by the Edge Functions. Nothing here touches React Native,
// and nothing here may become a dependency of the app.
export default defineConfig({
  test: {
    include: ['functions/**/*.test.ts'],
    environment: 'node',
  },
});
