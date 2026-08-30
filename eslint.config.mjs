import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Two rules of our own. Both are load-bearing conventions rather than style
 * preferences, and a convention nothing enforces is one that decays by screen
 * twenty.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),

  {
    rules: {
      /**
       * No literal text in JSX.
       *
       * The dashboard ships in English, and every string still goes through
       * `t()`. That is what makes adding a second language a file to fill
       * rather than a sweep through forty components — but only if it holds
       * everywhere, and it will not hold on discipline alone.
       *
       * `allowedStrings` covers punctuation that is layout rather than
       * language, and would be noise in a translation bundle.
       */
      'react/jsx-no-literals': [
        'warn',
        {
          noStrings: true,
          allowedStrings: ['—', '·', '/', ':', ',', '.', '+', '%'],
          ignoreProps: true,
        },
      ],

      /**
       * An underscore means deliberately unused.
       *
       * Needed for the destructure-to-drop pattern: pulling `maxAge` and
       * `expires` off an options object precisely so they are not carried
       * forward is the clearest way to write it, and the linter should not
       * argue with it.
       */
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]);

export default eslintConfig;
