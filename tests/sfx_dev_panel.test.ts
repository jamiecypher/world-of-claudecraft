import { describe, expect, it } from 'vitest';
import { isSfxDevPanelCommand } from '../src/game/sfx_dev_panel';

describe('isSfxDevPanelCommand', () => {
  it('matches "/dev sound" bare', () => {
    expect(isSfxDevPanelCommand('/dev sound')).toBe(true);
  });

  it('matches with trailing whitespace and is case-insensitive', () => {
    expect(isSfxDevPanelCommand('  /DEV Sound  ')).toBe(true);
  });

  it('does not match other /dev commands', () => {
    expect(isSfxDevPanelCommand('/dev tp 10 20')).toBe(false);
    expect(isSfxDevPanelCommand('/dev level 30')).toBe(false);
  });

  it('does not match plain chat text or a partial prefix', () => {
    expect(isSfxDevPanelCommand('hello world')).toBe(false);
    expect(isSfxDevPanelCommand('/devsound')).toBe(false);
    expect(isSfxDevPanelCommand('/sound')).toBe(false);
  });
});
