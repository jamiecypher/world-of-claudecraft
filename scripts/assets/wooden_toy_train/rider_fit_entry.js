import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createWoodenToyTrainBlockout, TRAIN_SOCKET_DEFINITIONS } from './model.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function parseGlb(value) {
  return new Promise((resolve, reject) => loader.parse(fromBase64(value), '', resolve, reject));
}

function makeRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(960, 720);
  renderer.setClearColor(0x20252d, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  document.body.replaceChildren(renderer.domElement);
  document.body.style.margin = '0';
  return renderer;
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xafc8e8, 0x382d28, 1.8));
  const key = new THREE.DirectionalLight(0xffe2bc, 3);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc3d3ff, 1);
  rim.position.set(4, 3, -4);
  scene.add(rim);
}

function fitCamera(camera, object, view) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
  const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.14;
  camera.up.set(0, 1, 0);
  if (view === 'top') {
    camera.position.set(center.x, center.y + distance, center.z + 0.01);
    camera.up.set(0, 0, -1);
  } else if (view === 'front') {
    camera.position.set(center.x, center.y + distance * 0.08, center.z + distance);
  } else if (view === 'side') {
    camera.position.set(center.x + distance, center.y + distance * 0.12, center.z);
  } else {
    camera.position.set(center.x + distance * 0.68, center.y + distance * 0.22, center.z + distance * 0.8);
  }
  camera.lookAt(center);
}

function skinnedBounds(root) {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.isSkinnedMesh) object.skeleton.update();
  });
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  root.traverse((object) => {
    if (!object.isSkinnedMesh || !object.visible) return;
    const position = object.geometry.getAttribute('position');
    for (let index = 0; index < position.count; index++) {
      vertex.fromBufferAttribute(position, index);
      object.applyBoneTransform(index, vertex);
      vertex.applyMatrix4(object.matrixWorld);
      bounds.expandByPoint(vertex);
    }
  });
  return bounds;
}

function skinnedHipBounds(root) {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.isSkinnedMesh) object.skeleton.update();
  });
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  root.traverse((object) => {
    if (!object.isSkinnedMesh || !object.visible) return;
    const position = object.geometry.getAttribute('position');
    const skinIndex = object.geometry.getAttribute('skinIndex');
    const skinWeight = object.geometry.getAttribute('skinWeight');
    if (!skinIndex || !skinWeight) return;
    const selectedBones = new Set();
    object.skeleton.bones.forEach((bone, index) => {
      const normalized = bone.name.toLowerCase().replace(/[^a-z]/g, '');
      if (normalized === 'hips' || normalized === 'upperlegl' || normalized === 'upperlegr') {
        selectedBones.add(index);
      }
    });
    for (let index = 0; index < position.count; index++) {
      let relevantWeight = 0;
      for (let channel = 0; channel < 4; channel++) {
        const boneIndex = skinIndex.getComponent(index, channel);
        if (selectedBones.has(boneIndex)) relevantWeight += skinWeight.getComponent(index, channel);
      }
      if (relevantWeight < 0.25) continue;
      vertex.fromBufferAttribute(position, index);
      object.applyBoneTransform(index, vertex);
      vertex.applyMatrix4(object.matrixWorld);
      bounds.expandByPoint(vertex);
    }
  });
  return bounds;
}

function findBone(root, normalizedName) {
  let match = null;
  root.traverse((object) => {
    if (match || !object.isBone) return;
    const normalized = object.name.toLowerCase().replace(/[^a-z]/g, '');
    if (normalized === normalizedName) match = object;
  });
  return match;
}

