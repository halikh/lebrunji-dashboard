import { defineConfig } from 'vitest/config';

/**
 * Pure logic only.
 *
 * `src/lib/` holds what things mean, with no I/O — the same boundary the app
 * repo draws in `src/features/README.md`. Nothing here starts a browser or
 * touches Supabase, so the suite runs in under a second and there is no reason
 * not to run it.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
