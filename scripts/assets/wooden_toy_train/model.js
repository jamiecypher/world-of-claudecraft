import * as THREE from 'three';

export const TRAIN_BLOCKOUT_BOUNDS = Object.freeze({
  width: 2.3,
  height: 2.45,
  depth: 5.9,
});

export const TRAIN_SOCKET_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'driver',
    nodeName: 'Socket_Driver',
    position: Object.freeze([0.066, 1.18, 0.38]),
    yaw: 0,
    parent: 'Engine',
    purpose: 'forward-facing driver in recessed open pod',
  }),
  Object.freeze({
    id: 'passenger-1',
    nodeName: 'Socket_Passenger_1',
    position: Object.freeze([0.066, 1.16, -1.32]),
    yaw: 0,
    parent: 'Caboose',
    purpose: 'forward-facing passenger in recessed open pod',
  }),
  Object.freeze({
    id: 'passenger-2',
    nodeName: 'Socket_Passenger_2',
    position: Object.freeze([-0.066, 1.16, -2.78]),
    yaw: Math.PI,
    parent: 'Caboose',
    purpose: 'rear-facing passenger on exposed rear bench',
  }),
]);

const COLORS = Object.freeze({
  paintedWood: 0x505d70,
  crimsonTrim: 0xa44037,
  upholstery: 0x784045,
  brass: 0xcaa04e,
  darkIron: 0x626c76,
  hubCharcoal: 0x343b45,
  wheelTread: 0x1b1f24,
});

function material(name, color, options = {}) {
  const result = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0,
  });
  result.name = name;
  return result;
}

function addBox(parent, name, size, position, materialValue) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), materialValue);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function roundedRectangleShape(width, height, radius) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
  return shape;
}

function addRoundedPanel(parent, name, width, height, depth, radius, position, materialValue, rotation = [0, 0, 0]) {
  const bevelSize = Math.min(radius * 0.2, depth * 0.2);
  const geometry = new THREE.ExtrudeGeometry(roundedRectangleShape(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, materialValue);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, name, radius, length, position, materialValue, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12, 1, false),
    materialValue,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBell(parent, position, materials) {
  const bell = new THREE.Group();
  bell.name = 'Engine_Bell';
  bell.position.set(...position);
  parent.add(bell);

  const profile = [
    new THREE.Vector2(0.08, 0.19),
    new THREE.Vector2(0.13, 0.16),
    new THREE.Vector2(0.16, 0.05),
    new THREE.Vector2(0.21, -0.1),
    new THREE.Vector2(0.27, -0.17),
    new THREE.Vector2(0.28, -0.2),
  ];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 12), materials.brass);
  cup.name = 'Engine_Bell_Cup';
  cup.castShadow = true;
  cup.receiveShadow = true;
  bell.add(cup);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.263, 0.03, 6, 12), materials.brass);
  rim.name = 'Engine_Bell_Rim';
  rim.position.y = -0.185;
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  bell.add(rim);

  addCylinder(bell, 'Engine_Bell_Stem', 0.05, 0.1, [0, 0.22, 0], materials.brass);
  addCylinder(bell, 'Engine_Bell_Clapper', 0.05, 0.08, [0, -0.22, 0], materials.darkIron);
  addBox(bell, 'Engine_Bell_Yoke_Crossbar', [0.6, 0.06, 0.1], [0, 0.25, 0], materials.darkIron);
  for (const [side, x] of [['L', -0.26], ['R', 0.26]]) {
    addBox(bell, `Engine_Bell_Yoke_Post_${side}`, [0.06, 0.28, 0.1], [x, 0.07, 0], materials.darkIron);
    addBox(bell, `Engine_Bell_Yoke_Foot_${side}`, [0.14, 0.06, 0.14], [x, -0.1, 0], materials.darkIron);
  }
}

