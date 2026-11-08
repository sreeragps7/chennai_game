import * as THREE from 'three';
import { GraphicsQuality, TimeOfDayMode, WorldBuildingCollider } from '../types/game';

const BLOCK_SIZE = 72; // meters per city block
const GRID_RADIUS = 3; // 7x7 city blocks active around player

export interface ChennaiCityChunk {
  group: THREE.Group;
  baseGridX: number;
  baseGridZ: number;
}

export interface ChennaiEnvironmentRig {
  cityRoot: THREE.Group;
  marinaStaticRoot: THREE.Group;
  chunks: ChennaiCityChunk[];
  colliders: WorldBuildingCollider[];
  gpsRibbonMesh: THREE.Mesh;
  targetBeaconGroup: THREE.Group;
  oceanMesh: THREE.Mesh;
  surfFoamMesh: THREE.Mesh;
  surfFoamSecondaryMesh: THREE.Mesh;
  skyDomeMesh: THREE.Mesh;
  lighthouseBeamGroup: THREE.Group;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  updateAroundPlayer: (
    playerWorldX: number,
    playerWorldZ: number,
    timeSec: number,
    timeOfDay?: TimeOfDayMode
  ) => void;
  updateGpsRibbon: (pointsWorldXZ: Array<{ x: number; z: number }>, colorHex: number) => void;
  applyGraphicsQuality: (
    quality: GraphicsQuality,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    isSoftwareGl: boolean
  ) => void;
}

/**
 * Generates a coordinated 3-map PBR Road Texture Bundle:
 * 1) Albedo Map (sRGB) with weathered asphalt, tire wear tracks, manholes, storm drains, and yellow/black curbs
 * 2) Roughness Map (Linear) with polished specular tire tracks & oil patches vs rough concrete sidewalks
 * 3) Normal Map (Linear DataTexture) with asphalt micro-aggregate grain & curb bevels
 */
