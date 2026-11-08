import * as THREE from 'three';
import { CharacterAnimState } from '../types/game';

export interface HumanCharacterBundle {
  group: THREE.Group;
  hipGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  leftElbowPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  rightElbowPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  leftKneePivot: THREE.Group;
  rightLegPivot: THREE.Group;
  rightKneePivot: THREE.Group;
  stridePhase: number;
}

let sharedPedShadowTex: THREE.CanvasTexture | null = null;
function getPedestrianShadowTexture(): THREE.CanvasTexture {
  if (sharedPedShadowTex) return sharedPedShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 58);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  sharedPedShadowTex = new THREE.CanvasTexture(canvas);
  sharedPedShadowTex.colorSpace = THREE.SRGBColorSpace;
  return sharedPedShadowTex;
}

let sharedFabricNormalTex: THREE.DataTexture | null = null;
function getFabricMicroNormalTexture(): THREE.DataTexture {
  if (sharedFabricNormalTex) return sharedFabricNormalTex;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const weaveX = ((x % 2) * 14) - 7;
      const weaveY = ((y % 2) * 14) - 7;
      data[idx] = 128 + weaveX;
      data[idx + 1] = 128 + weaveY;
      data[idx + 2] = 245;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.needsUpdate = true;
  sharedFabricNormalTex = tex;
  return tex;
}

/**
 * Builds an articulated 14-part GTA-style 3D human character (THREE.Group)
 * with independent Shoulder, Elbow, Hip, Knee, Torso, and Neck/Head joints.
 * Grounded at Y = 0, facing +X in local space.
 */