function addWheel(parent, name, x, y, z, radius, materials, options = {}) {
  const wheel = new THREE.Group();
  wheel.name = name;
  wheel.position.set(x, y, z);
  parent.add(wheel);

  const tread = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.87, radius * 0.13, 6, 16),
    materials.wheelTread,
  );
  tread.name = `${name}_Tread`;
  tread.rotation.y = Math.PI / 2;
  tread.castShadow = true;
  tread.receiveShadow = true;
  wheel.add(tread);

  const outerDirection = Math.sign(x);
  const faceX = outerDirection * 0.04;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.69, radius * 0.09, 6, 16),
    materials.accent,
  );
  rim.name = `${name}_RedRim`;
  rim.position.x = faceX;
  rim.rotation.y = Math.PI / 2;
  rim.castShadow = true;
  wheel.add(rim);

  const spokeLength = radius * 0.5;
  const spokeCenterRadius = radius * 0.42;
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const spoke = addBox(
      wheel,
      `${name}_Spoke_${index + 1}`,
      [0.07, radius * 0.11, spokeLength],
      [faceX, Math.sin(angle) * spokeCenterRadius, Math.cos(angle) * spokeCenterRadius],
      materials.accent,
    );
    spoke.rotation.x = -angle;
  }

  addCylinder(
    wheel,
    `${name}_Hub`,
    radius * 0.22,
    0.1,
    [faceX, 0, 0],
    materials.hubCharcoal,
    [0, 0, Math.PI / 2],
  );

  if (options.crankAngle !== undefined) {
    const crankRadius = radius * 0.48;
    const crankY = Math.sin(options.crankAngle) * crankRadius;
    const crankZ = Math.cos(options.crankAngle) * crankRadius;
    addCylinder(
      wheel,
      `${name}_CrankBoss`,
      radius * 0.13,
      0.08,
      [outerDirection * 0.075, crankY, crankZ],
      materials.accent,
      [0, 0, Math.PI / 2],
    );
    addCylinder(
      wheel,
      `${name}_CrankPin`,
      radius * 0.07,
      0.13,
      [outerDirection * 0.13, crankY, crankZ],
      materials.wheelTread,
      [0, 0, Math.PI / 2],
    );
  }
  return wheel;
}

function addCouplingRod(parent, name, sideX, from, to, materialValue) {
  const deltaY = to.y - from.y;
  const deltaZ = to.z - from.z;
  const length = Math.hypot(deltaY, deltaZ);
  const rod = addBox(
    parent,
    name,
    [0.05, 0.09, length],
    [sideX, (from.y + to.y) / 2, (from.z + to.z) / 2],
    materialValue,
  );
  rod.rotation.x = -Math.atan2(deltaY, deltaZ);
  return rod;
}

function addSteamDrivePrototype(parent, side, sideX, crossheadPoint, crankPointValue, materials) {
  const direction = side === 'L' ? -1 : 1;
  const cylinderX = direction * 0.99;
  const cylinderCenterZ = 2.5;
  const cylinderLength = 0.32;
  const cylinderRearZ = cylinderCenterZ - cylinderLength / 2;
  addCylinder(
    parent,
    `Engine_SteamCylinder_${side}`,
    0.15,
    cylinderLength,
    [cylinderX, crossheadPoint.y, cylinderCenterZ],
    materials.darkIron,
    [Math.PI / 2, 0, 0],
  );
  addCylinder(
    parent,
    `Engine_SteamCylinderCap_${side}`,
    0.18,
    0.08,
    [cylinderX, crossheadPoint.y, cylinderCenterZ + cylinderLength / 2 + 0.04],
    materials.accent,
    [Math.PI / 2, 0, 0],
  );
  addBox(
    parent,
    `Engine_SteamCylinderMount_${side}`,
    [0.09, 0.22, 0.18],
    [sideX - direction * 0.035, 1.16, cylinderCenterZ],
    materials.darkIron,
  );
  const pistonLength = cylinderRearZ - crossheadPoint.z;
  addBox(
    parent,
    `Engine_PistonRod_${side}`,
    [0.07, 0.07, pistonLength],
    [sideX, crossheadPoint.y, crossheadPoint.z + pistonLength / 2],
    materials.primary,
  );
  addBox(
    parent,
    `Engine_Crosshead_${side}`,
    [0.07, 0.22, 0.16],
    [sideX, crossheadPoint.y, crossheadPoint.z],
    materials.primary,
  );
  for (const [guide, offsetY] of [['Upper', 0.13], ['Lower', -0.13]]) {
    addBox(
      parent,
      `Engine_CrossheadGuide_${side}_${guide}`,
      [0.05, 0.05, 0.5],
      [sideX - direction * 0.02, crossheadPoint.y + offsetY, 2.06],
      materials.darkIron,
    );
  }
  for (const [bracket, z] of [['Front', 2.3], ['Rear', 1.82]]) {
    addBox(
      parent,
      `Engine_CrossheadGuideBracket_${side}_${bracket}`,
      [0.07, 0.3, 0.08],
      [sideX - direction * 0.035, 1.0, z],
      materials.darkIron,
    );
  }
  addCouplingRod(
    parent,
    `Engine_ConnectingRod_${side}`,
    sideX,
    crossheadPoint,
    crankPointValue,
    materials.accent,
  );
}