function createRoadPbrTextureBundle(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
} {
  // 1. Albedo Canvas (1024x1024)
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Weathered Chennai concrete sidewalk base
  ctx.fillStyle = '#263346';
  ctx.fillRect(0, 0, 1024, 1024);

  // Sidewalk paving slab grid seams
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 160; i <= 864; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 160);
    ctx.lineTo(i, 864);
    ctx.moveTo(160, i);
    ctx.lineTo(864, i);
    ctx.stroke();
  }

  // Inner building plot foundation pad with baked AO border
  const plotGrad = ctx.createRadialGradient(512, 512, 180, 512, 512, 380);
  plotGrad.addColorStop(0, '#0f172a');
  plotGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = plotGrad;
  ctx.fillRect(176, 176, 672, 672);

  // Iconic Chennai Yellow & Black painted concrete curb stones
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#facc15';
  ctx.strokeRect(166, 166, 692, 692);
  ctx.setLineDash([32, 32]);
  ctx.strokeStyle = '#090d16';
  ctx.strokeRect(166, 166, 692, 692);
  ctx.setLineDash([]);

  // Deep weathered asphalt road avenues (top, bottom, left, right)
  ctx.fillStyle = '#141c2b';
  ctx.fillRect(0, 0, 1024, 160);
  ctx.fillRect(0, 864, 1024, 160);
  ctx.fillRect(0, 0, 160, 1024);
  ctx.fillRect(864, 0, 160, 1024);

  // Subtle darker tire-track wear lanes
  ctx.fillStyle = 'rgba(9, 13, 22, 0.42)';
  ctx.fillRect(0, 28, 1024, 26);
  ctx.fillRect(0, 104, 1024, 26);
  ctx.fillRect(0, 892, 1024, 26);
  ctx.fillRect(0, 968, 1024, 26);
  ctx.fillRect(28, 0, 26, 1024);
  ctx.fillRect(104, 0, 26, 1024);
  ctx.fillRect(892, 0, 26, 1024);
  ctx.fillRect(968, 0, 26, 1024);

  // Asphalt micro-aggregate speckle & weathered cracks
  for (let i = 0; i < 1600; i++) {
    const rx = (i * 97) % 1024;
    const ry = (i * 181) % 1024;
    if (rx < 160 || rx > 864 || ry < 160 || ry > 864) {
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(rx, ry, 3, 3);
    }
  }

  // Cast-iron Manhole Covers in intersections
  [
    [80, 80],
    [944, 80],
    [80, 944],
    [944, 944],
  ].forEach(([mx, my]) => {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(mx, my, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  // Dashed white thermoplastic lane markings
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 5;
  ctx.setLineDash([36, 36]);
  ctx.beginPath();
  ctx.moveTo(160, 80);
  ctx.lineTo(864, 80);
  ctx.moveTo(160, 944);
  ctx.lineTo(864, 944);
  ctx.moveTo(80, 160);
  ctx.lineTo(80, 864);
  ctx.moveTo(944, 160);
  ctx.lineTo(944, 864);
  ctx.stroke();

  // Yellow double median center line
  ctx.setLineDash([]);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(176, 4);
  ctx.lineTo(848, 4);
  ctx.moveTo(4, 176);
  ctx.lineTo(4, 848);
  ctx.stroke();

  // Crisp Zebra pedestrian crossings at all 4 corners
  ctx.fillStyle = '#f8fafc';
  for (let i = 20; i < 140; i += 22) {
    ctx.fillRect(164, i, 28, 12);
    ctx.fillRect(832, i, 28, 12);
    ctx.fillRect(i, 164, 12, 28);
    ctx.fillRect(i, 832, 12, 28);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  // 2. Roughness Map Canvas (512x512, Linear space)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 512;
  rCanvas.height = 512;
  const rCtx = rCanvas.getContext('2d')!;
  // Base rough asphalt & concrete (roughness ~0.82 -> gray 210)
  rCtx.fillStyle = 'rgb(210, 210, 210)';
  rCtx.fillRect(0, 0, 512, 512);
  // Polished tire tracks & damp curb gutters (roughness ~0.32 -> gray 82)
  rCtx.fillStyle = 'rgb(82, 82, 82)';
  rCtx.fillRect(0, 14, 512, 14);
  rCtx.fillRect(0, 52, 512, 14);
  rCtx.fillRect(0, 446, 512, 14);
  rCtx.fillRect(0, 484, 512, 14);
  rCtx.fillRect(14, 0, 14, 512);
  rCtx.fillRect(52, 0, 14, 512);
  rCtx.fillRect(446, 0, 14, 512);
  rCtx.fillRect(484, 0, 14, 512);

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.anisotropy = maxAnisotropy;

  // 3. Procedural Asphalt Aggregate Normal Map (128x128 Linear DataTexture)
  const nSize = 128;
  const nData = new Uint8Array(nSize * nSize * 4);
  for (let y = 0; y < nSize; y++) {
    for (let x = 0; x < nSize; x++) {
      const idx = (y * nSize + x) * 4;
      const hashX = ((x * 73 + y * 31) % 29) - 14;
      const hashY = ((x * 19 + y * 97) % 29) - 14;
      nData[idx] = 128 + hashX;
      nData[idx + 1] = 128 + hashY;
      nData[idx + 2] = 242;
      nData[idx + 3] = 255;
    }
  }
  const normalMap = new THREE.DataTexture(nData, nSize, nSize, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(12, 12);
  normalMap.needsUpdate = true;

  return { map, roughnessMap, normalMap };
}

function createMarinaPromenadeTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 32) {
      const isAlt = ((x + y) / 32) % 2 === 0;
      ctx.fillStyle = isAlt ? '#b45309' : '#475569';
      ctx.fillRect(x + 2, y + 2, 28, 28);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 3, y + 3, 26, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 55);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSandShorelineTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#fde68a');
  grad.addColorStop(0.55, '#fcd34d');
  grad.addColorStop(0.82, '#b45309'); // Dark wet sand zone near surf
  grad.addColorStop(0.95, '#0369a1');
  grad.addColorStop(1, '#0284c7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Wind-blown sand ripples & organic beach micro-grain
  ctx.fillStyle = 'rgba(146, 64, 14, 0.14)';
  for (let i = 0; i < 900; i++) {
    ctx.fillRect((i * 73) % 490, (i * 139) % 512, 10, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBilingualSignboardTexture(
  tamilLine: string,
  englishLine: string,
  subTag: string,
  bgColor: string,
  borderColor: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 152);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tamilLine, 256, 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(englishLine, 256, 92);

  ctx.fillStyle = borderColor;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(subTag, 256, 132);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Generates a 3-map PBR Building Facade Texture Set:
 * - map (sRGB Albedo with concrete pilasters, recessed window frames, AC louvers, and Tamil/English storefront)
 * - roughnessMap (Linear: mirror-smooth glass 0.08 vs rough concrete stucco 0.85)
 * - emissiveMap (sRGB: glowing interior office/apartment windows + lit storefront signboard)
 */
function createBuildingPbrMaterial(
  bgColor: string,
  winColor: string,
  tamilBanner: string,
  englishBanner: string,
  bannerColor: string,
  maxAnisotropy: number
): THREE.MeshPhysicalMaterial {
  const cAlbedo = document.createElement('canvas');
  cAlbedo.width = 512;
  cAlbedo.height = 1024;
  const ctx = cAlbedo.getContext('2d')!;

  const cRough = document.createElement('canvas');
  cRough.width = 256;
  cRough.height = 512;
  const rCtx = cRough.getContext('2d')!;

  const cEmissive = document.createElement('canvas');
  cEmissive.width = 256;
  cEmissive.height = 512;
  const eCtx = cEmissive.getContext('2d')!;

  // Base Concrete Facade Wall
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 1024);

  // Rough concrete base in roughnessMap (roughness ~0.85 -> 218)
  rCtx.fillStyle = 'rgb(218, 218, 218)';
  rCtx.fillRect(0, 0, 256, 512);

  // Black base in emissiveMap
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 256, 512);

  // Horizontal concrete slab spandrel bands & vertical pilasters
  ctx.fillStyle = 'rgba(15, 23, 42, 0.48)';
  for (let r = 36; r < 820; r += 68) {
    ctx.fillRect(0, r - 8, 512, 8);
  }

  // Architectural Windows + Exterior Split-AC Louvers
  for (let r = 44; r < 810; r += 68) {
    for (let c = 32; c < 460; c += 72) {
      const lit = (r * 7 + c * 13) % 5 !== 0;

      // Dark window recess frame
      ctx.fillStyle = '#090d16';
      ctx.fillRect(c - 3, r - 3, 54, 44);

      // Window glass pane
      ctx.fillStyle = lit ? winColor : '#111c2d';
      ctx.fillRect(c, r, 48, 38);

      // Window curtain / blind detail on lit windows
      if (lit) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(c + 2, r + 2, 44, 12);
      }

      // Smooth reflective glass in roughnessMap (roughness ~0.08 -> 20)
      rCtx.fillStyle = 'rgb(20, 20, 20)';
      rCtx.fillRect(c / 2, r / 2, 24, 19);

      // Emissive window glow
      if (lit) {
        eCtx.fillStyle = winColor;
        eCtx.fillRect(c / 2, r / 2, 24, 19);
      }
    }
  }

  // Ground-floor dark granite storefront arcade + Tamil/English Neon Signboard
  ctx.fillStyle = '#090d16';
  ctx.fillRect(14, 842, 484, 160);
  ctx.strokeStyle = bannerColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 846, 476, 152);

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tamilBanner, 256, 896);

  ctx.fillStyle = bannerColor;
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(englishBanner, 256, 954);

  // Storefront neon glow in emissiveMap
  eCtx.fillStyle = bannerColor;
  eCtx.fillRect(12, 424, 232, 68);

  const map = new THREE.CanvasTexture(cAlbedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(cRough);
  roughnessMap.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(cEmissive);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return new THREE.MeshPhysicalMaterial({
    map,
    roughnessMap,
    roughness: 1.0,
    metalness: 0.28,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    emissive: new THREE.Color(0xffffff),
    emissiveMap,
    emissiveIntensity: 0.45,
  });
}

function createLandmarkBillboardMesh(
  tamilText: string,
  englishText: string,
  subTag: string,
  bgColor: string,
  borderColor: string,
  maxAnisotropy: number,
  width: number = 9,
  height: number = 2.8
): THREE.Mesh {
  const tex = createBilingualSignboardTexture(
    tamilText,
    englishText,
    subTag,
    bgColor,
    borderColor,
    maxAnisotropy
  );
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

/**
 * Realistic Chennai MTC Bus Shelter (`மாநகர பேருந்து நிறுத்தம்`)
 * with stainless steel columns, curved cantilever canopy, lit route map, and bench.
 */
function buildMtcBusShelter3D(castShadow: boolean, maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.88,
  });
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.2,
    metalness: 0.3,
    clearcoat: 0.9,
  });

  // 3 Rear Support Columns
  [-2.6, 0, 2.6].forEach((zOff) => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 10), steelMat);
    col.position.set(-0.7, 1.4, zOff);
    col.castShadow = castShadow;
    group.add(col);
  });

  // Cantilevered Curved Roof Canopy
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 6.2), roofMat);
  roof.position.set(0, 2.85, 0);
  roof.rotation.z = -0.06;
  roof.castShadow = castShadow;
  group.add(roof);

  // Stainless Steel Passenger Bench
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 4.2), steelMat);
  bench.position.set(-0.4, 0.55, 0);
  bench.castShadow = castShadow;
  group.add(bench);

  // Bilingual MTC Bus Stop Header Sign
  const sign = createLandmarkBillboardMesh(
    'மாநகர போக்குவரத்து கழகம் · பேருந்து நிறுத்தம்',
    'MTC BUS STOP · 21G / 109 / 27B',
    '[CHENNAI CORPORATION TRANSIT SHELTER]',
    '#0f172a',
    '#38bdf8',
    maxAnisotropy,
    5.8,
    0.65
  );
  sign.position.set(1.06, 2.85, 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  return group;
}

/**
 * Realistic Chennai Traffic Signal Gantry with Red / Amber / Green LED Lenses
 */
function buildTrafficSignalGantry3D(castShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.82,
  });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.6 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 10), poleMat);
  pole.position.y = 3.2;
  pole.castShadow = castShadow;
  group.add(pole);

  const mastArm = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.16), poleMat);
  mastArm.position.set(2.0, 6.1, 0);
  group.add(mastArm);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.15, 0.38), boxMat);
  housing.position.set(3.6, 5.8, 0);
  group.add(housing);

  const colors = [0xef4444, 0xf59e0b, 0x10b981];
  [0.32, 0, -0.32].forEach((yOff, idx) => {
    const lensMat = new THREE.MeshStandardMaterial({
      color: colors[idx],
      emissive: colors[idx],
      emissiveIntensity: idx === 2 ? 2.5 : 0.4,
    });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), lensMat);
    lens.position.set(3.6, 5.8 + yOff, 0.18);
    group.add(lens);
  });

  return group;
}

