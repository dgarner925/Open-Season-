import { fileURLToPath } from 'node:url';
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
    //
    // fileURLToPath, not URL.pathname: on Windows pathname keeps the leading
    // slash AND leaves the path percent-encoded, so a repo checked out under
    // a folder with a space in it ("GirHub Claude") resolved to a %20 path
    // that does not exist. Nothing caught it because until the season card
    // no logic module under test had a runtime '@/' import — the type-only
    // ones are erased before vitest ever sees them.
    alias: { '@': fileURLToPath(new URL('../src/', import.meta.url)) },
  },
});