function addEngineSideFrame(parent, materials) {
  for (const [side, x] of [
    ['L', -0.93],
    ['R', 0.93],
  ]) {
    addBox(parent, `Engine_SideBoard_${side}`, [0.12, 0.42, 2.86], [x, 0.94, 1.16], materials.secondary);
    addBox(parent, `Engine_SideTrimTop_${side}`, [0.14, 0.11, 2.94], [x, 1.14, 1.16], materials.accent);
    addBox(parent, `Engine_SideTrimBottom_${side}`, [0.14, 0.1, 2.94], [x, 0.74, 1.16], materials.accent);
  }
}

function addSocket(parent, definition, originZ = 0) {
  const socket = new THREE.Group();
  socket.name = definition.nodeName;
  socket.position.set(
    definition.position[0],
    definition.position[1],
    definition.position[2] - originZ,
  );
  socket.rotation.y = definition.yaw;
  socket.userData = { id: definition.id, purpose: definition.purpose };
  parent.add(socket);
  return socket;
}

function addDriverPod(parent, centerZ, seatY, materials) {
  const outerHalfWidth = 0.98;
  const wallThickness = 0.18;
  const wallCenterX = outerHalfWidth - wallThickness / 2;
  const frontOuterZ = centerZ + 0.64;
  const rearOuterZ = centerZ - 0.76;
  const backThickness = 0.2;
  const sideDepth = frontOuterZ - rearOuterZ;
  const endWidth = (wallCenterX - wallThickness / 2) * 2 + 0.04;

  const sideCenterZ = (frontOuterZ + rearOuterZ) / 2;
  addBox(parent, 'DriverPod_Seat', [1.48, 0.08, 0.76], [0, seatY - 0.04, centerZ - 0.04], materials.secondary);
  addRoundedPanel(parent, 'DriverPod_SeatCushion', 1.38, 0.66, 0.1, 0.14, [0, seatY + 0.03, centerZ - 0.04], materials.upholstery, [Math.PI / 2, 0, 0]);
  addBox(parent, 'DriverPod_Wall_L', [wallThickness, 0.9, sideDepth], [-wallCenterX, 1.18, sideCenterZ], materials.secondary);
  addBox(parent, 'DriverPod_Wall_R', [wallThickness, 0.9, sideDepth], [wallCenterX, 1.18, sideCenterZ], materials.secondary);
  addBox(parent, 'DriverPod_Back', [endWidth, 0.9, backThickness], [0, 1.18, rearOuterZ + backThickness / 2], materials.secondary);
  addRoundedPanel(parent, 'DriverPod_BackCushion', 1.38, 0.5, 0.12, 0.14, [0, 1.37, rearOuterZ + backThickness + 0.06], materials.upholstery);
  addBox(parent, 'DriverPod_TopCap_L', [0.2, 0.07, sideDepth], [-wallCenterX, 1.665, sideCenterZ], materials.accent);
  addBox(parent, 'DriverPod_TopCap_R', [0.2, 0.07, sideDepth], [wallCenterX, 1.665, sideCenterZ], materials.accent);
  addBox(parent, 'DriverPod_TopCap_Back', [endWidth, 0.07, 0.22], [0, 1.665, rearOuterZ + backThickness / 2], materials.accent);
}