/**
 * Greater Chennai Police Steel Barricade (`சென்னை பெருநகர காவல்`)
 */
function buildPoliceBarricade3D(castShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.42,
    metalness: 0.5,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.45,
    metalness: 0.4,
  });

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 2.6), yellowMat);
  board.position.y = 0.82;
  board.castShadow = castShadow;
  group.add(board);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 2.58), blueMat);
  stripe.position.y = 0.82;
  group.add(stripe);

  [-1.1, 1.1].forEach((zLeg) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), yellowMat);
    leg.position.set(0, 0.6, zLeg);
    group.add(leg);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.12), blueMat);
    foot.position.set(0, 0.03, zLeg);
    group.add(foot);
  });

  return group;
}

/**
 * Composite 9-Part Marina Beach Lighthouse + Rotating Beam + Explicit Placeholder Plaque
 */
function buildMarinaLighthouseLandmark(
  castShadow: boolean,
  maxAnisotropy: number
): { group: THREE.Group; beamGroup: THREE.Group } {
  const group = new THREE.Group();

  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.72 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(14, 3.4, 14), plinthMat);
  plinth.position.y = 1.7;
  plinth.castShadow = castShadow;
  plinth.receiveShadow = castShadow;
  group.add(plinth);

  const redMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.38,
    clearcoat: 0.4,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.38,
    clearcoat: 0.4,
  });

  let yPos = 3.4;
  for (let band = 0; band < 7; band++) {
    const rBottom = 3.3 - band * 0.2;
    const rTop = 3.3 - (band + 1) * 0.2;
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, 4.2, 20),
      band % 2 === 0 ? redMat : whiteMat
    );
    cyl.position.y = yPos + 2.1;
    cyl.castShadow = castShadow;
    group.add(cyl);
    yPos += 4.2;
  }

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.2, 1.2, 20), plinthMat);
  gallery.position.y = yPos + 0.6;
  group.add(gallery);

  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 2.8,
    roughness: 0.1,
  });
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.8, 20), lanternMat);
  lantern.position.y = yPos + 2.5;
  group.add(lantern);

  const dome = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.0, 20), redMat);
  dome.position.y = yPos + 4.8;
  group.add(dome);

  const beamGroup = new THREE.Group();
  beamGroup.position.set(0, yPos + 2.5, 0);
  const coneGeo = new THREE.ConeGeometry(6.5, 38, 16, 1, true);
  coneGeo.translate(0, -19, 0);
  coneGeo.rotateZ(Math.PI / 2);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam1 = new THREE.Mesh(coneGeo, coneMat);
  const beam2 = new THREE.Mesh(coneGeo, coneMat);
  beam2.rotation.y = Math.PI;
  beamGroup.add(beam1, beam2);
  group.add(beamGroup);

  const sign = createLandmarkBillboardMesh(
    'மெரினா கலங்கரை விளக்கம்',
    'MARINA BEACH LIGHTHOUSE',
    '[ARCHITECTURAL PLACEHOLDER · KAMARAJAR SALAI]',
    '#0f172a',
    '#f59e0b',
    maxAnisotropy,
    10,
    3.0
  );
  sign.position.set(-7.2, 5.2, 0);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);

  return { group, beamGroup };
}

function buildPromenadeArchway3D(castShadow: boolean, maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.52 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.24,
    metalness: 0.84,
  });

  [-4.2, 4.2].forEach((zPos) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), stoneMat);
    base.position.set(0, 0.7, zPos);
    base.castShadow = castShadow;
    group.add(base);

    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 6.5, 14), stoneMat);
    col.position.set(0, 4.65, zPos);
    col.castShadow = castShadow;
    group.add(col);
  });

  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 11.2), stoneMat);
  archBeam.position.set(0, 8.4, 0);
  archBeam.castShadow = castShadow;
  group.add(archBeam);

  const goldCrest = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 1.2, 10), goldMat);
  goldCrest.position.set(0, 9.8, 0);
  group.add(goldCrest);

  const sign = createLandmarkBillboardMesh(
    'மெரினா கடற்கரை நடைபாதை',
    'MARINA BEACH PROMENADE',
    '[WELCOME TO CHENNAI · தமிழ்நாடு அரசு]',
    '#064e3b',
    '#10b981',
    maxAnisotropy,
    8.6,
    2.1
  );
  sign.position.set(-1.25, 8.4, 0);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);

  return group;
}

function buildMarinaFoodCart3D(castShadow: boolean): THREE.Group {
  const cart = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.82 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.62 });
  const lanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.5,
  });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 2.4), woodMat);
  counter.position.y = 0.75;
  counter.castShadow = castShadow;
  cart.add(counter);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.85, 4), canopyMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.45;
  cart.add(roof);

  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), lanternMat);
  lantern.position.set(0, 1.9, 0);
  cart.add(lantern);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12);
  wheelGeo.rotateX(Math.PI / 2);
  [
    [-0.65, -0.95],
    [0.65, -0.95],
    [-0.65, 0.95],
    [0.65, 0.95],
  ].forEach(([wx, wz]) => {
    const w = new THREE.Mesh(wheelGeo, woodMat);
    w.position.set(wx, 0.32, wz);
    cart.add(w);
  });

  return cart;
}

function buildFishingBoat3D(hullHex: number, castShadow: boolean): THREE.Group {
  const boat = new THREE.Group();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: hullHex,
    roughness: 0.42,
    clearcoat: 0.6,
  });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.85, 1.75), hullMat);
  hull.position.y = 0.45;
  hull.castShadow = castShadow;
  boat.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.8, 4), hullMat);
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.x = Math.PI / 4;
  bow.position.set(3.4, 0.55, 0);
  boat.add(bow);

  const bench1 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 1.65), deckMat);
  bench1.position.set(0.8, 0.9, 0);
  boat.add(bench1);

  const bench2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 1.65), deckMat);
  bench2.position.set(-1.1, 0.9, 0);
  boat.add(bench2);

  return boat;
}

function buildCentralTerminus3D(castShadow: boolean, maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const brickRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.58 });
  const trimWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.38 });
  const roofSlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });

  const mainHall = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 20), brickRedMat);
  mainHall.position.y = 6;
  mainHall.castShadow = castShadow;
  mainHall.receiveShadow = castShadow;
  group.add(mainHall);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(34.8, 1.0, 20.8), trimWhiteMat);
  cornice.position.y = 12.2;
  group.add(cornice);

  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 26, 8), brickRedMat);
  tower.position.set(0, 13, 5);
  tower.castShadow = castShadow;
  group.add(tower);

  const clockMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 1.6,
  });
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), clockMat);
  clockFace.position.set(0, 21.5, 9.08);
  group.add(clockFace);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(5.8, 8, 4), roofSlateMat);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(0, 30, 5);
  group.add(spire);

  const sign = createLandmarkBillboardMesh(
    'புரட்சித் தலைவர் டாக்டர் எம்.ஜி.ஆர் சென்ட்ரல்',
    'MGR CHENNAI CENTRAL TERMINUS',
    '[ARCHITECTURAL PLACEHOLDER · INDO-SARACENIC LANDMARK]',
    '#450a0a',
    '#facc15',
    maxAnisotropy,
    13,
    3.2
  );
  sign.position.set(0, 14.5, 10.6);
  group.add(sign);

  return group;
}

