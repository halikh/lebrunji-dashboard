import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Three rules of our own. All are load-bearing conventions rather than style
 * preferences, and a convention nothing enforces is one that decays by screen
 * twenty.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),

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
      /**
       * No screen reads the machine's clock.
       *
       * The business is in Lebanon and the day boundary that matters is
       * Beirut's midnight, for everyone looking at the dashboard, from
       * anywhere. `Intl` reports whatever the computer is set to, and the
       * computer is wrong more often than anyone expects: a laptop that
       * travelled, a VM left on UTC, a phone on a roaming network. Each shows a
       * different idea of which orders are "today", and none of them is the
       * shop's.
       *
       * This is exactly the class of bug that cannot be caught by looking: the
       * date renders, it is plausible, and it is a day out for whoever is not
       * sitting in Beirut. So it is a lint error rather than a paragraph in a
       * plan.
       *
       * `src/lib/time.ts` is the exemption, because it is where the zone is
       * named. The two pickers are exempted below for a different reason — see
       * their own files: the `Date` they work in is a carrier for six numbers
       * and never a moment, so reading it back with `getHours` is correct
       * there and only there.
       */
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name=/^(toLocaleDateString|toLocaleTimeString|toDateString|toTimeString|toUTCString)$/]",
          message:
            "Renders in the machine's timezone. Use formatDate/formatTime/formatDateTime from @/lib/time, which pin Asia/Beirut.",
        },
        {
          selector:
            "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']",
          message:
            "Build date formatters in @/lib/time, where `timeZone: BUSINESS_TIMEZONE` is set once.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(getHours|getMinutes|getDate|getMonth|getFullYear|getDay)$/]",
          message:
            "Reads the machine's timezone. Use toWallClock from @/lib/time, or the date pickers, which convert deliberately.",
        },
      ],

      "react/jsx-no-literals": [
        "warn",
        {
          noStrings: true,
          allowedStrings: ["—", "·", "/", ":", ",", ".", "+", "%"],
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
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  /**
   * The three files that may read a `Date` directly.
   *
   * `lib/time.ts` is where the zone is named — exempting it is the point of
   * having one place. The two pickers work in a `Date` that is a **carrier for
   * six numbers, never a moment**: `TimeField` holds a wall clock with no date
   * and no zone (`store_hours.opens_at` is text, and nine in the morning is
   * nine in the morning), and `DateField` reads back the numbers the operator
   * typed before `fromWallClock` turns them into an instant. Reading those with
   * `getHours` is correct there, and wrong everywhere else.
   */
  {
    files: [
      "src/lib/time.ts",
      "src/components/ui/date-field.tsx",
      "src/components/ui/time-field.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
]);

export default eslintConfig;