async function createSeatedRider(riderB64, socket) {
  const gltf = await parseGlb(riderB64);
  const rider = gltf.scene;
  const mixer = new THREE.AnimationMixer(rider);
  const idle = gltf.animations.find((candidate) => candidate.name === 'Idle');
  if (!idle) throw new Error('knight preview is missing Idle');
  mixer.clipAction(idle).play();
  mixer.update(Math.min(0.5, idle.duration * 0.5));
  const idleBounds = skinnedBounds(rider);
  const normScale = 2.6 / (idleBounds.max.y - idleBounds.min.y);

  const normalized = new THREE.Group();
  normalized.name = `${socket.nodeName}_RuntimePlayerNormalization`;
  normalized.scale.setScalar(normScale);
  normalized.position.y = -idleBounds.min.y * normScale;
  normalized.add(rider);

  const riderRoot = new THREE.Group();
  riderRoot.name = `${socket.nodeName}_RiderPreview`;
  riderRoot.position.fromArray(socket.position);
  riderRoot.rotation.y = socket.yaw;
  riderRoot.add(normalized);

  const sit = gltf.animations.find((candidate) => candidate.name === 'Sit_Floor_Idle');
  if (!sit) throw new Error('knight preview is missing Sit_Floor_Idle');
  mixer.stopAllAction();
  mixer.clipAction(sit).reset().play();
  mixer.update(Math.min(1.5, sit.duration * 0.55));
  return riderRoot;
}

window.renderWoodenToyTrainRiderFit = async (riderB64, view) => {
  const renderer = makeRenderer();
  const scene = new THREE.Scene();
  addLights(scene);

  const assembly = new THREE.Group();
  assembly.name = 'BlockoutReviewAssembly';
  scene.add(assembly);
  const train = createWoodenToyTrainBlockout();
  assembly.add(train);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ color: 0x363c43, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const riderBounds = {};
  const seatBalance = {};
  const seatWidths = {
    Socket_Driver: 1.48,
    Socket_Passenger_1: 1.48,
    Socket_Passenger_2: 1.66,
  };
  for (const socket of TRAIN_SOCKET_DEFINITIONS) {
    const rider = await createSeatedRider(riderB64, socket);
    assembly.add(rider);
    rider.updateMatrixWorld(true);
    const bounds = skinnedBounds(rider);
    const hips = findBone(rider, 'hips');
    if (!hips) throw new Error(`${socket.nodeName} rider is missing hips bone`);
    const hipPosition = hips.getWorldPosition(new THREE.Vector3());
    const upperLegLeft = findBone(rider, 'upperlegl');
    const upperLegRight = findBone(rider, 'upperlegr');
    if (!upperLegLeft || !upperLegRight) {
      throw new Error(`${socket.nodeName} rider is missing upper-leg bones`);
    }
    const upperLegMidpoint = upperLegLeft
      .getWorldPosition(new THREE.Vector3())
      .add(upperLegRight.getWorldPosition(new THREE.Vector3()))
      .multiplyScalar(0.5);
    const hipBounds = skinnedHipBounds(rider);
    if (hipBounds.isEmpty()) throw new Error(`${socket.nodeName} rider hip bounds are empty`);
    const visibleHipCenter = hipBounds.getCenter(new THREE.Vector3());
    const halfSeatWidth = seatWidths[socket.nodeName] / 2;
    riderBounds[socket.nodeName] = {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: bounds.getSize(new THREE.Vector3()).toArray(),
    };
    seatBalance[socket.nodeName] = {
      hipPosition: hipPosition.toArray(),
      upperLegMidpoint: upperLegMidpoint.toArray(),
      visibleHipBounds: {
        min: hipBounds.min.toArray(),
        max: hipBounds.max.toArray(),
        center: visibleHipCenter.toArray(),
      },
      seatEdgesX: [-halfSeatWidth, halfSeatWidth],
      leftClearance: hipBounds.min.x + halfSeatWidth,
      rightClearance: halfSeatWidth - hipBounds.max.x,
      imbalance: Math.abs(visibleHipCenter.x * 2),
    };
  }

  const trainBounds = new THREE.Box3().setFromObject(train);
  const assemblyBounds = new THREE.Box3().setFromObject(assembly);
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.05, 60);
  fitCamera(camera, assembly, view);
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  return {
    dataUrl,
    trainBounds: {
      min: trainBounds.min.toArray(),
      max: trainBounds.max.toArray(),
      size: trainBounds.getSize(new THREE.Vector3()).toArray(),
    },
    assemblyBounds: {
      min: assemblyBounds.min.toArray(),
      max: assemblyBounds.max.toArray(),
      size: assemblyBounds.getSize(new THREE.Vector3()).toArray(),
    },
    riderBounds,
    seatBalance,
  };
};

window.__ready = true;