function buildAnnaSalaiLicTower3D(castShadow: boolean, maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const facadeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.16,
    metalness: 0.76,
    clearcoat: 1.0,
  });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.52 });

  const slab = new THREE.Mesh(new THREE.BoxGeometry(22, 42, 12), facadeMat);
  slab.position.y = 21;
  slab.castShadow = castShadow;
  slab.receiveShadow = castShadow;
  group.add(slab);

  [-11.1, 11.1].forEach((xOff) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 42.4, 12.6), concreteMat);
    fin.position.set(xOff, 21.2, 0);
    group.add(fin);
  });

  const sign = createLandmarkBillboardMesh(
    'அண்ணா சாலை · எல்.ஐ.சி கட்டிடம்',
    'ANNA SALAI (MOUNT ROAD) TOWER',
    '[ARCHITECTURAL PLACEHOLDER · MODERNIST HIGH-RISE]',
    '#0c4a6e',
    '#38bdf8',
    maxAnisotropy,
    12,
    3.0
  );
  sign.position.set(0, 44.2, 0);
  group.add(sign);

  return group;
}

function buildKathiparaFlyover3D(castShadow: boolean, maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.78 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });

  [
    [-10, -10],
    [10, -10],
    [-10, 10],
    [10, 10],
  ].forEach(([px, pz]) => {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 11, 14), concreteMat);
    pier.position.set(px, 5.5, pz);
    pier.castShadow = castShadow;
    group.add(pier);
  });

  const deckNS = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 34), deckMat);
  deckNS.position.set(0, 11.5, 0);
  deckNS.castShadow = castShadow;
  group.add(deckNS);

  const deckEW = new THREE.Mesh(new THREE.BoxGeometry(34, 1.4, 14), deckMat);
  deckEW.position.set(0, 13.1, 0);
  deckEW.castShadow = castShadow;
  group.add(deckEW);

  const sign = createLandmarkBillboardMesh(
    'கத்திப்பாரா மேம்பாலம் · கிண்டி',
    'KATHIPARA CLOVERLEAF FLYOVER',
    '[ARCHITECTURAL PLACEHOLDER · ELEVATED INTERCHANGE]',
    '#1e293b',
    '#f59e0b',
    maxAnisotropy,
    12,
    3.0
  );
  sign.position.set(0, 16.2, 0);
  group.add(sign);

  return group;
}

function buildOmrTechPark3D(castShadow: boolean, maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.1,
    metalness: 0.88,
    clearcoat: 1.0,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });

  [-8, 8].forEach((xPos) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 28, 16), glassMat);
    wing.position.set(xPos, 14, 0);
    wing.castShadow = castShadow;
    group.add(wing);
  });

  const skybridge = new THREE.Mesh(new THREE.BoxGeometry(18, 4.5, 8), frameMat);
  skybridge.position.set(0, 21, 0);
  group.add(skybridge);

  const sign = createLandmarkBillboardMesh(
    'ஓ.எம்.ஆர் டைடல் பார்க் · தகவல் தொழில்நுட்ப சாலை',
    'OMR IT CORRIDOR · TIDEL CAMPUS',
    '[ARCHITECTURAL PLACEHOLDER · RAJIV GANDHI SALAI]',
    '#082f49',
    '#38bdf8',
    maxAnisotropy,
    12,
    3.0
  );
  sign.position.set(0, 30.2, 0);
  group.add(sign);

  return group;
}

function buildTempleGopuram3D(castShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.78 });
  const wallBase = new THREE.Mesh(new THREE.BoxGeometry(28, 2.8, 28), wallMat);
  wallBase.position.y = 1.4;
  wallBase.castShadow = castShadow;
  wallBase.receiveShadow = castShadow;
  group.add(wallBase);

  const sanctumMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
  const sanctum = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 12), sanctumMat);
  sanctum.position.set(-3, 3, -3);
  sanctum.castShadow = castShadow;
  group.add(sanctum);

  const tierColors = [0xb45309, 0x0284c7, 0xdc2626, 0xca8a04, 0x0d9488, 0xf59e0b];
  let currentY = 2.5;
  for (let i = 0; i < 6; i++) {
    const w = 10.5 - i * 1.15;
    const d = 6.2 - i * 0.62;
    const h = 3.2;
    const tierMat = new THREE.MeshStandardMaterial({
      color: tierColors[i],
      roughness: 0.48,
      metalness: 0.22,
    });
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tierMat);
    tier.position.set(6, currentY + h / 2, 0);
    tier.castShadow = castShadow;
    group.add(tier);
    currentY += h;
  }

  const capMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.22,
    metalness: 0.88,
  });
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.4, 4.4, 12).rotateZ(Math.PI / 2),
    capMat
  );
  cap.position.set(6, currentY + 0.8, 0);
  group.add(cap);

  for (let z = -1.5; z <= 1.5; z += 0.75) {
    const kalasam = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 8), capMat);
    kalasam.position.set(6, currentY + 2.1, z);
    group.add(kalasam);
  }

  return group;
}

/**
 * Builds a GTA V-style Atmospheric Rayleigh/Mie Sky Dome with Solar Disc & Horizon Haze
 */