function addPassengerPod(parent, centerZ, seatY, materials) {
  const outerHalfWidth = 0.98;
  const wallThickness = 0.18;
  const wallCenterX = outerHalfWidth - wallThickness / 2;
  const frontOuterZ = centerZ + 0.76;
  const rearOuterZ = centerZ - 0.84;
  const endThickness = 0.2;
  const sideDepth = frontOuterZ - rearOuterZ;
  const sideCenterZ = (frontOuterZ + rearOuterZ) / 2;
  const bodyTopY = 1.12;
  const wallTopY = 1.63;
  const upperWallHeight = wallTopY - bodyTopY;
  const upperWallCenterY = (bodyTopY + wallTopY) / 2;
  const endWidth = (wallCenterX - wallThickness / 2) * 2 + 0.04;

  addBox(parent, 'PassengerPod_Seat', [1.48, 0.08, 0.76], [0, seatY - 0.04, centerZ - 0.04], materials.secondary);
  addRoundedPanel(parent, 'PassengerPod_SeatCushion', 1.38, 0.66, 0.1, 0.14, [0, seatY + 0.03, centerZ - 0.04], materials.upholstery, [Math.PI / 2, 0, 0]);
  addBox(parent, 'PassengerPod_Wall_L', [wallThickness, upperWallHeight, sideDepth], [-wallCenterX, upperWallCenterY, sideCenterZ], materials.secondary);
  addBox(parent, 'PassengerPod_Wall_R', [wallThickness, upperWallHeight, sideDepth], [wallCenterX, upperWallCenterY, sideCenterZ], materials.secondary);
  addBox(parent, 'PassengerPod_Front', [endWidth, upperWallHeight, endThickness], [0, upperWallCenterY, frontOuterZ - endThickness / 2], materials.secondary);
  addBox(parent, 'PassengerPod_TopCap_L', [0.2, 0.07, sideDepth], [-wallCenterX, 1.665, sideCenterZ], materials.accent);
  addBox(parent, 'PassengerPod_TopCap_R', [0.2, 0.07, sideDepth], [wallCenterX, 1.665, sideCenterZ], materials.accent);
  addBox(parent, 'PassengerPod_TopCap_Front', [endWidth, 0.07, 0.22], [0, 1.665, frontOuterZ - endThickness / 2], materials.accent);
}

