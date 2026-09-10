// Movement audio for the resolved mount look. The caller owns audibility,
// death and swimming; this module preserves the vehicle ground/air policy.
export const FOOT_RUN_SPEED = 4.5;

import type { SpatialAudioSink, Surface } from './audio_sink';
import { strideHit } from './stride_audio_core';

const MOUNT_STRIDE_RUN = 5.8;
type MountAudio = Pick<
  SpatialAudioSink,
  'mountIdle' | 'mountEngine' | 'mountEngineIdles' | 'mountRun' | 'mountApex'
>;

/** The airborne bookkeeping this pass owns: whether the mount was off the
 *  ground last frame, and whether this jump's apex is still to come. Kept here
 *  rather than in the caller because nothing else reads them. */
export interface MountAirborneState {
  mountAirborne?: boolean;
  mountApexArmed?: boolean;
}
export function updateRiddenMountAudio(
  sink: MountAudio,
  state: { stepAccum: number; mountPivot: boolean } & MountAirborneState,
  look: string,
  id: number,
  x: number,
  y: number,
  z: number,
  moving: boolean,
  airborne: boolean,
  backwards: boolean,
  speed: number,
  dt: number,
  self: boolean,
  surfaceAt: (x: number, z: number, y: number) => Surface,
  /** Raw vertical delta this frame; the sign is what dates the apex. */
  verticalDelta = 0,
): void {
  // The top of a jump, once per jump. Armed on the takeoff edge and spent the
  // first frame the climb stops, so a mount with a voice calls out at the peak
  // rather than on the way up. A mount with no takes is silent and pays only
  // these two booleans.
  if (airborne && !state.mountAirborne) state.mountApexArmed = true;
  if (airborne && state.mountApexArmed && verticalDelta <= 0) {
    state.mountApexArmed = false;
    sink.mountApex(x, y, z, look);
  }
  if (!airborne) state.mountApexArmed = false;
  state.mountAirborne = airborne;
  if (airborne) {
    sink.mountIdle(x, y, z, look, false, id);
    // Hold an ordinary engine phase across hops. Vehicles with an airborne
    // take or continuous idle loop still need their position and load updated.
    if (look === 'goblin_rocket_sled' || sink.mountEngineIdles(look)) {
      sink.mountEngine(x, y, z, look, moving, id, backwards, true, state.mountPivot);
    }
  } else if (moving) {
    sink.mountIdle(x, y, z, look, false, id);
    if (sink.mountEngine(x, y, z, look, true, id, backwards, false)) return;
    if (speed >= FOOT_RUN_SPEED) {
      if (strideHit(state, speed, dt, MOUNT_STRIDE_RUN)) {
        sink.mountRun(x, y, z, look, surfaceAt(x, z, y), self);
      }
    } else {
      state.stepAccum = MOUNT_STRIDE_RUN * 0.6;
    }
  } else {
    sink.mountEngine(x, y, z, look, false, id, false, false, state.mountPivot);
    sink.mountIdle(x, y, z, look, true, id);
  }
}
