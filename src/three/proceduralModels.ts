import * as THREE from 'three';
import { VehicleId, VehicleSpec } from '../types/game';

// Create procedural asphalt road texture with lane markings
export function createAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#181c24';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain noise
  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 22 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgb(${v}, ${v + 3}, ${v + 8})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Road grid lines (East-West and North-South avenues every tile)
  ctx.fillStyle = '#10131a';
  ctx.fillRect(180, 0, 152, 512);
  ctx.fillRect(0, 180, 512, 152);

  // Sidewalk curbs
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.strokeRect(180, -4, 152, 520);
  ctx.strokeRect(-4, 180, 520, 152);

  // Yellow center median double lines (Indian highway style)
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 18]);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  // White lane edge markings
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 20]);
  ctx.beginPath();
  ctx.moveTo(216, 0);
  ctx.lineTo(216, 512);
  ctx.moveTo(296, 0);
  ctx.lineTo(296, 512);
  ctx.moveTo(0, 216);
  ctx.lineTo(512, 216);
  ctx.moveTo(0, 296);
  ctx.lineTo(512, 296);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(36, 36);
  texture.anisotropy = maxAnisotropy;
  return texture;
}

// Create procedural Chennai building facade texture
export function createBuildingFacadeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 256, 512);

  // Horizontal floor bands
  for (let y = 16; y < 490; y += 32) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, y - 4, 256, 4);

    for (let x = 16; x < 240; x += 28) {
      const lit = Math.random() > 0.38;
      if (lit) {
        ctx.fillStyle = Math.random() > 0.25 ? '#fef08a' : '#38bdf8';
      } else {
        ctx.fillStyle = '#090d16';
      }
      ctx.fillRect(x, y, 18, 20);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

// Create radial contact shadow texture so vehicles & characters sit grounded on asphalt
let cachedShadowTex: THREE.CanvasTexture | null = null;
export function getContactShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTex) return cachedShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedShadowTex = new THREE.CanvasTexture(canvas);
  cachedShadowTex.colorSpace = THREE.SRGBColorSpace;
  return cachedShadowTex;
}

