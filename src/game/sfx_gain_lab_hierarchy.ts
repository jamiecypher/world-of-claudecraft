// Pure key-splitting logic for the /dev mix gain-lab panel (throwaway local
// tool, never submitted upstream, see project_woc_gain_lab_panel memory).
// Splits any catalog key into (family, action) for two-tier scoping: family
// alone, or family+action. There is no per-take (variant) granularity here on
// purpose, the real sfx_gain_map.json/sfx_speed_map.json are keyed by the
// FULL catalog key, never by numbered variant.

import gainCeilings from '../../scripts/sfx/sfx_gain_ceiling.generated.json';

const MOB_KEY_PATTERN = /^mob_(.+)_(aggro|attack|death|hurt|idle)$/;
const CEILINGS: Record<string, number> = gainCeilings;
// Every non-custom key in production is still hard-clamped to this flat
// ceiling by playback_profile.mjs's resolvedGainDb; see sfx_gain_ceiling.mjs
// for the rationale on why a custom key may go higher.
const FLAT_CEILING_DB = 0;

export interface SfxKeyHierarchy {
  family: string;
  action: string | null;
}

/** Splits a catalog key into its family/action tiers. Mob keys (fixed AND
 *  subfamily-extension alike, e.g. `mob_beast_wolf_attack`) fold everything
 *  before the trailing action into the family. Non-mob keys have no action
 *  tier; the whole key is the family. */
export function splitSfxKey(key: string): SfxKeyHierarchy {
  const match = MOB_KEY_PATTERN.exec(key);
  if (match) return { family: `mob_${match[1]}`, action: match[2] };
  return { family: key, action: null };
}

/** Every key in `keys` whose hierarchy matches the given family (and action,
 *  if provided). Used to resolve a write-scope selection back to concrete
 *  catalog keys. */
export function keysInScope(keys: readonly string[], family: string, action: string | null): string[] {
  return keys.filter((key) => {
    const hierarchy = splitSfxKey(key);
    if (hierarchy.family !== family) return false;
    if (action !== null && hierarchy.action !== action) return false;
    return true;
  });
}

/** Distinct families present across `keys`, sorted. */
export function familiesIn(keys: readonly string[]): string[] {
  return [...new Set(keys.map((key) => splitSfxKey(key).family))].sort();
}

/** Distinct actions present for one family within `keys`, sorted. Empty for a
 *  non-mob family (no action tier). */
export function actionsForFamily(keys: readonly string[], family: string): string[] {
  const actions = new Set<string>();
  for (const key of keys) {
    const hierarchy = splitSfxKey(key);
    if (hierarchy.family === family && hierarchy.action) actions.add(hierarchy.action);
  }
  return [...actions].sort();
}

/** Converts a dB delta to a linear gain multiplier (20 * log10 convention). */
export function dbToLinearGain(db: number): number {
  return 10 ** (db / 20);
}

/** The real production ceiling for a single key: its computed custom headroom
 *  ceiling if it has one (sfx_gain_ceiling.mjs), else the flat 0dB every
 *  other key is clamped to by playback_profile.mjs's resolvedGainDb. */
export function ceilingForKey(key: string): number {
  return CEILINGS[key] ?? FLAT_CEILING_DB;
}

/** The binding ceiling for a scope (family, or family+action): the TIGHTEST
 *  ceiling across every key the scope resolves to, since one keyTrimDb value
 *  applies uniformly to every key in scope and production would clamp at the
 *  strictest one. Undefined if the scope resolves to no keys. */
export function ceilingForScope(keys: readonly string[]): number | undefined {
  if (keys.length === 0) return undefined;
  return Math.min(...keys.map(ceilingForKey));
}

/** The key within a scope whose OWN ceiling is the scope's binding
 *  constraint (the tightest one). A scope's preview must play THIS key, not
 *  an arbitrary one: every key in a family is already individually pinned to
 *  its own ceiling in the live gain map, so previewing any other key plays a
 *  louder-than-representative baseline and makes the scope's true (tightest)
 *  headroom look bigger than it really is. */
export function tightestKeyInScope(keys: readonly string[]): string | undefined {
  if (keys.length === 0) return undefined;
  return keys.reduce((tightest, key) =>
    ceilingForKey(key) < ceilingForKey(tightest) ? key : tightest,
  );
}
