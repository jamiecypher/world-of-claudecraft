// Pure, DOM-free ring buffer + stack-grouping logic for the dev audio panel's
// recent-plays log (see /dev sound). sfx.ts records an entry here on every
// one-shot that actually plays (playAt/playUi, post cooldown/voice-cap check,
// with its real resolved gain and the manifest's own variant id), never for
// loops/ambience/music, those live on separate code paths entirely. The panel
// reads and groups without touching sfx.ts internals.

export interface RecentPlay {
  key: string;
  variantId: string; // the manifest's own SfxVariant.id, e.g. "1", "2"
  timestamp: number; // ms, AudioContext.currentTime-based
  gain: number;
}

export const RECENT_PLAYS_MAX = 30;
export const STACK_WINDOW_MS = 100;

/** Prepends `entry` (newest first) and caps the log at `max` entries. */
export function recordRecentPlay(
  log: readonly RecentPlay[],
  entry: RecentPlay,
  max = RECENT_PLAYS_MAX,
): RecentPlay[] {
  const next = [entry, ...log];
  return next.length > max ? next.slice(0, max) : next;
}

/** Groups a newest-first log into stacks: consecutive entries whose
 *  timestamps land within `windowMs` of the previous entry in the same
 *  group. Lets the panel render "these fired together" (e.g. a crit's
 *  crit sound + weapon swing + hurt vocal) as one visual block instead of
 *  disconnected rows. */
export function groupRecentPlays(
  log: readonly RecentPlay[],
  windowMs = STACK_WINDOW_MS,
): RecentPlay[][] {
  const groups: RecentPlay[][] = [];
  for (const entry of log) {
    const current = groups.at(-1);
    const last = current?.at(-1);
    if (current && last && last.timestamp - entry.timestamp <= windowMs) {
      current.push(entry);
    } else {
      groups.push([entry]);
    }
  }
  return groups;
}

/** `mob_boar_idle` + variant id "2" -> `mob_boar_idle_2`. */
export function recentPlayLabel(entry: RecentPlay): string {
  return `${entry.key}_${entry.variantId}`;
}
