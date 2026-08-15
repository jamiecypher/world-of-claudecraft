import * as THREE from 'three';

/** Shared zero-rotation reference for the damping slerp; never mutated. */
const IDENTITY_QUAT = new THREE.Quaternion();

/**
 * Follows a point that RIDES an animated bone, in visual-root space.
 *
 * The caller names a point it already trusts in root space (a mount's authored
 * saddle: `(0, seat, seatFwd)`), and the constructor converts it once into the
 * bone's local frame while the rig is still at its construction pose. Sampling
 * converts that fixed bone-local point back to root space each frame, so the
 * point travels with everything the bone does.
 *
 * The bone-local conversion is the whole point. Sampling the bone's ORIGIN
 * instead (`bone.getWorldPosition`) tracks almost nothing: animation here is
 * overwhelmingly rotation, and rotating a bone does not move its own origin.
 * A saddle sits some distance out from the spine, so it swings through a real
 * arc while the origin barely shifts. Anchoring to the origin is watching the
 * hinge instead of the door.
 *
 * `sampleOffset` returns a DISPLACEMENT from the authored rest point, not an
 * absolute position, so callers keep their own tuned seat coordinates and add
 * only the rig's motion. Allocation-free after construction.
 */
export class BoneMotionAnchor {
  /** The authored point expressed in the bone's local frame, captured once. */
  private readonly boneLocal = new THREE.Vector3();
  /** Where that point sat in root space at construction: the zero of the
   *  returned displacement. */
  private readonly rest = new THREE.Vector3();
  private readonly current = new THREE.Vector3();
  /** The bone's orientation in root space at construction: the zero of the
   *  returned rotation delta. */
  private readonly restQuat = new THREE.Quaternion();
  private readonly rootQuat = new THREE.Quaternion();
  private readonly boneQuat = new THREE.Quaternion();
  /** Distinct from rootQuat/boneQuat: sampleRootSpaceQuat writes both of those
   *  internally, so handing it either one as the output aliases its own
   *  operands mid-computation. */
  private readonly currentQuat = new THREE.Quaternion();

  /**
   * @param visualRoot the mount's CharacterVisual root; the frame the caller's
   *   seat coordinates and the returned displacement are both expressed in.
   * @param bone the animated bone to ride.
   * @param rootSpacePoint the authored point in `visualRoot` space. Passing the
   *   bone origin's own position here reproduces the old origin-only behaviour;
   *   passing a real saddle point is what makes the rider follow the saddle.
   */
  constructor(
    private readonly visualRoot: THREE.Object3D,
    private readonly bone: THREE.Object3D,
    rootSpacePoint: THREE.Vector3,
  ) {
    this.rest.copy(rootSpacePoint);
    // Root space -> world -> bone-local, at the construction pose. Every
    // intermediate transform (the modelWrap normalization scale, its yaw and y
    // offset, the whole bone chain) is folded in by the two conversions, so
    // nothing here has to know about them or apply them a second time.
    this.visualRoot.updateWorldMatrix(true, true);
    this.boneLocal.copy(rootSpacePoint);
    this.visualRoot.localToWorld(this.boneLocal);
    this.bone.worldToLocal(this.boneLocal);
    this.sampleRootSpaceQuat(this.restQuat);
  }

  /** The bone's orientation expressed in visual-root space. */
  private sampleRootSpaceQuat(target: THREE.Quaternion): THREE.Quaternion {
    this.visualRoot.getWorldQuaternion(this.rootQuat);
    this.bone.getWorldQuaternion(this.boneQuat);
    return target.copy(this.rootQuat).invert().multiply(this.boneQuat);
  }

  /** How far the bone has TURNED from its construction pose, in visual-root
   *  space. Pair it with sampleOffset to carry a rider as one rigid piece with
   *  the saddle: position alone leaves them upright while the mount pitches.
   *  `damping` scales the rotation (0 = ignore it, 1 = follow exactly), since
   *  a rider welded rigidly to a heavy gait reads as a statue rather than a
   *  person absorbing it. */
  sampleRotation(target: THREE.Quaternion, damping: number): THREE.Quaternion {
    this.sampleRootSpaceQuat(this.currentQuat);
    // delta = current * rest^-1, both already in root space.
    target.copy(this.restQuat).invert().premultiply(this.currentQuat);
    if (damping < 1) target.slerp(IDENTITY_QUAT, 1 - damping);
    return target;
  }

  /** Displacement of the authored point from its rest position, in visual-root
   *  space, for the rig's CURRENT pose. Call after the mount's mixer has
   *  advanced; it reads the same bone matrices the mixer just wrote rather than
   *  running a second animation clock, so a mount updating on a reduced crowd
   *  cadence yields a matching (equally stale) rider. */
  sampleOffset(target: THREE.Vector3): THREE.Vector3 {
    this.visualRoot.updateWorldMatrix(true, true);
    this.current.copy(this.boneLocal);
    this.bone.localToWorld(this.current);
    this.visualRoot.worldToLocal(this.current);
    return target.copy(this.current).sub(this.rest);
  }
}
