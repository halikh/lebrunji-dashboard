#!/usr/bin/env node
/**
 * Commit, push, or both — and choose which Railway environment the push goes to.
 *
 *   npm run ship                          asks for everything
 *   npm run ship -- staging               push to staging (still asks to commit)
 *   npm run ship -- staging -m "message"  commit with that message, push to staging
 *   npm run ship -- none -m "message"     commit only
 *
 * ## How a push picks an environment
 *
 * Each Railway environment deploys the dashboard from one GitHub branch
 * (service → Settings → Source → Branch), and redeploys whenever that branch
 * moves:
 *
 *   development → `development`
 *   staging     → `staging`
 *   production  → `main`
 *
 * So "deploy to staging" is `git push origin HEAD:staging` — the commit you are
 * on, sent to staging's branch, without switching branches locally. The same
 * commit can then go to production unchanged, which is the point: what reaches
 * customers is exactly what was tried on staging.
 *
 * ## What it refuses
 *
 * - A push when `npm run verify` fails. A broken build on Railway is a broken
 *   dashboard for whoever has it open.
 * - A push to production without typing `production` — the one place a stray
 *   Enter costs something.
 * - A force push, ever. If an environment's branch has commits this one does
 *   not, git refuses and says so; pull them in rather than overwrite them.
 *
 * Railway's variables are set per environment in Railway, not by this script —
 * see README. Nothing here reads or sends an env file.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const ENVIRONMENTS = {
  development: 'development',
  staging: 'staging',
  production: 'main',
};
const ALIASES = { dev: 'development', prod: 'production', none: 'none' };

const args = process.argv.slice(2);
const messageAt = args.findIndex((a) => a === '-m' || a === '--message');
let message = messageAt >= 0 ? args[messageAt + 1] : undefined;
const positional = args.filter((_, i) => i !== messageAt && i !== messageAt + 1);
let choice = positional[0] ? (ALIASES[positional[0]] ?? positional[0]) : undefined;

if (choice && choice !== 'none' && !(choice in ENVIRONMENTS)) {
  fail(`Unknown environment "${positional[0]}". Use development, staging, production or none.`);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

try {
  await commitStep();
  await pushStep();
} finally {
  rl.close();
}

async function commitStep() {
  const changes = git(['status', '--short']).trim();
  if (!changes) {
    console.log('Nothing to commit.');
    return;
  }

  console.log(`\nChanges:\n${changes}\n`);
  if (message === undefined) {
    message = (await rl.question('Commit message (leave empty to skip committing): ')).trim();
  }
  if (!message) {
    console.log('Not committing. Only commits already made will be pushed.\n');
    return;
  }

  run('git', ['add', '-A']);
  run('git', ['commit', '-m', message]);
}

async function pushStep() {
  if (!choice) {
    console.log('\nPush to which environment?');
    console.log('  1) development');
    console.log('  2) staging');
    console.log('  3) production');
    console.log('  0) none — do not push');
    const answer = (await rl.question('> ')).trim();
    choice =
      { 1: 'development', 2: 'staging', 3: 'production', 0: 'none' }[answer] ??
      ALIASES[answer] ??
      answer;
  }

  if (choice === 'none' || choice === '') {
    console.log('Not pushing.');
    return;
  }
  if (!(choice in ENVIRONMENTS)) fail(`Unknown environment "${choice}".`);

  const branch = ENVIRONMENTS[choice];
  const head = git(['log', '-1', '--format=%h %s']).trim();

  if (choice === 'production') {
    console.log(
      `\n  !  This deploys to PRODUCTION — the dashboard the business runs on.` +
        `\n  !  Commit: ${head}\n`,
    );
    const typed = (await rl.question('Type "production" to continue: ')).trim();
    if (typed !== 'production') fail('Not pushed.');
  }

  console.log('\nRunning npm run verify before pushing…');
  const verify = spawnSync('npm', ['run', 'verify'], { stdio: 'inherit', shell: true });
  if (verify.status !== 0) fail('verify failed — not pushed.');

  console.log(`\nPushing ${head} → ${branch} (${choice})`);
  run('git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);
  console.log(`\nPushed. Railway's ${choice} environment deploys it from \`${branch}\`.`);
}

/** A git command's output, failing the script if git does. */
function git(gitArgs) {
  const result = spawnSync('git', gitArgs, { encoding: 'utf8' });
  if (result.status !== 0) fail(result.stderr.trim() || `git ${gitArgs.join(' ')} failed.`);
  return result.stdout;
}

/** A command with its output shown, failing the script if it fails. */
function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.status !== 0) fail(`${command} ${commandArgs.join(' ')} failed.`);
}

function fail(text) {
  console.error(text);
  process.exit(1);
}
