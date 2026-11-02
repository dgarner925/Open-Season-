import { defineConfig } from 'vitest/config';

// Pure logic: the Edge Functions' shared code, and the app's own logic modules
// that import nothing from React Native (src/features/*/*.test.ts). Nothing
// here touches React Native, and nothing here may become a dependency of the
// app — vitest stays in THIS package's devDependencies, never the app's, which
// is the whole reason this second package exists.
export default defineConfig({
  test: {
    include: ['functions/**/*.test.ts', '../src/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    // The app's own '@/…' paths, so a logic module under test can import a
    // sibling without the test knowing where the repo root is.
    alias: { '@': new URL('../src/', import.meta.url).pathname },
  },
});
