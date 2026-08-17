// The per-entity spatial movement audio pass: jump and landing edges, water
// entry, footfalls, swim strokes, a mount's gait beat and its engine loop.
//
// Lifted out of the entity loop because it is movement-audio behavior rather
// than coordinator work, and renderer.ts is a named monolith under the
// line-count ratchet (root CLAUDE.md, Modularity). The logic is unchanged; the
// seam is the parameter list.

import * as THREE from 'three';
import type { SpatialAudioSink, Surface } from './audio_sink';
import { gaitContactCrossed, mountAirborneCue } from './mount_audio_cues';
import type { Vfx } from './vfx';

/** Reused per call: this runs per entity per frame. */
const tmpPuff = new THREE.Vector3();

/** Beyond this (squared yards) a body's movement audio is not emitted at all,
 *  so distant crowds cost nothing. */
export const SFX_MOVE_RANGE_SQ = 42 * 42;
/** Below this downward speed a touchdown is a footfall, not a landing thud. */
export const SOFT_LANDING_SPEED = 4.5;
/** Distance accumulators, in yards travelled per cue. */
export const FOOT_STRIDE_WALK = 0.95;
export const FOOT_STRIDE_RUN = 1.55;
export const SWIM_STRIDE = 2.4;
/** Ground speed at or above which a body is running rather than walking. */
export const FOOT_RUN_SPEED = 4.5; // u/s, matches the run threshold in characters/anim_state.ts

/** The EntityView slice this pass reads and writes. */
export interface MovementAudioHost {
  wasAirborne: boolean;
  wasSwimming: boolean;
  fallSpeed: number;
  stepAccum: number;
  mountGaitPhase: number;
  mountApexArmed: boolean;
  mountVisual: { baseClipPhase(): number | null } | null;
}

export interface MovementAudioInputs {
  sink: SpatialAudioSink | null;
  /** Squared distance to the listener. */
  d2: number;
  entityId: number;
  mountKey: string;
  isSelf: boolean;
  logicallyMounted: boolean;
  riderMounted: boolean;
  visuallyDead: boolean;
  airborne: boolean;
  swimming: boolean;
  sitting: boolean;
  moving: boolean;
  settled: boolean;
  speed: number;
  /** Raw vertical delta this frame. */
  dyRaw: number;
  ax: number;
  ay: number;
  az: number;
  dt: number;
  surfaceAt: (x: number, z: number, y: number) => Surface;
  vfx: Vfx;
}

