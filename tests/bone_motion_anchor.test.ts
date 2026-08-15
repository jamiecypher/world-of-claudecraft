import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BoneMotionAnchor } from '../src/render/characters/bone_motion_anchor';

describe('BoneMotionAnchor', () => {
  it('follows a saddle point through a pure bone ROTATION', () => {
    // The regression that shipped the floating rider: the anchor sampled the
    // bone's own origin, and rotating a bone does not move its origin, so a
    // rig animated almost entirely by rotation produced no rider motion at
    // all. A point held out from the bone swings through a real arc.
    const root = new THREE.Group();
    const bone = new THREE.Bone();
    bone.position.set(0, 1, 0);
    root.add(bone);

    // One unit above the bone origin: the stand-in for a saddle sitting out
    // from the spine.
    const anchor = new BoneMotionAnchor(root, bone, new THREE.Vector3(0, 2, 0));

    bone.rotation.z = Math.PI / 2;

    const offset = anchor.sampleOffset(new THREE.Vector3());
    // (0,1,0) in bone space rotates to (-1,0,0); the point lands at (-1,1,0)
    // having started at (0,2,0).
    expect(offset.x).toBeCloseTo(-1);
    expect(offset.y).toBeCloseTo(-1);
    expect(offset.z).toBeCloseTo(0);
    // Guard the specific defect: the bone ORIGIN never moved, so any
    // implementation reading it reports no displacement whatsoever.
    expect(offset.length()).toBeGreaterThan(0.5);
  });

  it('returns only animated displacement in visual-root space', () => {
    const root = new THREE.Group();
    root.position.set(7, 3, -2);
    root.rotation.y = 0.4;
    const rig = new THREE.Group();
    rig.scale.setScalar(2);
    const bone = new THREE.Bone();
    bone.position.set(0, 1, 0.5);
    rig.add(bone);
    root.add(rig);

    // Anchored at the bone's own origin, so this is pure bone translation:
    // the rig's scale still applies, and the root's own placement/yaw must
    // cancel out because the result is expressed in root space.
    const anchor = new BoneMotionAnchor(root, bone, new THREE.Vector3(0, 2, 1));
    bone.position.add(new THREE.Vector3(0.25, 0.5, -0.1));

    const offset = anchor.sampleOffset(new THREE.Vector3());
    expect(offset.x).toBeCloseTo(0.5);
    expect(offset.y).toBeCloseTo(1);
    expect(offset.z).toBeCloseTo(-0.2);
  });

  it('reports the bone turn as a root-space delta, scaled by damping', () => {
    const root = new THREE.Group();
    root.rotation.y = 0.8; // the root's own yaw must not leak into the delta
    const bone = new THREE.Bone();
    bone.position.set(0, 1, 0);
    bone.rotation.x = 0.2; // a non-identity construction pose
    root.add(bone);

    const anchor = new BoneMotionAnchor(root, bone, new THREE.Vector3(0, 2, 0));
    bone.rotation.x = 0.2 + 0.5;

    const full = anchor.sampleRotation(new THREE.Quaternion(), 1);
    const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
    expect(full.angleTo(expected)).toBeCloseTo(0);

    // Half damping turns the rider half as far, not at all and not fully.
    const half = anchor.sampleRotation(new THREE.Quaternion(), 0.5);
    expect(half.angleTo(new THREE.Quaternion())).toBeCloseTo(0.25, 2);

    // Zero damping leaves the rider square to the world.
    const none = anchor.sampleRotation(new THREE.Quaternion(), 0);
    expect(none.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });

  it('reports no displacement while the rig holds its construction pose', () => {
    const root = new THREE.Group();
    root.position.set(-4, 2, 6);
    root.rotation.y = 1.1;
    const rig = new THREE.Group();
    rig.scale.setScalar(0.37); // a normalization scale, as modelWrap applies
    const bone = new THREE.Bone();
    bone.position.set(0.2, 1.4, -0.3);
    bone.rotation.set(0.3, -0.2, 0.15);
    rig.add(bone);
    root.add(rig);

    const anchor = new BoneMotionAnchor(root, bone, new THREE.Vector3(0, 2.62, 0.32));

    const offset = anchor.sampleOffset(new THREE.Vector3());
    expect(offset.length()).toBeCloseTo(0);
  });
});