function createAtmosphericSkyDome(): {
  mesh: THREE.Mesh;
  uniforms: {
    topColor: { value: THREE.Color };
    midColor: { value: THREE.Color };
    horizonColor: { value: THREE.Color };
    sunDir: { value: THREE.Vector3 };
    sunColor: { value: THREE.Color };
  };
} {
  const uniforms = {
    topColor: { value: new THREE.Color(0x0f172a) },
    midColor: { value: new THREE.Color(0x4c1d95) },
    horizonColor: { value: new THREE.Color(0xf97316) },
    sunDir: { value: new THREE.Vector3(0.65, 0.28, 0.35).normalize() },
    sunColor: { value: new THREE.Color(0xfef08a) },
  };

  const skyGeo = new THREE.SphereGeometry(480, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldOffset;
      void main() {
        vWorldOffset = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldOffset;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;

      void main() {
        vec3 dir = normalize(vWorldOffset);
        float h = clamp(dir.y, 0.0, 1.0);

        vec3 sky = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
        sky = mix(sky, topColor, smoothstep(0.25, 0.85, h));

        // Solar disc + Mie atmospheric halo
        float sunCos = max(dot(dir, normalize(sunDir)), 0.0);
        float sunHalo = pow(sunCos, 16.0) * 0.48;
        float sunDisc = smoothstep(0.9965, 0.999, sunCos);

        sky += sunColor * (sunHalo + sunDisc * 1.6);
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(skyGeo, skyMat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

export function createChennai3DEnvironment(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): ChennaiEnvironmentRig {
  const cityRoot = new THREE.Group();
  scene.add(cityRoot);

  const marinaStaticRoot = new THREE.Group();
  scene.add(marinaStaticRoot);

  const colliders: WorldBuildingCollider[] = [];
  const castShadow = !isSoftwareGl;

  // 0. Physical Atmospheric Sky Dome
  const skyDome = createAtmosphericSkyDome();
  scene.add(skyDome.mesh);

  // 1. Lighting Rig: Physically Based Warm Chennai Sunlight + Cool Hemisphere Sky Fill
  const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.95);
  hemiLight.position.set(0, 90, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffedd5, 2.5);
  sunLight.position.set(80, 95, 45);
  sunLight.castShadow = castShadow;
  if (castShadow) {
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 95;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 270;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
  }
  scene.add(sunLight);
  scene.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
  rimLight.position.set(-60, 40, -50);
  scene.add(rimLight);

  // ==========================================================================
  // 2. DETAILED MARINA BEACH FIRST PLAYABLE NEIGHBORHOOD (X = +16m to +480m)
  // ==========================================================================
  const promTex = createMarinaPromenadeTileTexture(maxAnisotropy);
  const promGeo = new THREE.PlaneGeometry(20, 1200);
  promGeo.rotateX(-Math.PI / 2);
  const promMat = new THREE.MeshStandardMaterial({
    map: promTex,
    roughness: 0.68,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const promMesh = new THREE.Mesh(promGeo, promMat);
  promMesh.position.set(26, 0.04, 0);
  promMesh.receiveShadow = castShadow;
  marinaStaticRoot.add(promMesh);

  // Low Promenade Sea-Wall Parapet along X = 36m
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 });
  for (let z = -260; z <= 260; z += 40) {
    const wallSeg = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 28), parapetMat);
    wallSeg.position.set(36, 0.45, z);
    wallSeg.castShadow = castShadow;
    marinaStaticRoot.add(wallSeg);
  }

  // Wide Sandy Marina Beach Shoreline (`X = +36m to +126m`)
  const sandTex = createSandShorelineTexture(maxAnisotropy);
  const sandGeo = new THREE.PlaneGeometry(90, 1200);
  sandGeo.rotateX(-Math.PI / 2);
  const sandMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    roughness: 0.88,
    metalness: 0.04,
  });
  const sandMesh = new THREE.Mesh(sandGeo, sandMat);
  sandMesh.position.set(81, 0.02, 0);
  sandMesh.receiveShadow = castShadow;
  marinaStaticRoot.add(sandMesh);

  // Marina Lighthouse Landmark at (X = 48, Z = 44)
  const lighthouseObj = buildMarinaLighthouseLandmark(castShadow, maxAnisotropy);
  lighthouseObj.group.position.set(48, 0, 44);
  marinaStaticRoot.add(lighthouseObj.group);
  colliders.push({
    id: 'collider_marina_lighthouse',
    minX: 40,
    maxX: 56,
    minZ: 36,
    maxZ: 52,
    height: 36,
    label: 'Marina Beach Lighthouse [Architectural Placeholder]',
    tamilLabel: 'மெரினா கலங்கரை விளக்கம்',
    isPlaceholder: true,
  });

  // Marina Promenade Memorial Archway at (X = 25, Z = -28)
  const archGroup = buildPromenadeArchway3D(castShadow, maxAnisotropy);
  archGroup.position.set(25, 0, -28);
  marinaStaticRoot.add(archGroup);
  colliders.push({
    id: 'collider_promenade_arch_left',
    minX: 23.5,
    maxX: 26.5,
    minZ: -33.5,
    maxZ: -31.0,
    height: 9,
    label: 'Marina Promenade Arch [Placeholder]',
    tamilLabel: 'மெரினா கடற்கரை வளைவு',
    isPlaceholder: true,
  });
  colliders.push({
    id: 'collider_promenade_arch_right',
    minX: 23.5,
    maxX: 26.5,
    minZ: -25.0,
    maxZ: -22.5,
    height: 9,
    label: 'Marina Promenade Arch [Placeholder]',
    tamilLabel: 'மெரினா கடற்கரை வளைவு',
    isPlaceholder: true,
  });

  // Realistic MTC Bus Shelters, Traffic Signal Gantries, & Police Barricades along Kamarajar Salai
  [-48, 32, 112].forEach((zStop) => {
    const shelter = buildMtcBusShelter3D(castShadow, maxAnisotropy);
    shelter.position.set(15.2, 0, zStop);
    marinaStaticRoot.add(shelter);
  });

  [-72, 0, 72, 144].forEach((zSig) => {
    const sig = buildTrafficSignalGantry3D(castShadow);
    sig.position.set(-14.5, 0, zSig + 14);
    marinaStaticRoot.add(sig);
  });

  [-36, 36].forEach((zBar) => {
    const bar = buildPoliceBarricade3D(castShadow);
    bar.position.set(0, 0, zBar);
    bar.rotation.y = Math.PI / 2;
    marinaStaticRoot.add(bar);
  });

  // Promenade Statues on Stone Pedestals
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.58 });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.25,
    metalness: 0.88,
  });
  [-95, -55, 12, 85].forEach((zStatue, idx) => {
    const statGroup = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 2.4), pedestalMat);
    ped.position.y = 1.4;
    ped.castShadow = castShadow;
    statGroup.add(ped);

    const fig = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 2.6, 12), bronzeMat);
    fig.position.y = 4.1;
    fig.castShadow = castShadow;
    statGroup.add(fig);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), bronzeMat);
    head.position.y = 5.65;
    statGroup.add(head);

    statGroup.position.set(21, 0, zStatue);
    marinaStaticRoot.add(statGroup);

    colliders.push({
      id: `collider_statue_${idx}`,
      minX: 19.5,
      maxX: 22.5,
      minZ: zStatue - 1.5,
      maxZ: zStatue + 1.5,
      height: 6,
      label: 'Promenade Heritage Statue [Placeholder]',
      tamilLabel: 'மெரினா சிலை',
      isPlaceholder: true,
    });
  });

  // Marina Sundal & Bajji Beach Food Carts & Colorful Fishing Boats on the Sand
  [-65, -18, 24, 68, 115].forEach((zCart) => {
    const cart = buildMarinaFoodCart3D(castShadow);
    cart.position.set(39, 0, zCart);
    marinaStaticRoot.add(cart);
  });

  const boatColors = [0x0284c7, 0xea580c, 0x16a34a, 0xdc2626, 0x2563eb];
  [-110, -70, -25, 18, 62, 105, 145].forEach((zBoat, i) => {
    const boat = buildFishingBoat3D(boatColors[i % boatColors.length], castShadow);
    boat.position.set(78 + (i % 3) * 8, 0, zBoat);
    boat.rotation.y = -0.25 + (i % 3) * 0.22;
    marinaStaticRoot.add(boat);
  });

  // Multi-Tiered Tropical Coconut Palm Grove (`InstancedMesh`, 72 palms)
  const PALM_COUNT = 72;
  const palmTrunkGeo = new THREE.CylinderGeometry(0.18, 0.34, 7.2, 8);
  palmTrunkGeo.translate(0, 3.6, 0);
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, PALM_COUNT);

  const palmCrownLowerGeo = new THREE.ConeGeometry(3.1, 1.8, 7);
  palmCrownLowerGeo.translate(0, 6.8, 0);
  const palmCrownUpperGeo = new THREE.ConeGeometry(2.3, 1.9, 7);
  palmCrownUpperGeo.translate(0, 7.6, 0);
  const palmCrownMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
  const palmCrownLowerInst = new THREE.InstancedMesh(palmCrownLowerGeo, palmCrownMat, PALM_COUNT);
  const palmCrownUpperInst = new THREE.InstancedMesh(palmCrownUpperGeo, palmCrownMat, PALM_COUNT);

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < PALM_COUNT; i++) {
    const pz = -260 + i * 7.4;
    const px = i % 2 === 0 ? 18.2 : 34.5;
    const sc = 0.85 + ((i * 7) % 5) * 0.08;
    dummy.position.set(px, 0, pz);
    dummy.rotation.set(0, (i * 1.1) % (Math.PI * 2), 0.05);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    palmTrunkInst.setMatrixAt(i, dummy.matrix);
    palmCrownLowerInst.setMatrixAt(i, dummy.matrix);

    dummy.rotation.y += 0.45;
    dummy.updateMatrix();
    palmCrownUpperInst.setMatrixAt(i, dummy.matrix);

    tint.setHSL(0.33 + ((i % 3) - 1) * 0.02, 0.72, 0.27 + (i % 4) * 0.035);
    palmCrownLowerInst.setColorAt(i, tint);
    palmCrownUpperInst.setColorAt(i, tint);
  }
  palmTrunkInst.computeBoundingSphere();
  palmCrownLowerInst.computeBoundingSphere();
  palmCrownUpperInst.computeBoundingSphere();
  marinaStaticRoot.add(palmTrunkInst, palmCrownLowerInst, palmCrownUpperInst);

  // ==========================================================================
  // CUSTOM GLSL onBeforeCompile PBR BAY OF BENGAL OCEAN + DUAL SURF FOAM
  // ==========================================================================
  const oceanGeo = new THREE.PlaneGeometry(900, 1400, 48, 64);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanUniforms = {
    uTime: { value: 0 },
  };
  const oceanMat = new THREE.MeshPhysicalMaterial({
    color: 0x0369a1,
    roughness: 0.14,
    metalness: 0.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  if (!isSoftwareGl) {
    oceanMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = oceanUniforms.uTime;
      shader.vertexShader =
        `uniform float uTime;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float wave1 = sin(transformed.x * 0.09 + uTime * 2.1) * 0.35;
          float wave2 = cos(transformed.z * 0.06 + uTime * 1.6) * 0.25;
          transformed.y += wave1 + wave2;
          `
        );
    };
  }

  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.set(570, -0.05, 0);
  scene.add(oceanMesh);

  // Primary & Secondary Breaking White Surf Foam Waves
  const surfGeo = new THREE.PlaneGeometry(5.5, 1200);
  surfGeo.rotateX(-Math.PI / 2);
  const surfMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const surfFoamMesh = new THREE.Mesh(surfGeo, surfMat);
  surfFoamMesh.position.set(122, 0.06, 0);
  scene.add(surfFoamMesh);

  const surfMat2 = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const surfFoamSecondaryMesh = new THREE.Mesh(surfGeo, surfMat2);
  surfFoamSecondaryMesh.position.set(127, 0.05, 0);
  scene.add(surfFoamSecondaryMesh);

  colliders.push({
    id: 'collider_bay_of_bengal_deep_water',
    minX: 128,
    maxX: 950,
    minZ: -900,
    maxZ: 900,
    height: 10,
    label: 'Bay of Bengal Shoreline Boundary',
    tamilLabel: 'வங்காள விரிகுடா கடல் எல்லை',
    isPlaceholder: false,
  });

  // ==========================================================================
  // 3. FIXED ANCHOR LANDMARKS FOR ALL 8 CHENNAI NEIGHBORHOODS
  // ==========================================================================
  const licGroup = buildAnnaSalaiLicTower3D(castShadow, maxAnisotropy);
  licGroup.position.set(-144, 0, -72);
  marinaStaticRoot.add(licGroup);
  colliders.push({
    id: 'collider_anna_salai_lic',
    minX: -156,
    maxX: -132,
    minZ: -79,
    maxZ: -65,
    height: 44,
    label: 'Anna Salai Modernist High-Rise [Architectural Placeholder]',
    tamilLabel: 'அண்ணா சாலை எல்.ஐ.சி கட்டிடம் [மாதிரி]',
    isPlaceholder: true,
  });

  const centralGroup = buildCentralTerminus3D(castShadow, maxAnisotropy);
  centralGroup.position.set(-144, 0, -216);
  marinaStaticRoot.add(centralGroup);
  colliders.push({
    id: 'collider_chennai_central',
    minX: -162,
    maxX: -126,
    minZ: -227,
    maxZ: -205,
    height: 32,
    label: 'MGR Chennai Central Terminus [Architectural Placeholder]',
    tamilLabel: 'எம்.ஜி.ஆர் சென்ட்ரல் ரயில் நிலையம் [மாதிரி]',
    isPlaceholder: true,
  });

  const tnagarGroup = buildTempleGopuram3D(castShadow);
  tnagarGroup.position.set(-216, 0, 72);
  const tnagarSign = createLandmarkBillboardMesh(
    'தி. நகர் · பாண்டி பஜார் பட்டு மாளிகை',
    'T. NAGAR PONDY BAZAAR PLAZA',
    '[ARCHITECTURAL PLACEHOLDER · SHOPPING DISTRICT]',
    '#31102f',
    '#f43f5e',
    maxAnisotropy,
    12,
    3.0
  );
  tnagarSign.position.set(0, 24.5, 14.2);
  tnagarGroup.add(tnagarSign);
  marinaStaticRoot.add(tnagarGroup);
  colliders.push({
    id: 'collider_tnagar_plaza',
    minX: -230,
    maxX: -202,
    minZ: 58,
    maxZ: 86,
    height: 24,
    label: 'T. Nagar Pondy Bazaar Plaza [Architectural Placeholder]',
    tamilLabel: 'தி. நகர் பாண்டி பஜார் [மாதிரி]',
    isPlaceholder: true,
  });

  const kathiparaGroup = buildKathiparaFlyover3D(castShadow, maxAnisotropy);
  kathiparaGroup.position.set(-288, 0, 216);
  marinaStaticRoot.add(kathiparaGroup);
  colliders.push({
    id: 'collider_kathipara_piers',
    minX: -300,
    maxX: -276,
    minZ: 204,
    maxZ: 228,
    height: 15,
    label: 'Kathipara Cloverleaf Flyover [Architectural Placeholder]',
    tamilLabel: 'கத்திப்பாரா மேம்பாலம் [மாதிரி]',
    isPlaceholder: true,
  });

  const omrGroup = buildOmrTechPark3D(castShadow, maxAnisotropy);
  omrGroup.position.set(-72, 0, 288);
  marinaStaticRoot.add(omrGroup);
  colliders.push({
    id: 'collider_omr_tidel',
    minX: -86,
    maxX: -58,
    minZ: 279,
    maxZ: 297,
    height: 30,
    label: 'OMR IT Corridor Tech Campus [Architectural Placeholder]',
    tamilLabel: 'ஓ.எம்.ஆர் டைடல் பார்க் [மாதிரி]',
    isPlaceholder: true,
  });

  const guindySign = createLandmarkBillboardMesh(
    'கிண்டி தேசிய பூங்கா · சர்தார் படேல் சாலை',
    'GUINDY NATIONAL PARK RESERVE',
    '[TROPICAL FOREST ZONE · CHENNAI]',
    '#064e3b',
    '#10b981',
    maxAnisotropy,
    12,
    3.0
  );
  guindySign.position.set(-144, 6.5, 216);
  marinaStaticRoot.add(guindySign);

  const adyarSign = createLandmarkBillboardMesh(
    'அடையாறு திரு. வி. க. பாலம் & பெசன்ட் நகர்',
    'ADYAR ESTUARY & BESANT NAGAR LINK',
    '[COASTAL CORRIDOR · SOUTH CHENNAI]',
    '#0c4a6e',
    '#38bdf8',
    maxAnisotropy,
    12,
    3.0
  );
  adyarSign.position.set(16, 6.5, 216);
  adyarSign.rotation.y = -Math.PI / 2;
  marinaStaticRoot.add(adyarSign);

  // ==========================================================================
  // 4. CHUNKED STREAMING 7x7 CHENNAI CITY BLOCKS WITH PBR ROADS & FACADES
  // ==========================================================================
  const roadPbr = createRoadPbrTextureBundle(maxAnisotropy);
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadPbr.map,
    roughnessMap: roadPbr.roughnessMap,
    normalMap: roadPbr.normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 1.0,
    metalness: 0.12,
  });

  const buildingMaterials = [
    createBuildingPbrMaterial(
      '#1e293b',
      '#fef08a',
      'நல்லி சில்க்ஸ் · சென்னை',
      'NALLI SILKS [PLACEHOLDER]',
      '#f59e0b',
      maxAnisotropy
    ),
    createBuildingPbrMaterial(
      '#0f172a',
      '#bae6fd',
      'மद्राஸ் பில்டர் காபி',
      'DEGREE KAAPI HOUSE',
      '#10b981',
      maxAnisotropy
    ),
    createBuildingPbrMaterial(
      '#172554',
      '#fde047',
      'வசந்த் & கோ · அண்ணா சாலை',
      'VASANTH ELECTRONICS',
      '#38bdf8',
      maxAnisotropy
    ),
    createBuildingPbrMaterial(
      '#31102f',
      '#fed7aa',
      'தி. நகர் தங்க மாளிகை',
      'T. NAGAR GOLD PALACE',
      '#f43f5e',
      maxAnisotropy
    ),
  ];

  const roofCapMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.72,
    metalness: 0.25,
  });
  const ledgeMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.65,
    metalness: 0.2,
  });
  const sintexTankMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.35,
    metalness: 0.15,
  });
  const beaconRedMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.5,
  });

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.35,
    metalness: 0.85,
  });
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.2,
  });

  const chunks: ChennaiCityChunk[] = [];
  const roadGeo = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
  roadGeo.rotateX(-Math.PI / 2);

  for (let gx = -GRID_RADIUS; gx <= GRID_RADIUS; gx++) {
    for (let gz = -GRID_RADIUS; gz <= GRID_RADIUS; gz++) {
      const chunkGroup = new THREE.Group();

      const roadTile = new THREE.Mesh(roadGeo, roadMat);
      roadTile.receiveShadow = castShadow;
      chunkGroup.add(roadTile);

      // Streetlights at 4 block corners
      [
        [-23, -23],
        [23, -23],
        [-23, 23],
        [23, 23],
      ].forEach(([lx, lz]) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8), poleMat);
        pole.position.set(lx, 3.75, lz);
        chunkGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.14), poleMat);
        arm.position.set(lx + (lx < 0 ? -0.7 : 0.7), 7.4, lz);
        chunkGroup.add(arm);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.3), lampBulbMat);
        bulb.position.set(lx + (lx < 0 ? -1.3 : 1.3), 7.3, lz);
        chunkGroup.add(bulb);
      });

      if (gx < 0) {
        const hash = Math.abs(gx * 31 + gz * 17) % 8;
        const bCount = 2;
        for (let b = 0; b < bCount; b++) {
          const bw = 15 + ((hash + b * 3) % 7);
          const bd = 15 + ((hash + b * 5) % 7);
          const bh = 14 + ((hash * 5 + b * 11) % 22);
          const bMat = buildingMaterials[(hash + b) % buildingMaterials.length];
          const offsetX = b === 0 ? -9 : 9;
          const offsetZ = b === 0 ? -8 : 8;

          const bGroup = new THREE.Group();
          bGroup.position.set(offsetX, 0, offsetZ);
          bGroup.userData.isInlandBuilding = true;

          // Main PBR Facade Volume
          const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bMat);
          bMesh.position.y = bh / 2;
          bMesh.castShadow = castShadow;
          bMesh.receiveShadow = castShadow;
          bGroup.add(bMesh);

          // 3D Protruding Concrete Floor Slab Ledges & Parapet Cornice
          for (let ly = 5; ly < bh; ly += 5.5) {
            const ledge = new THREE.Mesh(
              new THREE.BoxGeometry(bw + 0.5, 0.32, bd + 0.5),
              ledgeMat
            );
            ledge.position.y = ly;
            bGroup.add(ledge);
          }

          // Rooftop AC Penthouse + Black Sintex Water Tank + Telecom Aviation Mast
          const roofBox = new THREE.Mesh(
            new THREE.BoxGeometry(bw * 0.52, 2.4, bd * 0.52),
            roofCapMat
          );
          roofBox.position.y = bh + 1.2;
          bGroup.add(roofBox);

          const waterTank = new THREE.Mesh(
            new THREE.CylinderGeometry(1.1, 1.1, 1.8, 12),
            sintexTankMat
          );
          waterTank.position.set(bw * 0.25, bh + 0.9, -bd * 0.22);
          bGroup.add(waterTank);

          if ((hash + b) % 2 === 0) {
            const mast = new THREE.Mesh(
              new THREE.CylinderGeometry(0.08, 0.22, 5.5, 6),
              poleMat
            );
            mast.position.set(-bw * 0.2, bh + 2.75, bd * 0.2);
            bGroup.add(mast);

            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), beaconRedMat);
            beacon.position.set(-bw * 0.2, bh + 5.6, bd * 0.2);
            bGroup.add(beacon);
          }

          chunkGroup.add(bGroup);
        }
      }

      chunkGroup.position.set(gx * BLOCK_SIZE, 0, gz * BLOCK_SIZE);
      cityRoot.add(chunkGroup);
      chunks.push({ group: chunkGroup, baseGridX: gx, baseGridZ: gz });
    }
  }

  // 5. 3D Holographic GPS Route Ribbon & Extraction Pillar Beacon
  const gpsRibbonGeo = new THREE.BufferGeometry();
  const gpsRibbonMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const gpsRibbonMesh = new THREE.Mesh(gpsRibbonGeo, gpsRibbonMat);
  gpsRibbonMesh.position.y = 0.16;
  gpsRibbonMesh.frustumCulled = false;
  scene.add(gpsRibbonMesh);

  const targetBeaconGroup = new THREE.Group();
  const beaconCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 45, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beaconCylinder.position.y = 22.5;
  targetBeaconGroup.add(beaconCylinder);

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(6.8, 8.4, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );
  beaconRing.position.y = 0.12;
  targetBeaconGroup.add(beaconRing);
  targetBeaconGroup.visible = false;
  scene.add(targetBeaconGroup);

  const updateAroundPlayer = (
    playerWorldX: number,
    playerWorldZ: number,
    timeSec: number,
    timeOfDay: TimeOfDayMode = 'SUNSET'
  ) => {
    const centerSnapX = Math.round(playerWorldX / BLOCK_SIZE);
    const centerSnapZ = Math.round(playerWorldZ / BLOCK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const worldGX = centerSnapX + c.baseGridX;
      const worldGZ = centerSnapZ + c.baseGridZ;

      c.group.visible = worldGX * BLOCK_SIZE <= 10;
      c.group.position.set(worldGX * BLOCK_SIZE, 0, worldGZ * BLOCK_SIZE);

      const chunkWorldX = worldGX * BLOCK_SIZE;
      const chunkWorldZ = worldGZ * BLOCK_SIZE;
      const isLandmarkPlot =
        (Math.abs(chunkWorldX - -144) < 20 && Math.abs(chunkWorldZ - -72) < 20) ||
        (Math.abs(chunkWorldX - -144) < 20 && Math.abs(chunkWorldZ - -216) < 20) ||
        (Math.abs(chunkWorldX - -216) < 20 && Math.abs(chunkWorldZ - 72) < 20) ||
        (Math.abs(chunkWorldX - -288) < 20 && Math.abs(chunkWorldZ - 216) < 20) ||
        (Math.abs(chunkWorldX - -72) < 20 && Math.abs(chunkWorldZ - 288) < 20);

      for (let j = 0; j < c.group.children.length; j++) {
        const child = c.group.children[j];
        if (child.userData.isInlandBuilding) {
          child.visible = worldGX < 0 && !isLandmarkPlot;
        }
      }
    }

    // Center Sky Dome & Directional Sun on Player
    skyDome.mesh.position.set(playerWorldX, 0, playerWorldZ);
    if (timeOfDay === 'SUNSET') {
      skyDome.uniforms.topColor.value.setHex(0x0f172a);
      skyDome.uniforms.midColor.value.setHex(0x4c1d95);
      skyDome.uniforms.horizonColor.value.setHex(0xea580c);
      skyDome.uniforms.sunColor.value.setHex(0xfde047);
      skyDome.uniforms.sunDir.value.set(0.75, 0.22, 0.25).normalize();
    } else if (timeOfDay === 'NIGHT') {
      skyDome.uniforms.topColor.value.setHex(0x020617);
      skyDome.uniforms.midColor.value.setHex(0x0f172a);
      skyDome.uniforms.horizonColor.value.setHex(0x1e293b);
      skyDome.uniforms.sunColor.value.setHex(0xbae6fd);
      skyDome.uniforms.sunDir.value.set(0.45, 0.55, -0.35).normalize();
    } else {
      skyDome.uniforms.topColor.value.setHex(0x0369a1);
      skyDome.uniforms.midColor.value.setHex(0x0ea5e9);
      skyDome.uniforms.horizonColor.value.setHex(0xbae6fd);
      skyDome.uniforms.sunColor.value.setHex(0xffffff);
      skyDome.uniforms.sunDir.value.set(0.4, 0.82, 0.25).normalize();
    }

    sunLight.position.set(playerWorldX + 80, 95, playerWorldZ + 45);
    sunLight.target.position.set(playerWorldX, 0, playerWorldZ);
    sunLight.target.updateMatrixWorld();

    // Update Ocean Shader Time & Breaking Surf Foam Waves
    oceanUniforms.uTime.value = timeSec;
    oceanMesh.position.z = playerWorldZ;

    surfFoamMesh.position.z = playerWorldZ;
    surfFoamMesh.position.x = 121 + Math.sin(timeSec * 1.9) * 3.4;
    (surfFoamMesh.material as THREE.MeshBasicMaterial).opacity =
      0.55 + Math.sin(timeSec * 1.9) * 0.24;

    surfFoamSecondaryMesh.position.z = playerWorldZ;
    surfFoamSecondaryMesh.position.x = 126.5 + Math.cos(timeSec * 1.9) * 2.8;
    (surfFoamSecondaryMesh.material as THREE.MeshBasicMaterial).opacity =
      0.38 + Math.cos(timeSec * 1.9) * 0.18;

    lighthouseObj.beamGroup.rotation.y = timeSec * 0.85;
    beaconRing.scale.setScalar(1 + Math.sin(timeSec * 5) * 0.08);
  };

  const updateGpsRibbon = (pointsWorldXZ: Array<{ x: number; z: number }>, colorHex: number) => {
    gpsRibbonMat.color.setHex(colorHex);
    (beaconCylinder.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    (beaconRing.material as THREE.MeshBasicMaterial).color.setHex(colorHex);

    if (pointsWorldXZ.length < 2) {
      gpsRibbonMesh.visible = false;
      targetBeaconGroup.visible = false;
      return;
    }

    gpsRibbonMesh.visible = true;
    targetBeaconGroup.visible = true;
    const finalPt = pointsWorldXZ[pointsWorldXZ.length - 1];
    targetBeaconGroup.position.set(finalPt.x, 0, finalPt.z);

    const ribbonWidth = 2.6;
    const vertices: number[] = [];
    for (let i = 0; i < pointsWorldXZ.length - 1; i++) {
      const p1 = pointsWorldXZ[i];
      const p2 = pointsWorldXZ[i + 1];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      const nx = (-dz / len) * (ribbonWidth * 0.5);
      const nz = (dx / len) * (ribbonWidth * 0.5);

      vertices.push(p1.x + nx, 0, p1.z + nz);
      vertices.push(p1.x - nx, 0, p1.z - nz);
      vertices.push(p2.x + nx, 0, p2.z + nz);
      vertices.push(p1.x - nx, 0, p1.z - nz);
      vertices.push(p2.x - nx, 0, p2.z - nz);
      vertices.push(p2.x + nx, 0, p2.z + nz);
    }

    gpsRibbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    gpsRibbonGeo.computeVertexNormals();
  };

  const applyGraphicsQuality = (
    quality: GraphicsQuality,
    renderer: THREE.WebGLRenderer,
    targetScene: THREE.Scene,
    softwareGl: boolean
  ) => {
    if (softwareGl) {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      return;
    }

    if (quality === 'LOW') {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      sunLight.castShadow = false;
      if (targetScene.fog instanceof THREE.FogExp2) {
        targetScene.fog.density = 0.0048;
      }
    } else if (quality === 'MEDIUM') {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.shadowMap.enabled = true;
      sunLight.castShadow = true;
      if (targetScene.fog instanceof THREE.FogExp2) {
        targetScene.fog.density = 0.0034;
      }
    } else {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      renderer.shadowMap.enabled = true;
      sunLight.castShadow = true;
      if (targetScene.fog instanceof THREE.FogExp2) {
        targetScene.fog.density = 0.0024;
      }
    }
  };

  return {
    cityRoot,
    marinaStaticRoot,
    chunks,
    colliders,
    gpsRibbonMesh,
    targetBeaconGroup,
    oceanMesh,
    surfFoamMesh,
    surfFoamSecondaryMesh,
    skyDomeMesh: skyDome.mesh,
    lighthouseBeamGroup: lighthouseObj.beamGroup,
    sunLight,
    hemiLight,
    updateAroundPlayer,
    updateGpsRibbon,
    applyGraphicsQuality,
  };
}