export function buildHumanCharacter3D(
  shirtHex: number = 0x0284c7,
  pantsHex: number = 0x1e293b,
  skinHex: number = 0xc68642,
  isPlayer: boolean = false,
  castShadow: boolean = true
): HumanCharacterBundle {
  const root = new THREE.Group();
  const fabricNormal = getFabricMicroNormalTexture();

  // Contact shadow disc grounded at Y = 0.02
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.25),
    new THREE.MeshBasicMaterial({
      map: getPedestrianShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinHex,
    roughness: 0.54,
    metalness: 0.04,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
  });

  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtHex,
    roughness: 0.76,
    metalness: 0.06,
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(0.25, 0.25),
  });

  const innerTeeMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0xf8fafc : 0xe2e8f0,
    roughness: 0.82,
    metalness: 0.02,
  });

  const jacketAccentMat = new THREE.MeshStandardMaterial({
    color: isPlayer ? 0xf59e0b : 0xf1f5f9,
    roughness: 0.42,
    metalness: 0.3,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsHex,
    roughness: 0.84,
    metalness: 0.08,
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(0.3, 0.3),
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.38,
    metalness: 0.18,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.45,
    metalness: 0.22,
  });

  const glassesMat = new THREE.MeshPhysicalMaterial({
    color: 0x090d16,
    roughness: 0.08,
    metalness: 0.9,
    clearcoat: 1.0,
  });

  const goldWatchMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.2,
    metalness: 0.92,
  });

  // 1. Hip / Pelvis Pivot at Y = 0.92m
  const hipGroup = new THREE.Group();
  hipGroup.position.set(0, 0.92, 0);
  root.add(hipGroup);

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.17, 0.41), pantsMat);
  pelvisMesh.castShadow = castShadow;
  hipGroup.add(pelvisMesh);

  // Leather Belt + Metallic Buckle
  const beltMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.285, 0.05, 0.425),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4, metalness: 0.3 })
  );
  beltMesh.position.set(0, 0.07, 0);
  hipGroup.add(beltMesh);

  const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.055, 0.08), goldWatchMat);
  buckleMesh.position.set(0.14, 0.07, 0);
  hipGroup.add(buckleMesh);

  // 2. Torso Group (Layered Open Street Jacket + Inner Crew Tee + Collar + Backpack)
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.09, 0);
  hipGroup.add(torsoGroup);

  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.54, 0.46), shirtMat);
  chestMesh.position.set(0, 0.27, 0);
  chestMesh.castShadow = castShadow;
  chestMesh.receiveShadow = castShadow;
  torsoGroup.add(chestMesh);

  // Front Inner Tee Panel
  const frontTee = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.18), innerTeeMat);
  frontTee.position.set(0.14, 0.26, 0);
  torsoGroup.add(frontTee);

  // Collar / Shoulder Yoke Accent
  const collarMesh = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.09, 0.48), jacketAccentMat);
  collarMesh.position.set(0, 0.5, 0);
  torsoGroup.add(collarMesh);

  if (isPlayer) {
    // Urban Sling Backpack on Player
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.2,
    });
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.36, 0.3), packMat);
    backpack.position.set(-0.19, 0.29, 0);
    backpack.castShadow = castShadow;
    torsoGroup.add(backpack);

    const packStrip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.24), jacketAccentMat);
    packStrip.position.set(-0.265, 0.34, 0);
    torsoGroup.add(packStrip);
  }

  // 3. Head Group (Neck + Sculpted Jaw/Head + Tapered Hair + Aviator Sunglasses)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.55, 0);
  torsoGroup.add(headGroup);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.088, 0.13, 12), skinMat);
  neckMesh.position.set(0, 0.05, 0);
  headGroup.add(neckMesh);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.168, 18, 18), skinMat);
  headMesh.position.set(0, 0.22, 0);
  headMesh.scale.set(1.02, 1.14, 0.94);
  headMesh.castShadow = castShadow;
  headGroup.add(headMesh);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.176, 16, 14), hairMat);
  hairCap.position.set(-0.02, 0.265, 0);
  hairCap.scale.set(1.04, 0.88, 0.98);
  headGroup.add(hairCap);

  // Aviator Sunglasses
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.058, 0.26), glassesMat);
  visor.position.set(0.145, 0.23, 0);
  headGroup.add(visor);

  // 4. Articulated 2-Segment Arms (Shoulder Pivot -> Upper Arm -> Elbow Pivot -> Forearm & Hand)
  const buildArticulatedArm = (zSign: number): { shoulder: THREE.Group; elbow: THREE.Group } => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(0, 0.48, zSign * 0.285);
    torsoGroup.add(shoulderPivot);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.074, 0.062, 0.27, 12),
      shirtMat
    );
    upperArm.position.set(0, -0.125, 0);
    upperArm.castShadow = castShadow;
    shoulderPivot.add(upperArm);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.25, 0);
    shoulderPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.048, 0.25, 12),
      skinMat
    );
    forearm.position.set(0, -0.12, 0);
    forearm.castShadow = castShadow;
    elbowPivot.add(forearm);

    if (isPlayer && zSign < 0) {
      // Wristwatch on Left Wrist
      const watch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.053, 0.053, 0.035, 10),
        goldWatchMat
      );
      watch.position.set(0, -0.21, 0);
      elbowPivot.add(watch);
    }

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.055), skinMat);
    hand.position.set(0.01, -0.26, 0);
    elbowPivot.add(hand);

    return { shoulder: shoulderPivot, elbow: elbowPivot };
  };

  const leftArm = buildArticulatedArm(-1);
  const rightArm = buildArticulatedArm(1);

  // 5. Articulated 2-Segment Legs (Hip Pivot -> Thigh -> Knee Pivot -> Calf & Sneaker)
  const buildArticulatedLeg = (zSign: number): { hip: THREE.Group; knee: THREE.Group } => {
    const legPivot = new THREE.Group();
    legPivot.position.set(0, -0.04, zSign * 0.125);
    hipGroup.add(legPivot);

    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.096, 0.078, 0.43, 12),
      pantsMat
    );
    thigh.position.set(0, -0.21, 0);
    thigh.castShadow = castShadow;
    legPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.42, 0);
    legPivot.add(kneePivot);

    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.076, 0.062, 0.41, 12),
      pantsMat
    );
    calf.position.set(0, -0.2, 0);
    calf.castShadow = castShadow;
    kneePivot.add(calf);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.13), shoeMat);
    shoe.position.set(0.055, -0.41, 0);
    shoe.castShadow = castShadow;
    kneePivot.add(shoe);

    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.285, 0.032, 0.14), innerTeeMat);
    sole.position.set(0.055, -0.45, 0);
    kneePivot.add(sole);

    return { hip: legPivot, knee: kneePivot };
  };

  const leftLeg = buildArticulatedLeg(-1);
  const rightLeg = buildArticulatedLeg(1);

  return {
    group: root,
    hipGroup,
    torsoGroup,
    headGroup,
    leftArmPivot: leftArm.shoulder,
    leftElbowPivot: leftArm.elbow,
    rightArmPivot: rightArm.shoulder,
    rightElbowPivot: rightArm.elbow,
    leftLegPivot: leftLeg.hip,
    leftKneePivot: leftLeg.knee,
    rightLegPivot: rightLeg.hip,
    rightKneePivot: rightLeg.knee,
    stridePhase: Math.random() * Math.PI * 2,
  };
}

