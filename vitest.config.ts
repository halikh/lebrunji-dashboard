import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Pure logic only.
 *
 * `src/lib/` and the `api/` modules hold what things mean; nothing here starts
 * a browser or reaches Supabase, so the suite runs in under a second and there
 * is no reason not to run it.
 *
 * The alias mirrors `tsconfig.json`. Without it a test that imports anything
 * reaching a `@/`-qualified module fails to resolve — and it fails at the
 * import, so the whole file is skipped rather than one assertion failing, which
 * is a much quieter way to lose coverage.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
