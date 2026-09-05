/**
 * Proves `src/lib/limits.ts` still describes the database.
 *
 * ## Why this exists
 *
 * `limits.ts` and migration 0066 hold the same numbers, and that is two sources
 * of truth. Normally that is a mistake. It is tolerable here for a specific
 * reason — a CHECK constraint cannot produce a sentence a person can act on,
 * and a form should not have to round-trip to find out that a name is too long
 * — and it is only tolerable *because of this script*.
 *
 * Without it, the two would drift within a month, and the drift would be
 * invisible in the worst direction: a form confidently accepting something the
 * database then refuses, with the failure landing on the operator.
 *
 * ## What it does
 *
 * Reads the constraint definitions back out of `pg_constraint` on the linked
 * database, pulls the number out of each, and compares. It asserts nothing
 * about *how* the constraint is written, only about the limit it enforces — so
 * rewording a constraint is free and changing a bound is not.
 *
 *     SUPABASE_DB_URL=postgres://... npm run check:limits
 *
 * Read-only. It opens a connection, runs one query, and closes.
 */

import postgres from 'postgres';

import { TEXT } from '../src/lib/limits';
import { loadLocalEnv } from './load-env';

/**
 * Constraint name → the limit `limits.ts` says it should carry.
 *
 * Only the length rules are here. The others (a price being non-negative, a
 * percentage capped at 100) carry no number that could drift — they are
 * either present or absent, and `verify.sql`'s ADM-10 already checks that.
 */
const EXPECTED: Record<string, number> = {
  stores_name_len: TEXT.name,
  categories_name_len: TEXT.name,
  category_kinds_name_len: TEXT.name,
  menu_sections_title_len: TEXT.title,
  menu_items_name_len: TEXT.name,
  menu_items_description_len: TEXT.description,
  option_groups_title_len: TEXT.title,
  item_options_name_len: TEXT.name,
  menu_item_tags_name_len: TEXT.tag,
  order_statuses_name_len: TEXT.statusName,
  order_statuses_timeline_title_len: TEXT.statusTimelineTitle,
  order_statuses_timeline_detail_len: TEXT.statusTimelineDetail,
  payment_methods_name_len: TEXT.paymentMethodName,
  payment_methods_detail_len: TEXT.paymentMethodDetail,
  help_topics_group_name_len: TEXT.helpGroupName,
  help_topics_question_len: TEXT.helpQuestion,
  help_topics_answer_len: TEXT.helpAnswer,
  policy_sections_title_len: TEXT.policyTitle,
  policy_sections_body_len: TEXT.policyBody,
  address_kinds_name_len: TEXT.addressKindName,
  languages_name_len: TEXT.languageName,
  countries_name_len: TEXT.countryName,
  users_name_len: TEXT.customerName,
  orders_courier_note_len: TEXT.note,
  order_lines_note_len: TEXT.note,
  cart_lines_note_len: TEXT.note,
};

/**
 * The slug constraints all carry the same length, and there are thirteen of
 * them, so they are generated rather than listed.
 */
const SLUG_TABLES = [
  'stores',
  'categories',
  'category_kinds',
  'menu_sections',
  'menu_items',
  'option_groups',
  'item_options',
  'menu_item_tags',
  'discounts',
  'order_statuses',
  'payment_methods',
  'help_topics',
  'policy_sections',
  'address_kinds',
];

for (const table of SLUG_TABLES) {
  EXPECTED[`${table}_slug_shape`] = TEXT.slug;
}

/**
 * The last integer in the constraint body.
 *
 * Both shapes end with it — `jsonb_text_within(name, 80)` and
 * `char_length(slug) <= 64` — and neither has another number after it. Deliberately
 * loose about everything else, so rewording a constraint does not fail this.
 */
function boundOf(definition: string): number | null {
  const numbers = definition.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;
  return Number(numbers[numbers.length - 1]);
}

async function main() {
  loadLocalEnv();

  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error(
      'SUPABASE_DB_URL is not set — not in the environment, and not in .env.local.\n\n' +
        'This reads the constraints back out of the linked database, so it needs a\n' +
        'connection string. Supabase dashboard → Project Settings → Database →\n' +
        'Connection string. Use the pooler URL; this opens one connection and closes it.',
    );
    process.exit(2);
  }

  const sql = postgres(url, { max: 1, prepare: false });
  const problems: string[] = [];

  try {
    const rows = await sql<{ conname: string; def: string }[]>`
      select con.conname::text as conname,
             pg_get_constraintdef(con.oid) as def
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       where con.contype = 'c'
    `;

    const found = new Map(rows.map((r) => [r.conname, r.def]));

    for (const [name, expected] of Object.entries(EXPECTED)) {
      const def = found.get(name);
      if (def === undefined) {
        problems.push(`${name}: missing from the database — has 0066 been applied?`);
        continue;
      }
      const actual = boundOf(def);
      if (actual === null) {
        problems.push(`${name}: could not read a bound out of "${def}"`);
        continue;
      }
      if (actual !== expected) {
        problems.push(`${name}: database says ${actual}, limits.ts says ${expected}`);
      }
    }
  } finally {
    await sql.end();
  }

  if (problems.length > 0) {
    console.error(`limits.ts and the database disagree on ${problems.length}:\n`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      '\nFix whichever is wrong. If the database is right, edit src/lib/limits.ts.\n' +
        'If limits.ts is right, that is a migration — do not edit an applied one.',
    );
    process.exit(1);
  }

  console.log(`limits.ts agrees with the database on all ${Object.keys(EXPECTED).length} bounds.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
