import * as THREE from 'three';
import { VehicleSpec } from '../types/game';

export interface VehicleMeshBundle {
  group: THREE.Group;
  chassisGroup: THREE.Group;
  wheels: THREE.Object3D[];
  frontWheels: THREE.Object3D[];
  sirenLeftMat?: THREE.MeshStandardMaterial;
  sirenRightMat?: THREE.MeshStandardMaterial;
  primaryMats: THREE.MeshStandardMaterial[];
  baseColorHex: number;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedShadowTex) return sharedShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
  grad.addColorStop(0.58, 'rgba(0, 0, 0, 0.48)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  sharedShadowTex = new THREE.CanvasTexture(canvas);
  sharedShadowTex.colorSpace = THREE.SRGBColorSpace;
  return sharedShadowTex;
}

let sharedHeadlightBeamTex: THREE.CanvasTexture | null = null;
function getHeadlightBeamTexture(): THREE.CanvasTexture {
  if (sharedHeadlightBeamTex) return sharedHeadlightBeamTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 64, 256, 64);
  grad.addColorStop(0, 'rgba(254, 240, 138, 0.48)');
  grad.addColorStop(0.45, 'rgba(254, 249, 195, 0.18)');
  grad.addColorStop(1, 'rgba(254, 249, 195, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 48);
  ctx.lineTo(256, 4);
  ctx.lineTo(256, 124);
  ctx.lineTo(0, 80);
  ctx.closePath();
  ctx.fill();
  sharedHeadlightBeamTex = new THREE.CanvasTexture(canvas);
  sharedHeadlightBeamTex.colorSpace = THREE.SRGBColorSpace;
  return sharedHeadlightBeamTex;
}

let sharedTireNormalTex: THREE.DataTexture | null = null;
function getTireTreadNormalTexture(): THREE.DataTexture {
  if (sharedTireNormalTex) return sharedTireNormalTex;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const rib = (x % 8 < 4 ? 22 : -22) + (y % 4 < 2 ? 12 : -12);
      data[idx] = 128 + rib;
      data[idx + 1] = 128 + rib;
      data[idx + 2] = 240;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 2);
  tex.needsUpdate = true;
  sharedTireNormalTex = tex;
  return tex;
}

let sharedPlateTex: THREE.CanvasTexture | null = null;
function getTamilNaduPlateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  if (sharedPlateTex) return sharedPlateTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);
  // Blue IND strip
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(4, 4, 34, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('IND', 21, 38);

  ctx.fillStyle = '#090d16';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('TN 01 CH 2026', 144, 42);
  sharedPlateTex = new THREE.CanvasTexture(canvas);
  sharedPlateTex.colorSpace = THREE.SRGBColorSpace;
  sharedPlateTex.anisotropy = maxAnisotropy;
  return sharedPlateTex;
}

let sharedBusBoardTex: THREE.CanvasTexture | null = null;
function getBusDestinationTexture(maxAnisotropy: number): THREE.CanvasTexture {
  if (sharedBusBoardTex) return sharedBusBoardTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090D16';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = '#FACC15';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('21G பிராட்வே · MARINA', 128, 32);
  sharedBusBoardTex = new THREE.CanvasTexture(canvas);
  sharedBusBoardTex.colorSpace = THREE.SRGBColorSpace;
  sharedBusBoardTex.anisotropy = maxAnisotropy;
  return sharedBusBoardTex;
}

function createWheelAssembly(radius: number, width: number, castShadow: boolean): THREE.Group {
  const wheelGroup = new THREE.Group();

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
  tireGeo.rotateX(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.86,
    metalness: 0.08,
    normalMap: getTireTreadNormalTexture(),
    normalScale: new THREE.Vector2(0.45, 0.45),
  });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = castShadow;
  wheelGroup.add(tire);

  // Outer Brushed Alloy Rim
  const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 14);
  rimGeo.rotateX(Math.PI / 2);
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.16,
    metalness: 0.94,
    clearcoat: 0.8,
  });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheelGroup.add(rim);

  // 5-Spoke Star Detail + Center Cap
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.85,
  });
  const centerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width + 0.04, 10).rotateX(Math.PI / 2),
    hubMat
  );
  wheelGroup.add(centerCap);

  // Internal Red Performance Brake Caliper Accent
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.3,
    metalness: 0.6,
  });
  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.42, radius * 0.28, width * 0.85),
    caliperMat
  );
  caliper.position.set(-radius * 0.25, radius * 0.2, 0);
  wheelGroup.add(caliper);

  return wheelGroup;
}

