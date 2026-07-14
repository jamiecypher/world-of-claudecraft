import { describe, expect, it } from 'vitest';
import {
  type RecentPlay,
  groupRecentPlays,
  recentPlayLabel,
  recordRecentPlay,
} from '../src/game/sfx_recent_plays';

function play(key: string, variantId: string, timestamp: number, gain = 1): RecentPlay {
  return { key, variantId, timestamp, gain };
}

describe('recordRecentPlay', () => {
  it('prepends newest-first', () => {
    let log: RecentPlay[] = [];
    log = recordRecentPlay(log, play('mob_boar_idle', '1', 0));
    log = recordRecentPlay(log, play('mob_boar_idle', '2', 100));
    expect(log.map((entry) => entry.variantId)).toEqual(['2', '1']);
  });

  it('caps the log at max entries, dropping the oldest', () => {
    let log: RecentPlay[] = [];
    for (let i = 0; i < 5; i++) log = recordRecentPlay(log, play('ui_click', '1', i), 3);
    expect(log).toHaveLength(3);
    expect(log.map((entry) => entry.timestamp)).toEqual([4, 3, 2]);
  });
});

describe('groupRecentPlays', () => {
  it('groups a crit stack (crit + swing + hurt landing together) into one block', () => {
    const log: RecentPlay[] = [
      play('mob_undead_hurt', '1', 1000),
      play('melee_swing_heavy', '1', 1005),
      play('combat_crit', '1', 1010),
      play('ui_click', '1', 500), // unrelated, well outside the window
    ];
    const groups = groupRecentPlays(log, 100);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(3);
    expect(groups[1]).toHaveLength(1);
  });

  it('keeps entries in separate groups once the gap exceeds the window', () => {
    const log: RecentPlay[] = [play('foot_grass', '1', 1000), play('foot_grass', '2', 500)];
    const groups = groupRecentPlays(log, 100);
    expect(groups).toHaveLength(2);
  });

  it('chains the window across a group instead of only comparing to the first entry', () => {
    // 1000 -> 910 (within 100 of 1000) -> 820 (within 100 of 910, but NOT of 1000):
    // still one group, since each entry only needs to be close to its neighbor.
    const log: RecentPlay[] = [
      play('a', '1', 1000),
      play('a', '1', 910),
      play('a', '1', 820),
    ];
    const groups = groupRecentPlays(log, 100);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('returns one group per entry when the log is empty or singleton', () => {
    expect(groupRecentPlays([])).toEqual([]);
    expect(groupRecentPlays([play('ui_click', '1', 0)])).toEqual([[play('ui_click', '1', 0)]]);
  });
});

describe('recentPlayLabel', () => {
  it('formats key and variant id together', () => {
    expect(recentPlayLabel(play('mob_boar_idle', '2', 0))).toBe('mob_boar_idle_2');
  });
});