export function emitMovementAudio(v: MovementAudioHost, input: MovementAudioInputs): void {
  const {
    sink,
    d2,
    isSelf,
    logicallyMounted,
    riderMounted,
    visuallyDead,
    airborne,
    swimming,
    moving,
    settled,
    dyRaw,
    ax,
    ay,
    az,
    dt,
    surfaceAt,
    vfx,
  } = input;
  const e = { mountKey: input.mountKey, id: input.entityId };
  const st = { sitting: input.sitting };
  const loco = { speed: input.speed };
  if (sink && d2 < SFX_MOVE_RANGE_SQ) {
    // jump / land / water-entry edges
    // The mount's own takeoff/touchdown/apex, silent without the takes. Each
    // reports whether it actually played, because a mount with its own voice
    // REPLACES the rider's rather than stacking on top of it: the rider is not
    // the one leaving the ground.
    let mountTookOff = false;
    let mountLanded = false;
    if (logicallyMounted && e.mountKey && !visuallyDead) {
      const cue = mountAirborneCue(airborne, v.wasAirborne, v.mountApexArmed, dyRaw);
      if (cue === 'jump') {
        mountTookOff = sink.mountMove('jump', ax, ay, az, e.mountKey);
        v.mountApexArmed = true;
      } else if (cue === 'land') {
        mountLanded = sink.mountMove('land', ax, ay, az, e.mountKey);
        v.mountApexArmed = false;
      } else if (cue === 'apex') {
        v.mountApexArmed = false;
        sink.mountMove('squawk', ax, ay, az, e.mountKey);
        sink.mountMove('flap', ax, ay, az, e.mountKey);
      }
    }
    if (airborne && !v.wasAirborne && !visuallyDead) {
      if (!mountTookOff) sink.movement('jump', ax, ay, az, isSelf);
    } else if (!airborne && v.wasAirborne && !visuallyDead) {
      // A flight that ends by catching a ledge is not a fall, and the
      // heavy landing thud on one reads as a bug: you hopped onto a rock
      // mid-arc and the game played a crash. Anything softer than a plain
      // jump's own landing speed gets a footfall instead.
      // The dust below still fires either way: only the SOUND is replaced.
      if (!mountLanded) {
        if (v.fallSpeed >= SOFT_LANDING_SPEED) {
          sink.movement('land', ax, ay, az, isSelf);
        } else {
          sink.footstep(ax, ay, az, surfaceAt(ax, az, ay), false, isSelf);
        }
      }
      // Impact dust, scaled by how hard the body actually came down and
      // tinted by what it came down on. This is the visual half of the
      // landing the camera already thumps for.
      emitGroundPuff(vfx, surfaceAt, ax, ay, az, (v.fallSpeed - 5) / 14);
    }
    // Striding up onto a ledge scuffs the surface: a wisp, not a landing.
    if (settled && dyRaw > 0.28 && !visuallyDead) {
      emitGroundPuff(vfx, surfaceAt, ax, ay, az, 0.08);
    }
    if (swimming && !v.wasSwimming && !visuallyDead) sink.movement('splash', ax, ay, az, isSelf);
    // footfalls / swim strokes via a distance accumulator (no timers)
    if (visuallyDead || (st.sitting && !riderMounted)) {
      v.stepAccum = 0;
    } else if (swimming) {
      v.stepAccum += loco.speed * dt;
      if (v.stepAccum >= SWIM_STRIDE) {
        v.stepAccum = 0;
        sink.movement('swim', ax, ay, az, isSelf);
      }
    } else if (logicallyMounted && moving && !airborne) {
      // An engine mount (windup/loop/winddown take set, e.g. the tank
      // mount) drives its own state machine every frame instead of the
      // per-stride gait beat below; mountEngine reports whether this
      // mountKey actually has one, so ordinary mounts fall through.
      if (sink.mountEngine(ax, ay, az, e.mountKey, true, e.id)) {
        // handled entirely by mountEngine
      } else if (loco.speed >= FOOT_RUN_SPEED) {
        // Fires on the clip's own foot contacts, not on distance travelled.
        const phase = v.mountVisual?.baseClipPhase() ?? -1;
        if (phase >= 0 && gaitContactCrossed(v.mountGaitPhase, phase)) {
          sink.mountRun(ax, ay, az, e.mountKey, isSelf);
        }
        v.mountGaitPhase = phase;
      } else {
        v.mountGaitPhase = -1;
      }
    } else if (logicallyMounted && airborne) {
      // Airborne while mounted (a jump, or hopping over a ledge): HOLD
      // whatever engine-audio phase was already playing rather than
      // polling mountEngine with moving=false, which would read the hop
      // as a stop and run a full winddown-then-windup cycle for every
      // little bump in the road. Skipping the poll entirely leaves the
      // state machine (and any active loop) exactly where it was; the
      // next grounded frame picks the state back up on its own branch.
    } else if (logicallyMounted && !visuallyDead && !(st.sitting && !riderMounted)) {
      // Not moving while mounted (grounded and stopped): still poll an
      // engine mount every frame so the winddown fires on the stop edge;
      // a non-engine mount has nothing to do here (mountEngine no-ops).
      sink.mountEngine(ax, ay, az, e.mountKey, false, e.id);
    } else if (moving && !airborne) {
      v.stepAccum += loco.speed * dt;
      const stride = loco.speed >= FOOT_RUN_SPEED ? FOOT_STRIDE_RUN : FOOT_STRIDE_WALK;
      if (v.stepAccum >= stride) {
        v.stepAccum = 0;
        sink.footstep(ax, ay, az, surfaceAt(ax, az, ay), loco.speed >= FOOT_RUN_SPEED, isSelf);
      }
    } else {
      // standing still, prime the accumulator so the first step after moving
      // lands promptly rather than after a full stride of travel.
      v.stepAccum = FOOT_STRIDE_WALK * 0.6;
    }
  } else if (sink && logicallyMounted) {
    // Every other cue in the block above is a one-shot; an engine
    // mount's loop is not, and this gate (SFX_MOVE_RANGE_SQ, 42yd) sits
    // inside the panner's own audible falloff (MAX_DISTANCE, 46yd in
    // sfx.ts). Without this, a rider who moves out of the 42yd gate
    // while still moving leaves a frozen, never-advancing loop node
    // playing at its last polled position until dismount or view
    // removal. mountEngineReset is a safe no-op with no active engine
    // state (an ordinary mount, or the loop already stopped).
    sink.mountEngineReset(e.id);
  }
}
/** Landing/scuff dust, tinted by what the body came down on.
 *
 *  Moved here with its only caller. Water swallows a puff, so that surface
 *  emits nothing at all. */
function emitGroundPuff(
  vfx: Vfx,
  surfaceAt: (x: number, z: number, y: number) => Surface,
  x: number,
  y: number,
  z: number,
  power: number,
): void {
  const p = Math.min(1, power);
  if (p <= 0.02) return;
  const surface = surfaceAt(x, z, y);
  if (surface === 'water') return;
  const color =
    surface === 'stone'
      ? 0x9b9a95
      : surface === 'wood'
        ? 0xa8895f
        : surface === 'snow'
          ? 0xe6eef5
          : surface === 'dirt'
            ? 0xa38257
            : 0x8d9a63;
  tmpPuff.set(x, y, z);
  vfx.groundPuff(tmpPuff, p, color);
}