/**
 * GTA V-style procedural inverse-kinematic gait controller for IDLE, WALK, RUN, and JUMP.
 * Includes knee flexion on leg return stroke, elbow pump, and counter-rotating pelvis/chest twist.
 */
export function updateHumanCharacterAnimation(
  bundle: HumanCharacterBundle,
  animState: CharacterAnimState,
  speedMetersPerSec: number,
  jumpY: number,
  timeSec: number,
  dt: number
): void {
  if (animState === 'JUMP' || jumpY > 0.04) {
    // Athletic Airborne Parkour Jump Pose with bent knees and raised forearms
    bundle.hipGroup.position.y = 0.92 + jumpY;
    bundle.torsoGroup.rotation.z = THREE.MathUtils.damp(bundle.torsoGroup.rotation.z, -0.22, 12, dt);
    bundle.torsoGroup.rotation.y = THREE.MathUtils.damp(bundle.torsoGroup.rotation.y, 0, 12, dt);

    bundle.leftLegPivot.rotation.z = THREE.MathUtils.damp(bundle.leftLegPivot.rotation.z, 0.65, 14, dt);
    bundle.leftKneePivot.rotation.z = THREE.MathUtils.damp(bundle.leftKneePivot.rotation.z, -0.85, 14, dt);

    bundle.rightLegPivot.rotation.z = THREE.MathUtils.damp(bundle.rightLegPivot.rotation.z, -0.25, 14, dt);
    bundle.rightKneePivot.rotation.z = THREE.MathUtils.damp(bundle.rightKneePivot.rotation.z, -0.65, 14, dt);

    bundle.leftArmPivot.rotation.z = THREE.MathUtils.damp(bundle.leftArmPivot.rotation.z, -0.55, 14, dt);
    bundle.leftElbowPivot.rotation.z = THREE.MathUtils.damp(bundle.leftElbowPivot.rotation.z, 0.75, 14, dt);

    bundle.rightArmPivot.rotation.z = THREE.MathUtils.damp(bundle.rightArmPivot.rotation.z, 0.55, 14, dt);
    bundle.rightElbowPivot.rotation.z = THREE.MathUtils.damp(bundle.rightElbowPivot.rotation.z, 0.75, 14, dt);
    return;
  }

  if (animState === 'IDLE' || speedMetersPerSec < 0.35) {
    const breath = Math.sin(timeSec * 2.5 + bundle.stridePhase) * 0.014;
    const lookTurn = Math.sin(timeSec * 0.9 + bundle.stridePhase) * 0.12;

    bundle.hipGroup.position.y = THREE.MathUtils.damp(bundle.hipGroup.position.y, 0.92 + breath, 10, dt);
    bundle.hipGroup.rotation.y = THREE.MathUtils.damp(bundle.hipGroup.rotation.y, 0, 10, dt);
    bundle.torsoGroup.rotation.z = THREE.MathUtils.damp(bundle.torsoGroup.rotation.z, breath * 0.7, 10, dt);
    bundle.torsoGroup.rotation.y = THREE.MathUtils.damp(bundle.torsoGroup.rotation.y, 0, 10, dt);
    bundle.headGroup.rotation.y = THREE.MathUtils.damp(bundle.headGroup.rotation.y, lookTurn, 6, dt);

    bundle.leftLegPivot.rotation.z = THREE.MathUtils.damp(bundle.leftLegPivot.rotation.z, 0.03, 12, dt);
    bundle.leftKneePivot.rotation.z = THREE.MathUtils.damp(bundle.leftKneePivot.rotation.z, -0.05, 12, dt);
    bundle.rightLegPivot.rotation.z = THREE.MathUtils.damp(bundle.rightLegPivot.rotation.z, -0.03, 12, dt);
    bundle.rightKneePivot.rotation.z = THREE.MathUtils.damp(bundle.rightKneePivot.rotation.z, -0.05, 12, dt);

    bundle.leftArmPivot.rotation.z = THREE.MathUtils.damp(
      bundle.leftArmPivot.rotation.z,
      Math.sin(timeSec * 1.6) * 0.04,
      10,
      dt
    );
    bundle.leftElbowPivot.rotation.z = THREE.MathUtils.damp(bundle.leftElbowPivot.rotation.z, 0.18, 10, dt);

    bundle.rightArmPivot.rotation.z = THREE.MathUtils.damp(
      bundle.rightArmPivot.rotation.z,
      -Math.sin(timeSec * 1.6) * 0.04,
      10,
      dt
    );
    bundle.rightElbowPivot.rotation.z = THREE.MathUtils.damp(bundle.rightElbowPivot.rotation.z, 0.18, 10, dt);
    return;
  }

  // Natural Biomechanical Walk or Sprint Gait Cycle
  const isSprint = animState === 'RUN';
  const freq = isSprint ? 11.8 : 7.4;
  const thighAmp = isSprint ? 0.78 : 0.46;
  const armAmp = isSprint ? 0.82 : 0.38;

  bundle.stridePhase += dt * freq;
  const p = bundle.stridePhase;
  const s = Math.sin(p);
  const c = Math.cos(p);

  // Double-frequency vertical center-of-mass bounce
  const bob = Math.abs(c) * (isSprint ? 0.072 : 0.034);
  bundle.hipGroup.position.y = 0.92 + bob;

  // Counter-rotating pelvis & upper chest twist
  bundle.hipGroup.rotation.y = s * (isSprint ? 0.14 : 0.08);
  bundle.torsoGroup.rotation.y = -s * (isSprint ? 0.18 : 0.1);
  bundle.torsoGroup.rotation.z = THREE.MathUtils.damp(
    bundle.torsoGroup.rotation.z,
    isSprint ? -0.2 : -0.06,
    12,
    dt
  );
  bundle.headGroup.rotation.y = THREE.MathUtils.damp(bundle.headGroup.rotation.y, 0, 10, dt);

  // Thigh swing (+Z rotation swings leg forward in +X character space)
  bundle.leftLegPivot.rotation.z = s * thighAmp;
  bundle.rightLegPivot.rotation.z = -s * thighAmp;

  // Asymmetric knee flexion: knee bends backward (-Z) during forward recovery swing
  const leftKneeBend = Math.max(0, -c) * (isSprint ? 1.15 : 0.68) + (isSprint ? 0.15 : 0.06);
  const rightKneeBend = Math.max(0, c) * (isSprint ? 1.15 : 0.68) + (isSprint ? 0.15 : 0.06);
  bundle.leftKneePivot.rotation.z = -leftKneeBend;
  bundle.rightKneePivot.rotation.z = -rightKneeBend;

  // Arms swing opposite to legs with natural elbow flexion (+Z bends forearm forward)
  bundle.leftArmPivot.rotation.z = -s * armAmp;
  bundle.rightArmPivot.rotation.z = s * armAmp;

  const baseElbow = isSprint ? 0.85 : 0.28;
  bundle.leftElbowPivot.rotation.z = baseElbow + Math.max(0, -s) * (isSprint ? 0.45 : 0.2);
  bundle.rightElbowPivot.rotation.z = baseElbow + Math.max(0, s) * (isSprint ? 0.45 : 0.2);
}