/**
 * Builds a high-detail GTA V-style composite 3D procedural vehicle model (THREE.Group)
 * with grounded bottom-center pivot (Y=0), clearcoat metallic flake paint,
 * Tamil Nadu number plates, side mirrors, brake calipers, and headlight beam cones.
 */
export function buildChennaiVehicle3D(
  spec: VehicleSpec,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): VehicleMeshBundle {
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const wheels: THREE.Object3D[] = [];
  const frontWheels: THREE.Object3D[] = [];
  const primaryMats: THREE.MeshStandardMaterial[] = [];
  const castShadow = !isSoftwareGl;

  const baseColor = new THREE.Color(spec.primaryColor);
  const baseColorHex = baseColor.getHex();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    roughness: 0.06,
    metalness: 0.15,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 1.0,
    ior: 1.52,
    thickness: 0.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.8,
    roughness: 0.15,
  });

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.12,
    metalness: 0.96,
    clearcoat: 1.0,
  });

  const plateMat = new THREE.MeshBasicMaterial({
    map: getTamilNaduPlateTexture(maxAnisotropy),
  });

  // Contact shadow plane grounded at Y = 0.02
  const shadowSizeX = spec.id === 'mtc_bus' ? 11.6 : 5.5;
  const shadowSizeZ = spec.id === 'mtc_bus' ? 4.4 : 2.95;
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(shadowSizeX, shadowSizeZ),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // Projected Ground Headlight Light Cone
  const beamPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 4.4),
    new THREE.MeshBasicMaterial({
      map: getHeadlightBeamTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  beamPlane.rotation.x = -Math.PI / 2;
  beamPlane.position.set(spec.id === 'mtc_bus' ? 9.0 : 6.8, 0.03, 0);
  root.add(beamPlane);

  if (spec.id === 'auto_rickshaw') {
    const yellowMat = new THREE.MeshPhysicalMaterial({
      color: baseColorHex,
      roughness: 0.24,
      metalness: 0.32,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
    });
    primaryMats.push(yellowMat);

    const blackBodyMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.62,
      metalness: 0.38,
    });

    const canopyRexineMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.78,
      metalness: 0.05,
    });

    const tub = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.65, 1.56), blackBodyMat);
    tub.position.set(-0.35, 0.62, 0);
    tub.castShadow = castShadow;
    tub.receiveShadow = castShadow;
    chassisGroup.add(tub);

    const rearCowl = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.62, 1.64), yellowMat);
    rearCowl.position.set(-0.7, 0.86, 0);
    rearCowl.castShadow = castShadow;
    chassisGroup.add(rearCowl);

    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, 0);
    noseShape.lineTo(1.15, 0.22);
    noseShape.lineTo(1.15, 1.25);
    noseShape.lineTo(0, 1.38);
    noseShape.closePath();
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
      depth: 0.98,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    noseGeo.translate(-0.1, 0.35, -0.49);
    const nose = new THREE.Mesh(noseGeo, yellowMat);
    nose.position.set(0.55, 0, 0);
    nose.castShadow = castShadow;
    chassisGroup.add(nose);

    const wind = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 1.2), glassMat);
    wind.position.set(1.12, 1.52, 0);
    wind.rotation.z = 0.22;
    chassisGroup.add(wind);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.22, 1.6), canopyRexineMat);
    roof.position.set(-0.12, 2.02, 0);
    roof.castShadow = castShadow;
    chassisGroup.add(roof);

    const pillarGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8);
    [
      [-1.2, 1.5, -0.72],
      [-1.2, 1.5, 0.72],
      [0.85, 1.5, -0.58],
      [0.85, 1.5, 0.58],
    ].forEach(([px, py, pz]) => {
      const p = new THREE.Mesh(pillarGeo, chromeMat);
      p.position.set(px, py, pz);
      chassisGroup.add(p);
    });

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 1.35), seatMat);
    seat.position.set(-0.75, 1.05, 0);
    chassisGroup.add(seat);

    const meterMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });
    const meterBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.18), meterMat);
    meterBox.position.set(0.75, 1.22, -0.74);
    chassisGroup.add(meterBox);

    const headLamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16).rotateZ(Math.PI / 2),
      headlightMat
    );
    headLamp.position.set(1.74, 0.92, 0);
    chassisGroup.add(headLamp);

    // Rear Number Plate
    const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.14), plateMat);
    rearPlate.position.set(-1.53, 0.62, 0);
    rearPlate.rotation.y = -Math.PI / 2;
    chassisGroup.add(rearPlate);

    [-0.62, 0.62].forEach((zOff) => {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.24), taillightMat);
      tail.position.set(-1.52, 0.78, zOff);
      chassisGroup.add(tail);
    });

    const frontWheel = createWheelAssembly(0.38, 0.22, castShadow);
    frontWheel.position.set(1.42, 0.38, 0);
    root.add(frontWheel);
    wheels.push(frontWheel);
    frontWheels.push(frontWheel);

    [-0.78, 0.78].forEach((zOff) => {
      const rw = createWheelAssembly(0.4, 0.24, castShadow);
      rw.position.set(-0.95, 0.4, zOff);
      root.add(rw);
      wheels.push(rw);
    });

    return { group: root, chassisGroup, wheels, frontWheels, primaryMats, baseColorHex };
  }

  if (spec.id === 'mtc_bus') {
    const redMat = new THREE.MeshPhysicalMaterial({
      color: baseColorHex,
      roughness: 0.22,
      metalness: 0.48,
      clearcoat: 0.92,
      clearcoatRoughness: 0.08,
    });
    primaryMats.push(redMat);

    const whiteStripeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.48,
      metalness: 0.18,
    });

    const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.45, 2.75), redMat);
    lowerHull.position.set(0, 1.15, 0);
    lowerHull.castShadow = castShadow;
    lowerHull.receiveShadow = castShadow;
    chassisGroup.add(lowerHull);

    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.25, 2.68), whiteStripeMat);
    upperCabin.position.set(-0.04, 2.45, 0);
    upperCabin.castShadow = castShadow;
    chassisGroup.add(upperCabin);

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.82, 2.72), glassMat);
    sideGlass.position.set(-0.1, 2.5, 0);
    chassisGroup.add(sideGlass);

    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 2.45), glassMat);
    frontGlass.position.set(4.24, 2.38, 0);
    chassisGroup.add(frontGlass);

    const acPodMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.65 });
    const acPod1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 1.6), acPodMat);
    acPod1.position.set(1.2, 3.2, 0);
    chassisGroup.add(acPod1);

    const acPod2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 1.6), acPodMat);
    acPod2.position.set(-1.8, 3.2, 0);
    chassisGroup.add(acPod2);

    const boardMat = new THREE.MeshBasicMaterial({
      map: getBusDestinationTexture(maxAnisotropy),
    });
    const destBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.44), boardMat);
    destBoard.position.set(4.28, 2.92, 0);
    destBoard.rotation.y = Math.PI / 2;
    chassisGroup.add(destBoard);

    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 2.84), chromeMat);
    fBumper.position.set(4.32, 0.62, 0);
    chassisGroup.add(fBumper);

    [-1.0, 1.0].forEach((zOff) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.42), headlightMat);
      hl.position.set(4.32, 0.98, zOff);
      chassisGroup.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.36), taillightMat);
      tl.position.set(-4.32, 1.05, zOff);
      chassisGroup.add(tl);
    });

    [2.75, -1.65, -2.95].forEach((xPos, idx) => {
      [-1.38, 1.38].forEach((zPos) => {
        const w = createWheelAssembly(0.56, 0.36, castShadow);
        w.position.set(xPos, 0.56, zPos);
        root.add(w);
        wheels.push(w);
        if (idx === 0) frontWheels.push(w);
      });
    });

    return { group: root, chassisGroup, wheels, frontWheels, primaryMats, baseColorHex };
  }

  if (spec.id === 'ecr_bike') {
    const bikeMat = new THREE.MeshPhysicalMaterial({
      color: baseColorHex,
      roughness: 0.16,
      metalness: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    primaryMats.push(bikeMat);

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.52,
      metalness: 0.6,
    });

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.65, 0.52), frameMat);
    engineBlock.position.set(0, 0.68, 0);
    engineBlock.castShadow = castShadow;
    chassisGroup.add(engineBlock);

    const fairing = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.52, 0.64), bikeMat);
    fairing.position.set(0.32, 1.02, 0);
    fairing.rotation.z = -0.18;
    fairing.castShadow = castShadow;
    chassisGroup.add(fairing);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.28, 0.46), bikeMat);
    tail.position.set(-0.75, 1.08, 0);
    tail.rotation.z = 0.26;
    chassisGroup.add(tail);

    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.15,
    });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 6, 12), jacketMat);
    torso.position.set(-0.18, 1.48, 0);
    torso.rotation.z = -0.52;
    torso.castShadow = castShadow;
    chassisGroup.add(torso);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), bikeMat);
    helmet.position.set(0.12, 1.86, 0);
    chassisGroup.add(helmet);

    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.9, 10).rotateZ(Math.PI / 2.3),
      chromeMat
    );
    exhaust.position.set(-0.65, 0.72, 0.32);
    chassisGroup.add(exhaust);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.34), headlightMat);
    hl.position.set(1.12, 1.05, 0);
    chassisGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.26), taillightMat);
    tl.position.set(-1.2, 1.16, 0);
    chassisGroup.add(tl);

    const fw = createWheelAssembly(0.42, 0.22, castShadow);
    fw.position.set(0.98, 0.42, 0);
    root.add(fw);
    wheels.push(fw);
    frontWheels.push(fw);

    const rw = createWheelAssembly(0.44, 0.28, castShadow);
    rw.position.set(-0.92, 0.44, 0);
    root.add(rw);
    wheels.push(rw);

    return { group: root, chassisGroup, wheels, frontWheels, primaryMats, baseColorHex };
  }

  // ==========================================================================
  // MARINA GT CLASSIC SEDAN & GREATER CHENNAI POLICE SUV
  // ==========================================================================
  const isPolice = spec.id === 'police_suv';
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: baseColorHex,
    roughness: 0.18,
    metalness: 0.72,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    anisotropy: 0.35,
  });
  primaryMats.push(bodyMat);

  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.secondaryColor).getHex(),
    roughness: 0.48,
    metalness: 0.42,
  });

  const bodyLength = isPolice ? 4.88 : 5.12;
  const bodyHeight = isPolice ? 0.92 : 0.76;
  const bodyWidth = isPolice ? 2.28 : 2.18;

  const lowerBody = new THREE.Mesh(
    new THREE.BoxGeometry(bodyLength, bodyHeight, bodyWidth),
    bodyMat
  );
  lowerBody.position.set(0, 0.78, 0);
  lowerBody.castShadow = castShadow;
  lowerBody.receiveShadow = castShadow;
  chassisGroup.add(lowerBody);

  const sideStripe = new THREE.Mesh(
    new THREE.BoxGeometry(bodyLength * 0.92, 0.24, bodyWidth + 0.04),
    trimMat
  );
  sideStripe.position.set(0, 0.82, 0);
  chassisGroup.add(sideStripe);

  const cabinLength = isPolice ? 2.85 : 2.48;
  const cabinHeight = isPolice ? 0.82 : 0.66;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(cabinLength, cabinHeight, bodyWidth * 0.86),
    bodyMat
  );
  cabin.position.set(
    isPolice ? -0.35 : -0.2,
    0.78 + bodyHeight / 2 + cabinHeight / 2 - 0.05,
    0
  );
  cabin.castShadow = castShadow;
  chassisGroup.add(cabin);

  const glassBox = new THREE.Mesh(
    new THREE.BoxGeometry(cabinLength + 0.06, cabinHeight * 0.76, bodyWidth * 0.88),
    glassMat
  );
  glassBox.position.copy(cabin.position);
  chassisGroup.add(glassBox);

  // Side Wing Mirrors + Door Handles
  [-bodyWidth * 0.52, bodyWidth * 0.52].forEach((zMirror) => {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.24), bodyMat);
    mirror.position.set(0.68, 1.24, zMirror);
    chassisGroup.add(mirror);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.06), chromeMat);
    handle.position.set(0.1, 1.02, zMirror * 0.98);
    chassisGroup.add(handle);
  });

  // Front Grille + Bumpers + Tamil Nadu Registration Plates
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, bodyWidth * 0.52),
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.4, metalness: 0.8 })
  );
  grille.position.set(bodyLength / 2 + 0.02, 0.82, 0);
  chassisGroup.add(grille);

  const frontBumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.3, bodyWidth + 0.08),
    chromeMat
  );
  frontBumper.position.set(bodyLength / 2 + 0.06, 0.55, 0);
  chassisGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.3, bodyWidth + 0.08),
    chromeMat
  );
  rearBumper.position.set(-bodyLength / 2 - 0.05, 0.55, 0);
  chassisGroup.add(rearBumper);

  const fPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.15), plateMat);
  fPlate.position.set(bodyLength / 2 + 0.19, 0.56, 0);
  fPlate.rotation.y = Math.PI / 2;
  chassisGroup.add(fPlate);

  const rPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.15), plateMat);
  rPlate.position.set(-bodyLength / 2 - 0.17, 0.56, 0);
  rPlate.rotation.y = -Math.PI / 2;
  chassisGroup.add(rPlate);

  [-bodyWidth * 0.35, bodyWidth * 0.35].forEach((zOff) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.38), headlightMat);
    hl.position.set(bodyLength / 2 + 0.02, 0.86, zOff);
    chassisGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.42), taillightMat);
    tl.position.set(-bodyLength / 2 - 0.02, 0.86, zOff);
    chassisGroup.add(tl);
  });

  let sirenLeftMat: THREE.MeshStandardMaterial | undefined;
  let sirenRightMat: THREE.MeshStandardMaterial | undefined;

  if (isPolice) {
    sirenLeftMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.4,
      roughness: 0.15,
    });
    sirenRightMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.2,
      roughness: 0.15,
    });

    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 1.45), chromeMat);
    barBase.position.set(-0.1, 2.06, 0);
    chassisGroup.add(barBase);

    const leftPod = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.58), sirenLeftMat);
    leftPod.position.set(-0.1, 2.16, -0.38);
    chassisGroup.add(leftPod);

    const rightPod = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.58), sirenRightMat);
    rightPod.position.set(-0.1, 2.16, 0.38);
    chassisGroup.add(rightPod);

    const spare = createWheelAssembly(0.42, 0.24, castShadow);
    spare.rotation.y = Math.PI / 2;
    spare.position.set(-bodyLength / 2 - 0.14, 1.15, 0);
    chassisGroup.add(spare);
  } else {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, bodyWidth * 0.85), trimMat);
    spoiler.position.set(-bodyLength / 2 + 0.25, 1.32, 0);
    chassisGroup.add(spoiler);

    const vipBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.18, 12),
      taillightMat
    );
    vipBeacon.position.set(0.15, 1.88, 0);
    chassisGroup.add(vipBeacon);
  }

  const wheelRadius = isPolice ? 0.48 : 0.44;
  const wheelX = bodyLength * 0.31;
  const wheelZ = bodyWidth * 0.48;
  [
    [wheelX, -wheelZ, true],
    [wheelX, wheelZ, true],
    [-wheelX, -wheelZ, false],
    [-wheelX, wheelZ, false],
  ].forEach(([wx, wz, isFront]) => {
    const w = createWheelAssembly(wheelRadius, 0.3, castShadow);
    w.position.set(wx as number, wheelRadius, wz as number);
    root.add(w);
    wheels.push(w);
    if (isFront) frontWheels.push(w);
  });

  return {
    group: root,
    chassisGroup,
    wheels,
    frontWheels,
    sirenLeftMat,
    sirenRightMat,
    primaryMats,
    baseColorHex,
  };
}
