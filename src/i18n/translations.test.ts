import { describe, expect, it } from 'vitest';

import { t } from './translations';

/**
 * `t()` is the seam a second language goes through, so its edge cases are worth
 * pinning now rather than discovering while translating.
 */
describe('t', () => {
  it('reads a nested key', () => {
    expect(t('login.submit')).toBe('Sign in');
  });

  it('returns the key when it is missing', () => {
    // Not an empty string. A screen showing `orders.advnace` is obviously
    // broken; a screen showing nothing is a bug someone has to hunt for.
    expect(t('login.nope' as never)).toBe('login.nope');
    expect(t('nothing' as never)).toBe('nothing');
  });

  it('returns the key when it lands on an object rather than a string', () => {
    expect(t('login' as never)).toBe('login');
  });

  it('substitutes a placeholder', () => {
    expect(t('shell.notBuiltBody', { phase: 4 })).toContain('phase 4');
  });

  it('leaves an unmatched placeholder visible', () => {
    // A missing parameter should show up on screen as `{phase}` rather than as
    // a blank that reads like a finished sentence and nobody notices.
    expect(t('shell.notBuiltBody')).toContain('{phase}');
    expect(t('shell.notBuiltBody', { other: 1 })).toContain('{phase}');
  });

  it('takes numbers as well as strings', () => {
    expect(t('shell.notBuiltBody', { phase: '4' })).toBe(t('shell.notBuiltBody', { phase: 4 }));
  });

  it('does not touch a string with no placeholders', () => {
    expect(t('common.save', { phase: 4 })).toBe('Save');
  });
});