// Build a composite 8–12 part 3D Vehicle Mesh Group (bottom-center pivot y=0)
export function buildVehicle3DGroup(
  spec: VehicleSpec,
  isSoftwareGl: boolean
): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  sirenBar: THREE.Group | null;
  bodyMaterials: THREE.MeshStandardMaterial[];
} {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const bodyMaterials: THREE.MeshStandardMaterial[] = [];
  let sirenBar: THREE.Group | null = null;

  // Convert 2D spec dimensions to 3D meters (1 unit = 1 meter)
  const length = spec.length * 0.12;
  const width = spec.width * 0.11;

  // Contact shadow plane grounded at y = 0.03
  const shadowGeo = new THREE.PlaneGeometry(length * 1.35, width * 1.45);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);

  // Materials across varied roughness/metalness scales
  const primaryPaintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(spec.primaryColor),
    metalness: 0.65,
    roughness: 0.25,
    clearcoat: isSoftwareGl ? 0 : 0.9,
    clearcoatRoughness: 0.12,
  });
  bodyMaterials.push(primaryPaintMat);

  const secondaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.secondaryColor),
    metalness: 0.25,
    roughness: 0.65,
  });
  bodyMaterials.push(secondaryMat);

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.15,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.1,
    roughness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.75,
    transparent: true,
    opacity: isSoftwareGl ? 0.75 : 1.0,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.1,
    roughness: 0.85,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.accentColor),
    emissive: new THREE.Color(spec.accentColor),
    emissiveIntensity: 0.4,
    roughness: 0.35,
  });

  // Helper to add a wheel with hubcap
  const addWheel = (x: number, y: number, z: number, radius: number, thickness: number) => {
    const wGeo = new THREE.CylinderGeometry(radius, radius, thickness, 16);
    wGeo.rotateX(Math.PI / 2);
    const wMesh = new THREE.Mesh(wGeo, tireMat);
    wMesh.position.set(x, y, z);
    wMesh.castShadow = !isSoftwareGl;

    const hubGeo = new THREE.CylinderGeometry(radius * 0.52, radius * 0.52, thickness + 0.02, 12);
    hubGeo.rotateX(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, chromeMat);
    wMesh.add(hubMesh);

    group.add(wMesh);
    wheels.push(wMesh);
  };

  if (spec.id === 'auto_rickshaw') {
    // 1. Lower Black Chassis Tray
    const baseGeo = new THREE.BoxGeometry(length * 0.92, 0.32, width * 0.95);
    const baseMesh = new THREE.Mesh(baseGeo, secondaryMat);
    baseMesh.position.set(0, 0.38, 0);
    baseMesh.castShadow = !isSoftwareGl;
    group.add(baseMesh);

    // 2. Sculpted Yellow Rear & Mid Body Cowling
    const cowlGeo = new THREE.BoxGeometry(length * 0.62, 0.65, width);
    const cowlMesh = new THREE.Mesh(cowlGeo, primaryPaintMat);
    cowlMesh.position.set(-length * 0.14, 0.72, 0);
    cowlMesh.castShadow = !isSoftwareGl;
    group.add(cowlMesh);

    // 3. Tapered Front Nose Cone & Mudguard
    const noseGeo = new THREE.CylinderGeometry(width * 0.22, width * 0.44, 0.72, 12);
    const noseMesh = new THREE.Mesh(noseGeo, primaryPaintMat);
    noseMesh.position.set(length * 0.26, 0.68, 0);
    noseMesh.castShadow = !isSoftwareGl;
    group.add(noseMesh);

    // 4. Front Windshield Frame
    const windGeo = new THREE.BoxGeometry(0.08, 0.58, width * 0.78);
    const windMesh = new THREE.Mesh(windGeo, glassMat);
    windMesh.position.set(length * 0.22, 1.28, 0);
    windMesh.rotation.z = 0.18;
    group.add(windMesh);

    // 5. Iconic Curved Canvas Top Canopy (Black/Yellow hood)
    const canopyGeo = new THREE.BoxGeometry(length * 0.72, 0.16, width * 0.96);
    const canopyMesh = new THREE.Mesh(canopyGeo, secondaryMat);
    canopyMesh.position.set(-length * 0.06, 1.62, 0);
    canopyMesh.castShadow = !isSoftwareGl;
    group.add(canopyMesh);

    // 6. Canopy Support Pillars (4 pillars)
    const pillarGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.65, 8);
    [
      [-length * 0.38, -width * 0.42],
      [-length * 0.38, width * 0.42],
      [length * 0.18, -width * 0.38],
      [length * 0.18, width * 0.38],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(pillarGeo, chromeMat);
      p.position.set(px, 1.28, pz);
      group.add(p);
    });

    // 7. Green Meter Box & Bumper Accent
    const meterGeo = new THREE.BoxGeometry(0.22, 0.18, 0.22);
    const meterMesh = new THREE.Mesh(meterGeo, accentMat);
    meterMesh.position.set(length * 0.14, 0.96, 0.25);
    group.add(meterMesh);

    // 8. 3-Wheeler Layout (1 Front Center Wheel, 2 Rear Wheels)
    addWheel(length * 0.36, 0.28, 0, 0.28, 0.16);
    addWheel(-length * 0.3, 0.28, -width * 0.48, 0.28, 0.16);
    addWheel(-length * 0.3, 0.28, width * 0.48, 0.28, 0.16);

    // 9. Headlight & Taillights
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), headlightMat);
    hl.rotation.z = Math.PI / 2;
    hl.position.set(length * 0.41, 0.65, 0);
    group.add(hl);
  } else if (spec.id === 'mtc_bus') {
    // 1. Massive MTC Red Bus Hull
    const bodyGeo = new THREE.BoxGeometry(length, 1.65, width);
    const bodyMesh = new THREE.Mesh(bodyGeo, primaryPaintMat);
    bodyMesh.position.set(0, 1.15, 0);
    bodyMesh.castShadow = !isSoftwareGl;
    group.add(bodyMesh);

    // 2. White Roof Cap & AC Pods
    const roofGeo = new THREE.BoxGeometry(length * 0.98, 0.22, width * 0.96);
    const roofMesh = new THREE.Mesh(roofGeo, secondaryMat);
    roofMesh.position.set(0, 2.05, 0);
    group.add(roofMesh);

    const acPodGeo = new THREE.BoxGeometry(length * 0.35, 0.18, width * 0.65);
    const acPod = new THREE.Mesh(acPodGeo, chromeMat);
    acPod.position.set(0.3, 2.22, 0);
    group.add(acPod);

    // 3. Panoramic Side & Front Windows Band
    const winBandGeo = new THREE.BoxGeometry(length * 0.94, 0.62, width * 1.02);
    const winBand = new THREE.Mesh(winBandGeo, glassMat);
    winBand.position.set(0.05, 1.42, 0);
    group.add(winBand);

    // 4. Glowing Amber Route Board ("21G BROADWAY")
    const boardGeo = new THREE.BoxGeometry(0.08, 0.24, width * 0.62);
    const boardMesh = new THREE.Mesh(boardGeo, accentMat);
    boardMesh.position.set(length * 0.505, 1.85, 0);
    group.add(boardMesh);

    // 5. 6 Heavy Transit Wheels
    addWheel(length * 0.32, 0.42, -width * 0.5, 0.42, 0.24);
    addWheel(length * 0.32, 0.42, width * 0.5, 0.42, 0.24);
    addWheel(-length * 0.12, 0.42, -width * 0.5, 0.42, 0.24);
    addWheel(-length * 0.12, 0.42, width * 0.5, 0.42, 0.24);
    addWheel(-length * 0.34, 0.42, -width * 0.5, 0.42, 0.24);
    addWheel(-length * 0.34, 0.42, width * 0.5, 0.42, 0.24);
  } else if (spec.id === 'ecr_bike') {
    // 1. Sportbike Frame & Cyan Fairing
    const frameGeo = new THREE.BoxGeometry(length * 0.72, 0.48, width * 0.55);
    const frameMesh = new THREE.Mesh(frameGeo, primaryPaintMat);
    frameMesh.position.set(0, 0.62, 0);
    frameMesh.castShadow = !isSoftwareGl;
    group.add(frameMesh);

    // 2. Rider Torso & Helmet Silhouette
    const riderTorso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.42, 6, 12),
      secondaryMat
    );
    riderTorso.position.set(-0.12, 1.08, 0);
    riderTorso.rotation.z = -0.38;
    group.add(riderTorso);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 14), primaryPaintMat);
    helmet.position.set(0.05, 1.42, 0);
    group.add(helmet);

    // 3. Chrome Exhaust Pipes
    const pipeGeo = new THREE.CylinderGeometry(0.05, 0.07, length * 0.55, 8);
    pipeGeo.rotateZ(Math.PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, chromeMat);
    pipe.position.set(-length * 0.22, 0.45, width * 0.32);
    group.add(pipe);

    // 4. 2 Sport Tires
    addWheel(length * 0.35, 0.34, 0, 0.34, 0.18);
    addWheel(-length * 0.35, 0.34, 0, 0.34, 0.22);
  } else {
    // Sedan / Police Interceptor SUV (8-10 part composite model)
    const isSuv = spec.id === 'police_suv';
    const hullHeight = isSuv ? 0.72 : 0.54;
    const cabinHeight = isSuv ? 0.62 : 0.46;

    // 1. Lower Sculpted Chassis Body
    const bodyGeo = new THREE.BoxGeometry(length, hullHeight, width);
    const bodyMesh = new THREE.Mesh(bodyGeo, primaryPaintMat);
    bodyMesh.position.set(0, 0.35 + hullHeight / 2, 0);
    bodyMesh.castShadow = !isSoftwareGl;
    group.add(bodyMesh);

    // 2. Upper Cabin Greenhouse
    const cabinLen = isSuv ? length * 0.64 : length * 0.52;
    const cabinGeo = new THREE.BoxGeometry(cabinLen, cabinHeight, width * 0.86);
    const cabinMesh = new THREE.Mesh(cabinGeo, primaryPaintMat);
    cabinMesh.position.set(-length * 0.06, 0.35 + hullHeight + cabinHeight / 2 - 0.04, 0);
    cabinMesh.castShadow = !isSoftwareGl;
    group.add(cabinMesh);

    // 3. Tinted Glass Windows Band
    const glassGeo = new THREE.BoxGeometry(cabinLen * 1.02, cabinHeight * 0.76, width * 0.88);
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.copy(cabinMesh.position);
    group.add(glassMesh);

    // 4. Front Chrome Grille & Bull-bar
    const grilleGeo = new THREE.BoxGeometry(0.12, hullHeight * 0.55, width * 0.72);
    const grilleMesh = new THREE.Mesh(grilleGeo, isSuv ? secondaryMat : chromeMat);
    grilleMesh.position.set(length / 2 + 0.02, 0.35 + hullHeight * 0.45, 0);
    group.add(grilleMesh);

    // 5. Side Livery Stripe
    const stripeGeo = new THREE.BoxGeometry(length * 0.96, 0.14, width * 1.02);
    const stripeMesh = new THREE.Mesh(stripeGeo, isSuv ? secondaryMat : accentMat);
    stripeMesh.position.set(0, 0.35 + hullHeight * 0.55, 0);
    group.add(stripeMesh);

    // 6. Police Strobe Lightbar on Roof
    if (isSuv) {
      sirenBar = new THREE.Group();
      sirenBar.position.set(-0.1, 0.35 + hullHeight + cabinHeight + 0.08, 0);

      const barBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.1, width * 0.68),
        chromeMat
      );
      const redPod = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.14, width * 0.28),
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 3.0,
        })
      );
      redPod.position.z = -width * 0.18;

      const bluePod = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.14, width * 0.28),
        new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          emissive: 0x3b82f6,
          emissiveIntensity: 3.0,
        })
      );
      bluePod.position.z = width * 0.18;

      sirenBar.add(barBase, redPod, bluePod);
      group.add(sirenBar);
    }

    // 7. 4 Wheels
    const wheelR = isSuv ? 0.38 : 0.33;
    addWheel(length * 0.31, wheelR, -width * 0.48, wheelR, 0.22);
    addWheel(length * 0.31, wheelR, width * 0.48, wheelR, 0.22);
    addWheel(-length * 0.31, wheelR, -width * 0.48, wheelR, 0.22);
    addWheel(-length * 0.31, wheelR, width * 0.48, wheelR, 0.22);
  }

  // Dual Headlights & Taillights for all multi-track vehicles
  if (spec.id !== 'auto_rickshaw' && spec.id !== 'ecr_bike') {
    const hlGeo = new THREE.BoxGeometry(0.1, 0.16, 0.28);
    const hlL = new THREE.Mesh(hlGeo, headlightMat);
    hlL.position.set(length / 2 + 0.02, 0.65, -width * 0.34);
    const hlR = hlL.clone();
    hlR.position.z = width * 0.34;
    group.add(hlL, hlR);

    const tlL = new THREE.Mesh(hlGeo, taillightMat);
    tlL.position.set(-length / 2 - 0.02, 0.65, -width * 0.34);
    const tlR = tlL.clone();
    tlR.position.z = width * 0.34;
    group.add(tlL, tlR);
  }

  return { group, wheels, sirenBar, bodyMaterials };
}

