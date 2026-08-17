// A mount's own audio cues: its gait beat, takeoff, touchdown, and whatever it
// does at the top of a jump.
//
// Lives here rather than inline in the entity loop because it is mount
// behavior, not coordinator work, and renderer.ts is a named monolith under the
// line-count ratchet (root CLAUDE.md, Modularity).

/** Normalized phases within a mount's gait clip where a foot meets the ground.
 *
 *  MEASURED off the shipped rig by evaluating the skeleton through the Run clip
 *  and finding each foot bone's lowest point: the Valestrider plants at 0.190s
 *  and 0.600s of its 0.800s cycle.
 *
 *  Phases rather than seconds so they survive the clip being retimed, which
 *  this mount's cadence tuning does constantly (runRef has moved five times).
 *  A mount whose gait is a single beat would list one phase. */
export const MOUNT_GAIT_CONTACTS: readonly number[] = [0.2375, 0.75];

/**
 * Did the gait clip cross a foot contact between these two frames?
 *
 * Pinned to the ANIMATION rather than to distance travelled. The clip plays at
 * its own timeScale, so a distance accumulator drifts against it whenever that
 * rate and the ground speed disagree, and the footfalls end up landing between
 * the visible steps.
 *
 * `prev` below zero means there is no previous sample yet (a clip that just
 * started, or a mount that just became visible), which reports no crossing
 * rather than a spurious one on the first frame.
 */
export function gaitContactCrossed(
  prev: number,
  phase: number,
  contacts: readonly number[] = MOUNT_GAIT_CONTACTS,
): boolean {
  if (prev < 0) return false;
  for (const contact of contacts) {
    // The looping case matters: a clip wrapping from 0.9 back to 0.1 has passed
    // every contact above 0.9 AND below 0.1, and testing only `prev < c <=
    // phase` silently drops the contact nearest the seam once per cycle.
    const crossed =
      prev <= phase ? prev < contact && phase >= contact : prev < contact || phase >= contact;
    if (crossed) return true;
  }
  return false;
}

/** The airborne cue a mount owes this frame, or null. */
export type MountAirborneCue = 'jump' | 'land' | 'apex' | null;

/**
 * Which cue a mounted body's vertical motion calls for.
 *
 * `apexArmed` is caller-owned and latched at takeoff: the apex is the frame the
 * climb stops, and it can only be recognised once per jump, so the caller
 * clears it when this returns 'apex' or 'land'.
 */
export function mountAirborneCue(
  airborne: boolean,
  wasAirborne: boolean,
  apexArmed: boolean,
  verticalDelta: number,
): MountAirborneCue {
  if (airborne && !wasAirborne) return 'jump';
  if (!airborne && wasAirborne) return 'land';
  if (airborne && apexArmed && verticalDelta <= 0) return 'apex';
  return null;
}
