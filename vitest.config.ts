import { defineConfig } from 'vitest/config';

// Unit tests only — pure logic that the Edge Functions and the app share.
// React Native screens are covered by the type-check and TestFlight, not here.
export default defineConfig({
  test: {
    include: ['supabase/functions/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