// Build an articulated 8-part 3D On-Foot Player Character ("Chennai Syndicate Protagonist")
export function buildPlayerCharacter3D(isSoftwareGl: boolean): {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
} {
  const group = new THREE.Group();

  // Contact shadow
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    new THREE.MeshBasicMaterial({
      map: getContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  group.add(shadowMesh);

  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // Iconic golden-amber street jacket
    roughness: 0.45,
    metalness: 0.15,
  });
  const denimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.55,
    metalness: 0.05,
  });
  const shadesMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    metalness: 0.9,
    roughness: 0.1,
  });

  // Legs
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.45, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, denimMat);
  leftLeg.position.set(0, 0.42, -0.15);
  leftLeg.castShadow = !isSoftwareGl;

  const rightLeg = new THREE.Mesh(legGeo, denimMat);
  rightLeg.position.set(0, 0.42, 0.15);
  rightLeg.castShadow = !isSoftwareGl;

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 0.48), jacketMat);
  torso.position.set(0, 1.05, 0);
  torso.castShadow = !isSoftwareGl;

  // Head + Sunglasses Visor
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), skinMat);
  head.position.set(0, 1.56, 0);
  head.castShadow = !isSoftwareGl;

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.32), shadesMat);
  visor.position.set(0.14, 1.58, 0);

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.085, 0.42, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, jacketMat);
  leftArm.position.set(0, 1.04, -0.32);

  const rightArm = new THREE.Mesh(armGeo, jacketMat);
  rightArm.position.set(0, 1.04, 0.32);

  group.add(leftLeg, rightLeg, torso, head, visor, leftArm, rightArm);

  return { group, leftLeg, rightLeg, leftArm, rightArm };
}