export function createWoodenToyTrainBlockout() {
  const darkIron = material('DarkIron', COLORS.darkIron, { roughness: 0.62, metalness: 0.22 });
  const paintedWood = material('NearBlackPaintedWood', COLORS.paintedWood, { roughness: 0.78 });
  const crimsonTrim = material('CrimsonStructuralTrim', COLORS.crimsonTrim, { roughness: 0.72 });
  const brass = material('BrassHardware', COLORS.brass, { roughness: 0.44, metalness: 0.38 });
  const materials = {
    primary: darkIron,
    secondary: paintedWood,
    wheelTread: material('BlackIronWheelTread', COLORS.wheelTread, { roughness: 0.68, metalness: 0.45 }),
    accent: crimsonTrim,
    upholstery: material('OxbloodSeatUpholstery', COLORS.upholstery, { roughness: 0.9 }),
    brass,
    darkIron,
    hubCharcoal: material('CharcoalWheelHub', COLORS.hubCharcoal, { roughness: 0.68, metalness: 0.28 }),
  };

  const root = new THREE.Group();
  root.name = 'MountRoot';
  root.userData.sculptRuntime = {
    stage: 'blockout',
    frontAxis: '+Z',
    approvedEnvelope: TRAIN_BLOCKOUT_BOUNDS,
  };

  const engine = new THREE.Group();
  engine.name = 'Engine';
  root.add(engine);

  addBox(engine, 'Engine_Chassis', [1.86, 0.46, 2.96], [0, 0.72, 1.16], materials.primary);
  addBox(engine, 'Engine_Center_Sill', [1.7, 0.18, 3.02], [0, 0.92, 1.16], materials.accent);
  addCylinder(
    engine,
    'Engine_Boiler',
    0.58,
    1.72,
    [0, 1.42, 1.73],
    materials.secondary,
    [Math.PI / 2, 0, 0],
  );
  const rearBoilerCollar = new THREE.Mesh(
    new THREE.TorusGeometry(0.59, 0.055, 6, 16),
    materials.darkIron,
  );
  rearBoilerCollar.name = 'Engine_BoilerRearCollar';
  rearBoilerCollar.position.set(0, 1.42, 0.91);
  rearBoilerCollar.castShadow = true;
  rearBoilerCollar.receiveShadow = true;
  engine.add(rearBoilerCollar);
  addCylinder(
    engine,
    'Engine_Round_Front',
    0.68,
    0.2,
    [0, 1.42, 2.62],
    materials.secondary,
    [Math.PI / 2, 0, 0],
  );
  addCylinder(engine, 'Smokestack_Base', 0.34, 0.62, [0, 1.83, 1.98], materials.secondary);
  addCylinder(engine, 'Smokestack_Mouth', 0.49, 0.3, [0, 2.29, 1.98], materials.secondary);
  addBell(engine, [0, 2.12, 1.2], materials);
  addBox(engine, 'Cowcatcher', [2.0, 0.34, 0.42], [0, 0.48, 2.73], materials.accent);

  addDriverPod(engine, 0.38, 1.18, materials);

  const engineWheels = [
    { z: 2.42, radius: 0.32 },
    { z: 1.35, radius: 0.56, driver: true },
    { z: 0.12, radius: 0.56, driver: true },
  ];
  const driverAxleY = 0.16 + 0.56;
  const driverCrankRadius = 0.56 * 0.48;
  const connectingRodLength = 0.78;
  const crossheadGuideY = 0.97;
  const crankPhases = { L: Math.PI * 0.32, R: Math.PI * 0.32 + Math.PI / 2 };
  for (const [index, wheel] of engineWheels.entries()) {
    addWheel(
      engine,
      `Wheel_Engine_L_${index + 1}`,
      -0.985,
      0.16 + wheel.radius,
      wheel.z,
      wheel.radius,
      materials,
      wheel.driver ? { crankAngle: crankPhases.L } : {},
    );
    addWheel(
      engine,
      `Wheel_Engine_R_${index + 1}`,
      0.985,
      0.16 + wheel.radius,
      wheel.z,
      wheel.radius,
      materials,
      wheel.driver ? { crankAngle: crankPhases.R } : {},
    );
  }
  const middleDriver = engineWheels[1];
  const rearDriver = engineWheels[2];
  const crankPoint = (wheel, phase) => ({
    y: driverAxleY + Math.sin(phase) * driverCrankRadius,
    z: wheel.z + Math.cos(phase) * driverCrankRadius,
  });
  for (const [side, x] of [['L', -1.1], ['R', 1.1]]) {
    addCouplingRod(
      engine,
      `Engine_CouplingRod_${side}`,
      x,
      crankPoint(middleDriver, crankPhases[side]),
      crankPoint(rearDriver, crankPhases[side]),
      materials.accent,
    );
  }
  for (const [side, x] of [['L', -1.15], ['R', 1.15]]) {
    const middleCrankPoint = crankPoint(middleDriver, crankPhases[side]);
    const crossheadPoint = {
      y: crossheadGuideY,
      z: middleCrankPoint.z + Math.sqrt(
        connectingRodLength ** 2 - (middleCrankPoint.y - crossheadGuideY) ** 2,
      ),
    };
    addSteamDrivePrototype(
      engine,
      side,
      x,
      crossheadPoint,
      middleCrankPoint,
      materials,
    );
  }
  engine.userData.steamDrive = {
    kind: 'procedural-slider-crank',
    wheelRotationAxis: 'X',
    driverWheelNames: {
      left: ['Wheel_Engine_L_2', 'Wheel_Engine_L_3'],
      right: ['Wheel_Engine_R_2', 'Wheel_Engine_R_3'],
    },
    driverAxles: [
      { y: driverAxleY, z: middleDriver.z },
      { y: driverAxleY, z: rearDriver.z },
    ],
    crankRadius: driverCrankRadius,
    crankPhases,
    connectingRodLength,
    couplingRodNames: ['Engine_CouplingRod_L', 'Engine_CouplingRod_R'],
    connectingRodNames: ['Engine_ConnectingRod_L', 'Engine_ConnectingRod_R'],
    crossheadNames: ['Engine_Crosshead_L', 'Engine_Crosshead_R'],
    pistonRodNames: ['Engine_PistonRod_L', 'Engine_PistonRod_R'],
    crossheadGuideY,
    cylinderRearZ: 2.34,
  };
  addEngineSideFrame(engine, materials);

  const couplingPivot = new THREE.Group();
  couplingPivot.name = 'CouplingPivot';
  couplingPivot.position.set(0, 0, -0.36);
  couplingPivot.userData = { purpose: 'future cosmetic caboose yaw', yawLimitDegrees: 12 };
  root.add(couplingPivot);
  addCylinder(couplingPivot, 'Coupling_Engine_Pin', 0.16, 0.18, [0, 0.55, -0.04], materials.darkIron);
  addBox(couplingPivot, 'Coupling_Drawbar', [0.24, 0.14, 0.62], [0, 0.55, -0.36], materials.darkIron);
  addCylinder(couplingPivot, 'Coupling_Caboose_Pin', 0.16, 0.18, [0, 0.55, -0.68], materials.darkIron);

  const caboose = new THREE.Group();
  caboose.name = 'Caboose';
  couplingPivot.add(caboose);
  const cabooseOriginZ = -0.36;
  const localZ = (worldZ) => worldZ - cabooseOriginZ;

  const cabooseFrontZ = -0.56;
  const cabooseRearZ = -3.2;
  const cabooseCenterZ = (cabooseFrontZ + cabooseRearZ) / 2;
  const cabooseDepth = cabooseFrontZ - cabooseRearZ;
  addBox(caboose, 'Caboose_MechanicalUnderframe', [1.84, 0.2, cabooseDepth], [0, 0.6, localZ(cabooseCenterZ)], materials.primary);
  addBox(caboose, 'Caboose_ContinuousRedSill', [1.98, 0.1, cabooseDepth], [0, 0.75, localZ(cabooseCenterZ)], materials.accent);
  addBox(caboose, 'Caboose_ContinuousCharcoalBody', [1.96, 0.32, cabooseDepth], [0, 0.96, localZ(cabooseCenterZ)], materials.secondary);
  addBox(caboose, 'Caboose_FrontRedWrap', [1.98, 0.1, 0.015], [0, 0.75, localZ(cabooseFrontZ + 0.0075)], materials.accent);
  addPassengerPod(caboose, localZ(-1.32), 1.16, materials);
  addBox(caboose, 'Caboose_SharedSeatBulkhead', [1.96, 0.51, 0.2], [0, 1.375, localZ(-2.26)], materials.secondary);
  addBox(caboose, 'Caboose_SharedBulkheadTopCap', [1.96, 0.07, 0.22], [0, 1.665, localZ(-2.26)], materials.accent);
  addRoundedPanel(caboose, 'PassengerPod_BackCushion', 1.38, 0.5, 0.12, 0.14, [0, 1.37, localZ(-2.1)], materials.upholstery);
  addRoundedPanel(caboose, 'RearBench_BackCushion', 1.38, 0.5, 0.12, 0.14, [0, 1.37, localZ(-2.42)], materials.upholstery);
  addBox(caboose, 'Caboose_RearSeatPlinth', [1.96, 0.05, 0.84], [0, 1.145, localZ(-2.78)], materials.secondary);
  addRoundedPanel(caboose, 'RearBench_Cushion', 1.62, 0.81, 0.1, 0.14, [0, 1.22, localZ(-2.765)], materials.upholstery, [Math.PI / 2, 0, 0]);

  for (const [index, z] of [-1.27, -2.56].entries()) {
    addWheel(caboose, `Wheel_Caboose_L_${index + 1}`, -1.02, 0.54, localZ(z), 0.38, materials);
    addWheel(caboose, `Wheel_Caboose_R_${index + 1}`, 1.02, 0.54, localZ(z), 0.38, materials);
  }
  for (const definition of TRAIN_SOCKET_DEFINITIONS) {
    const parent = definition.parent === 'Engine' ? engine : caboose;
    addSocket(parent, definition, definition.parent === 'Engine' ? 0 : cabooseOriginZ);
  }

  return root;
}
