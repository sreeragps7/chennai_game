import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CHENNAI_DISTRICTS,
  INITIAL_VIEWPORT_CENTER,
  VEHICLE_SPECS,
  fetchChennaiOsmWayCount,
  getClosestChennaiDistrict,
  latLngToMetersDelta,
  metersToLatLngDelta,
} from '../data/chennaiWorld';
import {
  ActiveMissionState,
  CameraViewMode,
  CharacterAnimState,
  ChennaiDistrictId,
  DiscoveredPlaceNode,
  GameState,
  GraphicsQuality,
  HudSnapshot,
  PlayerControlMode,
  TimeOfDayMode,
  VehicleId,
  VehicleSpec,
} from '../types/game';
import { soundEngine } from '../audio/soundEngine';
import { VehicleMeshBundle, buildChennaiVehicle3D } from '../three/vehicleModels';
import {
  HumanCharacterBundle,
  buildHumanCharacter3D,
  updateHumanCharacterAnimation,
} from '../three/humanCharacterModel';
import { createChennai3DEnvironment } from '../three/chennaiSceneBuilder';

interface GameCanvasProps {
  gameState: GameState;
  selectedVehicleId: VehicleId;
  selectedDistrictId: ChennaiDistrictId;
  graphicsQuality: GraphicsQuality;
  cameraMode: CameraViewMode;
  timeOfDay: TimeOfDayMode;
  mapCenterRef: React.MutableRefObject<{ lat: number; lng: number }>;
  playerHeadingRef: React.MutableRefObject<number>;
  discoveredNodes: DiscoveredPlaceNode[];
  activeMission: ActiveMissionState | null;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onMissionAdvanceStage: () => void;
  onMissionComplete: (rewardInr: number, respectGain: number) => void;
  onMissionFail: (reason: string) => void;
  onPlayerWasted: (reason: string) => void;
  triggerEnterExitSignal: number;
  triggerEmpSignal: number;
  triggerHornSignal: number;
  teleportSignal: number;
  resetSignal: number;
}

interface SimTrafficCar3D {
  id: number;
  spec: VehicleSpec;
  lat: number;
  lng: number;
  vx: number;
  vy: number;
  angle: number;
  armor: number;
  isPolice: boolean;
  isParked: boolean;
  aiState: 'PARKED' | 'CRUISE' | 'PURSUIT' | 'WINDUP_LUNGE' | 'LUNGING' | 'STUNNED';
  windupTimer: number;
  lungeTimer: number;
  stunTimer: number;
  hitFlash: number;
  scaleX: number;
  scaleY: number;
  targetAngle: number;
  meshBundle: VehicleMeshBundle;
  laserBeamMesh: THREE.Mesh;
}

interface SimPedestrian3D {
  id: number;
  worldX: number;
  worldZ: number;
  vx: number;
  vz: number;
  angle: number;
  walkSpeed: number;
  bundle: HumanCharacterBundle;
}

interface HazardZone3D {
  id: number;
  lat: number;
  lng: number;
  radiusMeters: number;
  windupTimer: number;
  maxWindup: number;
  activeTimer: number;
  type: 'EMP_MORTAR' | 'SPIKE_BARRICADE';
  group: THREE.Group;
  innerDisc: THREE.Mesh;
  outerRing: THREE.Mesh;
}

interface WorldPickup3D {
  id: number;
  lat: number;
  lng: number;
  type: 'CASH_BUNDLE' | 'KAAPI_NITRO' | 'ARMOR_VEST';
  value: number;
  bobPhase: number;
  mesh: THREE.Group;
}

interface Particle3D {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  alpha: number;
  decay: number;
  color: THREE.Color;
}

// Pre-allocated module-scope math helpers (Zero GC in 60fps loop)
const _camDesiredPos = new THREE.Vector3();
const _camCurrentPos = new THREE.Vector3(18, 6, 12);
const _camLookTarget = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _zeroScaleMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
const _whiteColor = new THREE.Color(0xffffff);

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  selectedVehicleId,
  selectedDistrictId,
  graphicsQuality,
  cameraMode,
  timeOfDay,
  mapCenterRef,
  playerHeadingRef,
  discoveredNodes,
  activeMission,
  onHudUpdate,
  onMissionAdvanceStage,
  onMissionComplete,
  onMissionFail,
  onPlayerWasted,
  triggerEnterExitSignal,
  triggerEmpSignal,
  triggerHornSignal,
  teleportSignal,
  resetSignal,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const timeOfDayRef = useRef(timeOfDay);
  timeOfDayRef.current = timeOfDay;

  const graphicsQualityRef = useRef(graphicsQuality);
  graphicsQualityRef.current = graphicsQuality;

  const selectedVehicleIdRef = useRef(selectedVehicleId);
  selectedVehicleIdRef.current = selectedVehicleId;

  const selectedDistrictIdRef = useRef(selectedDistrictId);
  selectedDistrictIdRef.current = selectedDistrictId;

  const discoveredNodesRef = useRef(discoveredNodes);
  discoveredNodesRef.current = discoveredNodes;

  const activeMissionRef = useRef(activeMission);
  activeMissionRef.current = activeMission;

  const callbacksRef = useRef({
    onHudUpdate,
    onMissionAdvanceStage,
    onMissionComplete,
    onMissionFail,
    onPlayerWasted,
  });
  callbacksRef.current = {
    onHudUpdate,
    onMissionAdvanceStage,
    onMissionComplete,
    onMissionFail,
    onPlayerWasted,
  };

  const simRef = useRef({
    controlMode: 'ON_FOOT' as PlayerControlMode,
    characterAnim: 'IDLE' as CharacterAnimState,
    health: 100,
    stamina: 100,
    jumpY: 0,
    jumpVelY: 0,
    isGrounded: true,
    playerLat: INITIAL_VIEWPORT_CENTER.lat,
    playerLng: INITIAL_VIEWPORT_CENTER.lng,
    worldX: 18, // Starts on Marina Beach Promenade next to Kamarajar Salai
    worldZ: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    angle: -Math.PI / 2, // Facing North along Marina Beach
    orbitYaw: -Math.PI / 2, // Mouse orbit yaw
    orbitPitch: 0.34, // Mouse orbit pitch (radians)
    manualOrbitTimer: 0,
    steerInputSmoothed: 0,
    pitchAngle: 0,
    rollAngle: 0,
    vehicle: VEHICLE_SPECS[selectedVehicleId],
    armor: VEHICLE_SPECS[selectedVehicleId].maxArmor,
    nitrous: 100,
    empCharge: 100,
    cashInr: 25000,
    respect: 100,
    wantedStars: 0,
    wantedHeat: 0,
    wantedCooldown: 0,
    missionsCompleted: 0,
    policeDefeated: 0,
    comboMultiplier: 1,
    hitstopTimer: 0,
    shakeIntensity: 0,
    playerHitFlash: 0,
    scaleX: 1,
    scaleY: 1,
    empWaveRadius: 0,
    empWaveAlpha: 0,
    statusBanner: null as string | null,
    statusBannerTimer: 0,
    missionTimer: 110,
    waypointIdx: 0,
    osmRoadCount: 128,
    activeColliderLabel: null as string | null,
    needsPlayerMeshRebuild: false,
    needsStarterVehiclesSpawn: true,
    qualityDirty: true,
  });

  const keysHeldRef = useRef<Record<string, boolean>>({});
  const inputBufferRef = useRef({
    enterExitBuffered: 0,
    empBuffered: 0,
    hornBuffered: 0,
    jumpBuffered: 0,
  });

  // Update OSM road count when district changes
  useEffect(() => {
    const dist = CHENNAI_DISTRICTS[selectedDistrictId] || CHENNAI_DISTRICTS.marina_beach;
    fetchChennaiOsmWayCount(dist.lat, dist.lng).then((cnt) => {
      simRef.current.osmRoadCount = cnt;
    });
  }, [selectedDistrictId]);

  useEffect(() => {
    simRef.current.qualityDirty = true;
  }, [graphicsQuality]);

  // Trigger player 3D vehicle rebuild when user picks a different vehicle
  useEffect(() => {
    const spec = VEHICLE_SPECS[selectedVehicleId];
    if (spec) {
      simRef.current.vehicle = spec;
      if (gameState === 'TITLE_MENU') {
        simRef.current.armor = spec.maxArmor;
      }
      simRef.current.needsPlayerMeshRebuild = true;
    }
  }, [selectedVehicleId, gameState]);

  // Teleport / Fast-Travel to selected Chennai District
  useEffect(() => {
    if (teleportSignal === 0) return;
    const s = simRef.current;
    const dist = CHENNAI_DISTRICTS[selectedDistrictId] || CHENNAI_DISTRICTS.marina_beach;
    const delta = metersToLatLngDelta(dist.worldX, dist.worldZ);
    s.playerLat = INITIAL_VIEWPORT_CENTER.lat + delta.dLat;
    s.playerLng = INITIAL_VIEWPORT_CENTER.lng + delta.dLng;
    s.worldX = dist.worldX + (dist.id === 'marina_beach' ? 16 : 0);
    s.worldZ = dist.worldZ;
    s.vx = 0;
    s.vy = 0;
    s.speed = 0;
    mapCenterRef.current = { lat: s.playerLat, lng: s.playerLng };
    s.needsStarterVehiclesSpawn = true;
    s.statusBanner = `${dist.tamilName} · ${dist.name.toUpperCase()}`;
    s.statusBannerTimer = 4.0;
  }, [teleportSignal, selectedDistrictId, mapCenterRef]);

  useEffect(() => {
    if (resetSignal === 0) return;
    const s = simRef.current;
    const dist = CHENNAI_DISTRICTS[selectedDistrictId] || CHENNAI_DISTRICTS.marina_beach;
    const spec = VEHICLE_SPECS[selectedVehicleId] || VEHICLE_SPECS.contessa_sedan;
    const spawnX = dist.worldX + (dist.id === 'marina_beach' ? 15 : 0);
    const spawnZ = dist.worldZ;
    const delta = metersToLatLngDelta(spawnX, spawnZ);

    s.controlMode = 'ON_FOOT';
    s.characterAnim = 'IDLE';
    s.health = 100;
    s.stamina = 100;
    s.jumpY = 0;
    s.jumpVelY = 0;
    s.isGrounded = true;
    s.playerLat = INITIAL_VIEWPORT_CENTER.lat + delta.dLat;
    s.playerLng = INITIAL_VIEWPORT_CENTER.lng + delta.dLng;
    s.worldX = spawnX;
    s.worldZ = spawnZ;
    mapCenterRef.current = { lat: s.playerLat, lng: s.playerLng };
    s.vx = 0;
    s.vy = 0;
    s.speed = 0;
    s.angle = -Math.PI / 2;
    s.orbitYaw = -Math.PI / 2;
    s.orbitPitch = 0.32;
    s.vehicle = spec;
    s.armor = spec.maxArmor;
    s.nitrous = 100;
    s.empCharge = 100;
    s.wantedStars = 0;
    s.wantedHeat = 0;
    s.wantedCooldown = 0;
    s.statusBanner = `${dist.tamilName} — WASD WALK · SPACE JUMP · [E] ENTER VEHICLE`;
    s.statusBannerTimer = 5.0;
    s.needsPlayerMeshRebuild = true;
    s.needsStarterVehiclesSpawn = true;
  }, [resetSignal, selectedVehicleId, selectedDistrictId, mapCenterRef]);

  useEffect(() => {
    if (triggerEnterExitSignal > 0) inputBufferRef.current.enterExitBuffered = 0.25;
  }, [triggerEnterExitSignal]);

  useEffect(() => {
    if (triggerEmpSignal > 0) inputBufferRef.current.empBuffered = 0.22;
  }, [triggerEmpSignal]);

  useEffect(() => {
    if (triggerHornSignal > 0) inputBufferRef.current.hornBuffered = 0.22;
  }, [triggerHornSignal]);

  useEffect(() => {
    if (activeMission) {
      simRef.current.missionTimer = activeMission.mission.timeLimitSec;
      simRef.current.waypointIdx = 0;
      if (activeMission.stage === 'RACE_TO_DESTINATION') {
        simRef.current.wantedStars = Math.max(
          simRef.current.wantedStars,
          activeMission.mission.initialWantedStars
        );
        simRef.current.statusBanner = `CONTRACT LIVE: ${activeMission.mission.title.toUpperCase()}`;
        simRef.current.statusBannerTimer = 3.5;
      }
    }
  }, [activeMission?.mission.id, activeMission?.stage]);

  // ==========================================================================
  // INITIALIZE STABLE THREE.JS 3D WEBGL SCENE & 60FPS SIMULATION LOOP
  // ==========================================================================
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard (Mandatory Three.js Skill Standard)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initRect = container.getBoundingClientRect();
    renderer.setSize(initRect.width || window.innerWidth, initRect.height || window.innerHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Fog & Studio Environment Map (RoomEnvironment)
    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x0f172a);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(0x0f172a, 0.0038);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Perspective Camera
    const camera = new THREE.PerspectiveCamera(
      62,
      (initRect.width || window.innerWidth) / (initRect.height || window.innerHeight),
      0.4,
      520
    );
    camera.position.set(18, 6, 12);

    // 4. Build 3D Chennai City & Marina Beach Environment
    const envRig = createChennai3DEnvironment(scene, isSoftwareGl, maxAniso);

    // 5. Build Player Third-Person Human Character Bundle
    const playerHuman: HumanCharacterBundle = buildHumanCharacter3D(
      0x0284c7, // Marina Blue Jacket/Shirt
      0x0f172a, // Dark Indigo Jeans
      0xc68642,
      true,
      !isSoftwareGl
    );
    scene.add(playerHuman.group);

    // 6. Build Player Active 3D Vehicle Bundle
    let playerVehicleBundle: VehicleMeshBundle = buildChennaiVehicle3D(
      simRef.current.vehicle,
      isSoftwareGl,
      maxAniso
    );
    playerVehicleBundle.group.visible = false;
    scene.add(playerVehicleBundle.group);

    // EMP Shockwave 3D Torus Ring
    const empRingGeo = new THREE.RingGeometry(0.85, 1.0, 36);
    empRingGeo.rotateX(-Math.PI / 2);
    const empRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const empRingMesh = new THREE.Mesh(empRingGeo, empRingMat);
    empRingMesh.position.y = 0.45;
    empRingMesh.visible = false;
    scene.add(empRingMesh);

    // 7. Pooled 3D InstancedMesh Particle System (120 particles, 1 draw call)
    const PARTICLE_COUNT = 120;
    const particleGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_COUNT);
    particleInstanced.frustumCulled = false;
    particleInstanced.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(PARTICLE_COUNT * 3),
      3
    );
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleInstanced.setMatrixAt(i, _zeroScaleMatrix);
      particleInstanced.setColorAt(i, _whiteColor);
    }
    scene.add(particleInstanced);

    const particles: Particle3D[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 1,
      alpha: 0,
      decay: 2,
      color: new THREE.Color(0xfacc15),
    }));

    const spawnParticles3D = (
      wx: number,
      wy: number,
      wz: number,
      count: number,
      hexColor: number,
      speedMin: number,
      speedMax: number,
      size: number = 1.0,
      decay: number = 2.2
    ) => {
      let spawned = 0;
      for (let i = 0; i < PARTICLE_COUNT && spawned < count; i++) {
        const pt = particles[i];
        if (!pt.active) {
          const theta = Math.random() * Math.PI * 2;
          const spd = speedMin + Math.random() * (speedMax - speedMin);
          pt.active = true;
          pt.x = wx;
          pt.y = wy;
          pt.z = wz;
          pt.vx = Math.cos(theta) * spd;
          pt.vy = 2 + Math.random() * (spd * 0.55);
          pt.vz = Math.sin(theta) * spd;
          pt.size = size * (0.75 + Math.random() * 0.5);
          pt.alpha = 1.0;
          pt.decay = decay;
          pt.color.setHex(hexColor);
          spawned++;
        }
      }
    };

    const trafficCars: SimTrafficCar3D[] = [];
    const pedestrians: SimPedestrian3D[] = [];
    const hazardZones: HazardZone3D[] = [];
    const worldPickups: WorldPickup3D[] = [];
    let nextEntityId = 1;

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Resize, Keyboard, & Mouse Orbit Listeners
    const handleResize = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let isPointerDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) {
        isPointerDragging = true;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPointerDragging && document.pointerLockElement !== renderer.domElement) return;
      const dx =
        document.pointerLockElement === renderer.domElement
          ? e.movementX
          : e.clientX - lastPointerX;
      const dy =
        document.pointerLockElement === renderer.domElement
          ? e.movementY
          : e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      simRef.current.orbitYaw += dx * 0.0055;
      simRef.current.orbitPitch = Math.max(
        0.08,
        Math.min(1.15, simRef.current.orbitPitch + dy * 0.0045)
      );
      simRef.current.manualOrbitTimer = 2.5;
    };

    const handlePointerUp = () => {
      isPointerDragging = false;
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const code = e.code;
      if (!keysHeldRef.current[code]) {
        // [E] or [F] to Enter / Exit Vehicle
        if (code === 'KeyE' || code === 'KeyF') {
          inputBufferRef.current.enterExitBuffered = 0.25;
        }
        // [Q] for EMP Shockwave
        if (code === 'KeyQ') {
          inputBufferRef.current.empBuffered = 0.22;
        }
        if (code === 'KeyH') {
          inputBufferRef.current.hornBuffered = 0.22;
        }
        if (code === 'Space') {
          inputBufferRef.current.jumpBuffered = 0.2;
        }
      }
      keysHeldRef.current[code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current[e.code] = false;
    };

    const handleWindowBlur = () => {
      keysHeldRef.current = {};
      isPointerDragging = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);

    const latLngToWorldXZ = (lat: number, lng: number) => {
      const { dxMeters, dyMeters } = latLngToMetersDelta(INITIAL_VIEWPORT_CENTER, { lat, lng });
      return { x: dxMeters, z: dyMeters };
    };

    // Helper: Spawn a 3D vehicle at specific world coordinates
    const spawnTrafficVehicleAt = (
      spec: VehicleSpec,
      wx: number,
      wz: number,
      heading: number,
      isParked: boolean,
      isPolice: boolean
    ): SimTrafficCar3D => {
      const delta = metersToLatLngDelta(wx, wz);
      const cLat = INITIAL_VIEWPORT_CENTER.lat + delta.dLat;
      const cLng = INITIAL_VIEWPORT_CENTER.lng + delta.dLng;

      const bundle = buildChennaiVehicle3D(spec, isSoftwareGl, maxAniso);
      bundle.group.position.set(wx, 0, wz);
      bundle.group.rotation.y = -heading;
      scene.add(bundle.group);

      const laserGeo = new THREE.PlaneGeometry(36, 0.45);
      laserGeo.translate(18, 0, 0);
      laserGeo.rotateX(-Math.PI / 2);
      const laserMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const laserBeamMesh = new THREE.Mesh(laserGeo, laserMat);
      laserBeamMesh.position.y = 0.25;
      laserBeamMesh.visible = false;
      scene.add(laserBeamMesh);

      const car: SimTrafficCar3D = {
        id: nextEntityId++,
        spec,
        lat: cLat,
        lng: cLng,
        vx: isParked ? 0 : Math.cos(heading) * 14,
        vy: isParked ? 0 : Math.sin(heading) * 14,
        angle: heading,
        armor: spec.maxArmor,
        isPolice,
        isParked,
        aiState: isParked ? 'PARKED' : isPolice ? 'PURSUIT' : 'CRUISE',
        windupTimer: 0,
        lungeTimer: 0,
        stunTimer: 0,
        hitFlash: 0,
        scaleX: 1,
        scaleY: 1,
        targetAngle: heading,
        meshBundle: bundle,
        laserBeamMesh,
      };
      trafficCars.push(car);
      return car;
    };

    // Helper: Resolve 3D Building & Landmark Collisions for Player or Vehicle
    const resolveWorldCollisions = (
      wx: number,
      wz: number,
      radius: number
    ): { x: number; z: number; hit: boolean; hitLabel: string | null } => {
      let outX = wx;
      let outZ = wz;
      let hit = false;
      let hitLabel: string | null = null;

      for (let i = 0; i < envRig.colliders.length; i++) {
        const col = envRig.colliders[i];
        // Check proximity for landmark HUD label (within 18m)
        if (
          outX >= col.minX - 18 &&
          outX <= col.maxX + 18 &&
          outZ >= col.minZ - 18 &&
          outZ <= col.maxZ + 18
        ) {
          hitLabel = `${col.tamilLabel} · ${col.label}`;
        }

        const closestX = Math.max(col.minX, Math.min(outX, col.maxX));
        const closestZ = Math.max(col.minZ, Math.min(outZ, col.maxZ));
        const dx = outX - closestX;
        const dz = outZ - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          hit = true;
          const dist = Math.sqrt(distSq);
          if (dist > 0.001) {
            const overlap = radius - dist;
            outX += (dx / dist) * overlap;
            outZ += (dz / dist) * overlap;
          } else {
            outX = col.minX - radius;
          }
        }
      }

      return { x: outX, z: outZ, hit, hitLabel };
    };

    // Helper: Maintain 3D Traffic, Parked Cars, Pedestrians, Pickups & Hazards
    const maintain3DEntities = (dt: number) => {
      const s = simRef.current;

      if (s.qualityDirty) {
        s.qualityDirty = false;
        envRig.applyGraphicsQuality(graphicsQualityRef.current, renderer, scene, isSoftwareGl);
      }

      if (s.needsPlayerMeshRebuild) {
        s.needsPlayerMeshRebuild = false;
        scene.remove(playerVehicleBundle.group);
        playerVehicleBundle = buildChennaiVehicle3D(s.vehicle, isSoftwareGl, maxAniso);
        playerVehicleBundle.group.visible = s.controlMode === 'DRIVING';
        scene.add(playerVehicleBundle.group);
      }

      // Spawn 3 parked hero vehicles right next to the player on start/teleport so [E] Vehicle Enter is immediately testable!
      if (s.needsStarterVehiclesSpawn) {
        s.needsStarterVehiclesSpawn = false;
        // Clear old parked cars far away
        for (let i = trafficCars.length - 1; i >= 0; i--) {
          scene.remove(trafficCars[i].meshBundle.group);
          scene.remove(trafficCars[i].laserBeamMesh);
          trafficCars.splice(i, 1);
        }

        // 1. Parked Marina GT Classic Sedan 5m to the left on Kamarajar Salai curbside
        spawnTrafficVehicleAt(
          VEHICLE_SPECS.contessa_sedan,
          s.worldX - 5.5,
          s.worldZ - 2.0,
          -Math.PI / 2,
          true,
          false
        );
        // 2. Parked Chennai Yellow Meter Auto Rickshaw 5m ahead
        spawnTrafficVehicleAt(
          VEHICLE_SPECS.auto_rickshaw,
          s.worldX - 5.2,
          s.worldZ - 9.5,
          -Math.PI / 2,
          true,
          false
        );
        // 3. Parked ECR 350 Coastal Bike 4m behind
        spawnTrafficVehicleAt(
          VEHICLE_SPECS.ecr_bike,
          s.worldX - 4.5,
          s.worldZ + 5.5,
          -Math.PI / 2,
          true,
          false
        );
        // 4. Parked MTC Route 21G Express Bus across the street
        spawnTrafficVehicleAt(
          VEHICLE_SPECS.mtc_bus,
          s.worldX - 15.5,
          s.worldZ - 6.0,
          Math.PI / 2,
          true,
          false
        );
      }

      // Maintain 3D Walking Pedestrians along Marina Promenade & Sidewalks
      const maxPeds =
        graphicsQualityRef.current === 'LOW'
          ? 8
          : graphicsQualityRef.current === 'MEDIUM'
          ? 14
          : 20;

      for (let i = pedestrians.length - 1; i >= 0; i--) {
        const ped = pedestrians[i];
        if (Math.hypot(ped.worldX - s.worldX, ped.worldZ - s.worldZ) > 160) {
          scene.remove(ped.bundle.group);
          pedestrians.splice(i, 1);
        }
      }

      const pedShirtColors = [0xe11d48, 0x10b981, 0xf59e0b, 0x8b5cf6, 0x06b6d4, 0xf97316];
      while (pedestrians.length < maxPeds) {
        const isOnMarina = s.worldX > -35;
        const px = isOnMarina
          ? 20 + Math.random() * 14 // Strolling along Marina Promenade
          : s.worldX + (Math.random() < 0.5 ? -22 : 22);
        const pz = s.worldZ + (Math.random() - 0.5) * 140;
        const dir = Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2;
        const shirtHex = pedShirtColors[pedestrians.length % pedShirtColors.length];
        const pedBundle = buildHumanCharacter3D(shirtHex, 0x1e293b, 0xb97a56, false, !isSoftwareGl);
        pedBundle.group.position.set(px, 0, pz);
        pedBundle.group.rotation.y = -dir;
        scene.add(pedBundle.group);

        pedestrians.push({
          id: nextEntityId++,
          worldX: px,
          worldZ: pz,
          vx: Math.cos(dir) * 1.6,
          vz: Math.sin(dir) * 1.6,
          angle: dir,
          walkSpeed: 1.45 + Math.random() * 0.45,
          bundle: pedBundle,
        });
      }

      // World Pickups
      for (let i = worldPickups.length - 1; i >= 0; i--) {
        const p = worldPickups[i];
        const { distanceMeters } = latLngToMetersDelta(
          { lat: s.playerLat, lng: s.playerLng },
          { lat: p.lat, lng: p.lng }
        );
        if (distanceMeters > 260) {
          scene.remove(p.mesh);
          worldPickups.splice(i, 1);
        }
      }

      while (worldPickups.length < 8) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 35 + Math.random() * 140;
        const delta = metersToLatLngDelta(Math.cos(ang) * dist, Math.sin(ang) * dist);
        const roll = Math.random();
        const type = roll < 0.55 ? 'CASH_BUNDLE' : roll < 0.8 ? 'KAAPI_NITRO' : 'ARMOR_VEST';
        const colorHex =
          type === 'CASH_BUNDLE' ? 0x10b981 : type === 'KAAPI_NITRO' ? 0xf59e0b : 0x38bdf8;

        const pickupGroup = new THREE.Group();
        const gem = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.9, 0),
          new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 0.9,
            roughness: 0.2,
            metalness: 0.8,
          })
        );
        gem.position.y = 1.3;
        pickupGroup.add(gem);

        const baseRing = new THREE.Mesh(
          new THREE.RingGeometry(1.0, 1.35, 20).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })
        );
        baseRing.position.y = 0.08;
        pickupGroup.add(baseRing);

        const pLat = s.playerLat + delta.dLat;
        const pLng = s.playerLng + delta.dLng;
        const posXZ = latLngToWorldXZ(pLat, pLng);
        if (posXZ.x < 95) {
          pickupGroup.position.set(posXZ.x, 0, posXZ.z);
          scene.add(pickupGroup);
          worldPickups.push({
            id: nextEntityId++,
            lat: pLat,
            lng: pLng,
            type,
            value: type === 'CASH_BUNDLE' ? 5000 : 40,
            bobPhase: Math.random() * Math.PI * 2,
            mesh: pickupGroup,
          });
        } else {
          break;
        }
      }

      // Despawn far or destroyed 3D Traffic & Police vehicles
      for (let i = trafficCars.length - 1; i >= 0; i--) {
        const c = trafficCars[i];
        const { distanceMeters } = latLngToMetersDelta(
          { lat: s.playerLat, lng: s.playerLng },
          { lat: c.lat, lng: c.lng }
        );
        if (distanceMeters > 260 || c.armor <= 0) {
          scene.remove(c.meshBundle.group);
          scene.remove(c.laserBeamMesh);
          trafficCars.splice(i, 1);
        }
      }

      const baseTrafficCap =
        graphicsQualityRef.current === 'LOW'
          ? 7
          : graphicsQualityRef.current === 'MEDIUM'
          ? 11
          : 14;
      const targetTrafficCount = baseTrafficCap + s.wantedStars * 2;
      const currentPoliceCount = trafficCars.filter((c) => c.isPolice).length;
      const desiredPoliceCount = s.wantedStars === 0 ? 0 : Math.min(5, s.wantedStars + 1);

      while (trafficCars.length < targetTrafficCount) {
        const needPolice = currentPoliceCount < desiredPoliceCount && Math.random() < 0.7;
        // Spawn NPC traffic along Kamarajar Salai (X around -4 to +8) or nearby avenues
        const laneX =
          s.worldX > -40
            ? Math.random() < 0.5
              ? 4.5
              : -4.5
            : s.worldX + (Math.random() - 0.5) * 90;
        const spawnZ = s.worldZ + (Math.random() < 0.5 ? -1 : 1) * (55 + Math.random() * 95);

        const civilianTypes: VehicleId[] = [
          'auto_rickshaw',
          'auto_rickshaw',
          'mtc_bus',
          'contessa_sedan',
          'ecr_bike',
        ];
        const chosenId: VehicleId = needPolice
          ? 'police_suv'
          : civilianTypes[Math.floor(Math.random() * civilianTypes.length)];
        const spec = VEHICLE_SPECS[chosenId];
        const heading = laneX > 0 ? -Math.PI / 2 : Math.PI / 2;

        spawnTrafficVehicleAt(spec, laneX, spawnZ, heading, false, needPolice);
      }

      // Telegraphed 3D Tactical Hazard Zones (Wanted >= 3)
      for (let i = hazardZones.length - 1; i >= 0; i--) {
        const h = hazardZones[i];
        if (h.windupTimer <= 0 && h.activeTimer <= 0) {
          scene.remove(h.group);
          hazardZones.splice(i, 1);
        }
      }

      if (s.wantedStars >= 3 && hazardZones.length < s.wantedStars - 1 && Math.random() < dt * 0.65) {
        const lookAheadDist = 40 + Math.random() * 32;
        const aheadX = Math.cos(s.angle) * lookAheadDist + (Math.random() - 0.5) * 18;
        const aheadY = Math.sin(s.angle) * lookAheadDist + (Math.random() - 0.5) * 18;
        const delta = metersToLatLngDelta(aheadX, aheadY);
        const hLat = s.playerLat + delta.dLat;
        const hLng = s.playerLng + delta.dLng;
        const posXZ = latLngToWorldXZ(hLat, hLng);
        const radiusMeters = 11;

        const hGroup = new THREE.Group();
        hGroup.position.set(posXZ.x, 0.14, posXZ.z);

        const hType = s.wantedStars >= 4 ? 'EMP_MORTAR' : 'SPIKE_BARRICADE';
        const hColor = hType === 'EMP_MORTAR' ? 0xf43f5e : 0xf59e0b;

        const outerRing = new THREE.Mesh(
          new THREE.RingGeometry(radiusMeters - 0.45, radiusMeters, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: hColor, side: THREE.DoubleSide, depthWrite: false })
        );
        hGroup.add(outerRing);

        const innerDisc = new THREE.Mesh(
          new THREE.CircleGeometry(radiusMeters, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({
            color: hColor,
            transparent: true,
            opacity: 0.32,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        innerDisc.scale.setScalar(0.05);
        hGroup.add(innerDisc);

        scene.add(hGroup);
        hazardZones.push({
          id: nextEntityId++,
          lat: hLat,
          lng: hLng,
          radiusMeters,
          windupTimer: 1.5,
          maxWindup: 1.5,
          activeTimer: 0.4,
          type: hType,
          group: hGroup,
          innerDisc,
          outerRing,
        });
      }
    };

    // Software-WebGL fence pacing helper (Mandatory Three.js Skill Standard)
    let frameId = 0;
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let lastTime = performance.now();
    let hudSyncAccumulator = 0;
    let lastRouteSyncKey = '';

    const tick = () => {
      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      const timeSec = now * 0.001;

      const s = simRef.current;

      // Update Lighting / Sky Mood based on TimeOfDayMode
      const tod = timeOfDayRef.current;
      if (tod === 'SUNSET') {
        skyColor.setHex(0x4c1d95);
        (scene.fog as THREE.FogExp2).color.setHex(0x7c2d12);
        envRig.sunLight.color.setHex(0xfdba74);
        envRig.sunLight.intensity = 2.6;
        envRig.hemiLight.intensity = 0.92;
      } else if (tod === 'NIGHT') {
        skyColor.setHex(0x020617);
        (scene.fog as THREE.FogExp2).color.setHex(0x0f172a);
        envRig.sunLight.color.setHex(0x38bdf8);
        envRig.sunLight.intensity = 1.05;
        envRig.hemiLight.intensity = 0.48;
      } else {
        skyColor.setHex(0x0284c7);
        (scene.fog as THREE.FogExp2).color.setHex(0x7dd3fc);
        envRig.sunLight.color.setHex(0xffffff);
        envRig.sunLight.intensity = 2.95;
        envRig.hemiLight.intensity = 1.32;
      }

      // Decay input buffers
      if (inputBufferRef.current.enterExitBuffered > 0) {
        inputBufferRef.current.enterExitBuffered = Math.max(
          0,
          inputBufferRef.current.enterExitBuffered - dt
        );
      }
      if (inputBufferRef.current.empBuffered > 0) {
        inputBufferRef.current.empBuffered = Math.max(0, inputBufferRef.current.empBuffered - dt);
      }
      if (inputBufferRef.current.hornBuffered > 0) {
        inputBufferRef.current.hornBuffered = Math.max(0, inputBufferRef.current.hornBuffered - dt);
      }
      if (inputBufferRef.current.jumpBuffered > 0) {
        inputBufferRef.current.jumpBuffered = Math.max(0, inputBufferRef.current.jumpBuffered - dt);
      }
      if (s.manualOrbitTimer > 0) {
        s.manualOrbitTimer = Math.max(0, s.manualOrbitTimer - dt);
      }

      const isPlaying = gameStateRef.current === 'PLAYING';
      const isTitle = gameStateRef.current === 'TITLE_MENU';

      if (isTitle) {
        // Title Menu: Showcase both the 3D Human Character and Selected Vehicle on Marina Beach Promenade
        maintain3DEntities(dt);
        const dist = CHENNAI_DISTRICTS[selectedDistrictIdRef.current] || CHENNAI_DISTRICTS.marina_beach;
        s.worldX = dist.worldX + (dist.id === 'marina_beach' ? 16 : 0);
        s.worldZ = dist.worldZ;

        playerHuman.group.visible = true;
        playerHuman.group.position.set(s.worldX + 2.1, 0, s.worldZ + 0.8);
        playerHuman.group.rotation.y = Math.PI / 2;
        updateHumanCharacterAnimation(playerHuman, 'IDLE', 0, 0, timeSec, dt);

        playerVehicleBundle.group.visible = true;
        playerVehicleBundle.group.position.set(s.worldX, 0, s.worldZ);
        playerVehicleBundle.group.rotation.y = Math.PI / 2;
        playerVehicleBundle.wheels.forEach((w) => {
          w.rotation.z -= dt * 2.5;
        });

        envRig.updateAroundPlayer(s.worldX, s.worldZ, timeSec, tod);

        const orbitAng = timeSec * 0.36;
        camera.position.set(
          s.worldX + Math.cos(orbitAng) * 9.5,
          3.6 + Math.sin(timeSec * 0.6) * 0.4,
          s.worldZ + Math.sin(orbitAng) * 9.5
        );
        camera.lookAt(s.worldX + 1.0, 1.35, s.worldZ);
        soundEngine.updateLoop(false, 0, false, false, 0, dt);
      } else if (isPlaying) {
        if (s.hitstopTimer > 0) {
          s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
        } else {
          maintain3DEntities(dt);

          const keys = keysHeldRef.current;

          // Find closest enterable vehicle within 8.5 meters
          let closestVehicleCandidate: SimTrafficCar3D | null = null;
          let closestVehicleDist = 8.5;
          for (const car of trafficCars) {
            const { distanceMeters } = latLngToMetersDelta(
              { lat: s.playerLat, lng: s.playerLng },
              { lat: car.lat, lng: car.lng }
            );
            if (distanceMeters < closestVehicleDist) {
              closestVehicleDist = distanceMeters;
              closestVehicleCandidate = car;
            }
          }

          // ====================================================================
          // HANDLE [E] VEHICLE ENTER / EXIT TRANSITION
          // ====================================================================
          if (inputBufferRef.current.enterExitBuffered > 0) {
            inputBufferRef.current.enterExitBuffered = 0;

            if (s.controlMode === 'ON_FOOT' && closestVehicleCandidate) {
              // Enter the nearby vehicle!
              const newSpec = closestVehicleCandidate.spec;
              s.controlMode = 'DRIVING';
              s.vehicle = newSpec;
              s.armor = newSpec.maxArmor;
              s.playerLat = closestVehicleCandidate.lat;
              s.playerLng = closestVehicleCandidate.lng;
              const carXZ = latLngToWorldXZ(closestVehicleCandidate.lat, closestVehicleCandidate.lng);
              s.worldX = carXZ.x;
              s.worldZ = carXZ.z;
              s.angle = closestVehicleCandidate.angle;
              s.orbitYaw = s.angle;
              s.vx = closestVehicleCandidate.vx;
              s.vy = closestVehicleCandidate.vy;
              s.needsPlayerMeshRebuild = true;
              playerHuman.group.visible = false;
              playerVehicleBundle.group.visible = true;
              soundEngine.playPickup(true);
              s.statusBanner = `ENTERED ${newSpec.name.toUpperCase()} — PRESS [E] TO EXIT ANYTIME`;
              s.statusBannerTimer = 3.2;

              if (closestVehicleCandidate.isPolice) {
                s.wantedStars = Math.min(5, Math.max(2, s.wantedStars + 1));
              }
              closestVehicleCandidate.armor = 0; // Remove entered car from NPC pool
            } else if (s.controlMode === 'DRIVING') {
              // Exit current vehicle onto the street beside the driver door!
              const exitAngle = s.angle - Math.PI / 2;
              const exitX = s.worldX + Math.cos(exitAngle) * 2.8;
              const exitZ = s.worldZ + Math.sin(exitAngle) * 2.8;

              // Leave the vehicle parked at current spot
              spawnTrafficVehicleAt(s.vehicle, s.worldX, s.worldZ, s.angle, true, false);

              s.controlMode = 'ON_FOOT';
              s.characterAnim = 'IDLE';
              s.worldX = exitX;
              s.worldZ = exitZ;
              const delta = metersToLatLngDelta(s.worldX, s.worldZ);
              s.playerLat = INITIAL_VIEWPORT_CENTER.lat + delta.dLat;
              s.playerLng = INITIAL_VIEWPORT_CENTER.lng + delta.dLng;
              s.vx = 0;
              s.vy = 0;
              s.speed = 0;
              s.jumpY = 0;
              s.jumpVelY = 0;
              s.isGrounded = true;
              playerVehicleBundle.group.visible = false;
              playerHuman.group.visible = true;
              soundEngine.playPickup(false);
              s.statusBanner = 'ON FOOT · நடந்து செல்கிறீர்கள் — PRESS [E] NEAR ANY CAR TO DRIVE';
              s.statusBannerTimer = 3.0;
            }
          }

          // ====================================================================
          // MODE A: THIRD-PERSON HUMAN CHARACTER MOVEMENT (ON_FOOT)
          // ====================================================================
          if (s.controlMode === 'ON_FOOT') {
            playerHuman.group.visible = true;
            playerVehicleBundle.group.visible = false;

            const moveForwardInput =
              (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
              (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
            const moveRightInput =
              (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
              (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
            const isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']) && s.stamina > 5;

            // Jump trigger (`Space`)
            if (inputBufferRef.current.jumpBuffered > 0 && s.isGrounded) {
              inputBufferRef.current.jumpBuffered = 0;
              s.jumpVelY = 8.2;
              s.isGrounded = false;
              s.characterAnim = 'JUMP';
              spawnParticles3D(s.worldX, 0.15, s.worldZ, 6, 0xfde68a, 1.5, 4.5, 0.65, 3.2);
            }

            // Vertical Jump Gravity Kinematics
            if (!s.isGrounded || s.jumpY > 0) {
              s.jumpY += s.jumpVelY * dt;
              s.jumpVelY -= 21.5 * dt;
              if (s.jumpY <= 0) {
                s.jumpY = 0;
                s.jumpVelY = 0;
                s.isGrounded = true;
                spawnParticles3D(s.worldX, 0.12, s.worldZ, 5, 0xcbd5e1, 1.0, 3.5, 0.55, 3.5);
              }
            }

            const inputLen = Math.hypot(moveForwardInput, moveRightInput);
            if (inputLen > 0.05) {
              const normF = moveForwardInput / inputLen;
              const normR = moveRightInput / inputLen;

              // Move relative to current camera orbit yaw
              const camForwardX = Math.cos(s.orbitYaw);
              const camForwardZ = Math.sin(s.orbitYaw);
              const camRightX = -Math.sin(s.orbitYaw);
              const camRightZ = Math.cos(s.orbitYaw);

              const dirX = camForwardX * normF + camRightX * normR;
              const dirZ = camForwardZ * normF + camRightZ * normR;
              const targetAngle = Math.atan2(dirZ, dirX);

              // Smoothly rotate human character toward movement vector
              let angleDiff = targetAngle - s.angle;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              s.angle += angleDiff * Math.min(1, 14 * dt);

              const moveSpd = isSprinting ? 9.6 : 4.8;
              s.vx = THREE.MathUtils.damp(s.vx, Math.cos(targetAngle) * moveSpd, 12, dt);
              s.vy = THREE.MathUtils.damp(s.vy, Math.sin(targetAngle) * moveSpd, 12, dt);

              if (isSprinting) {
                s.stamina = Math.max(0, s.stamina - 16 * dt);
              } else {
                s.stamina = Math.min(100, s.stamina + 14 * dt);
              }
            } else {
              s.vx = THREE.MathUtils.damp(s.vx, 0, 14, dt);
              s.vy = THREE.MathUtils.damp(s.vy, 0, 14, dt);
              s.stamina = Math.min(100, s.stamina + 20 * dt);
            }

            s.speed = Math.hypot(s.vx, s.vy);
            if (!s.isGrounded) {
              s.characterAnim = 'JUMP';
            } else if (s.speed > 6.2) {
              s.characterAnim = 'RUN';
            } else if (s.speed > 0.45) {
              s.characterAnim = 'WALK';
            } else {
              s.characterAnim = 'IDLE';
            }

            const nextX = s.worldX + s.vx * dt;
            const nextZ = s.worldZ + s.vy * dt;
            const colRes = resolveWorldCollisions(nextX, nextZ, 0.65);
            s.worldX = colRes.x;
            s.worldZ = colRes.z;
            s.activeColliderLabel = colRes.hitLabel;

            const delta = metersToLatLngDelta(s.worldX, s.worldZ);
            s.playerLat = INITIAL_VIEWPORT_CENTER.lat + delta.dLat;
            s.playerLng = INITIAL_VIEWPORT_CENTER.lng + delta.dLng;
            mapCenterRef.current = { lat: s.playerLat, lng: s.playerLng };
            playerHeadingRef.current = (s.angle * 180) / Math.PI + 90;

            playerHuman.group.position.set(s.worldX, 0, s.worldZ);
            playerHuman.group.rotation.y = -s.angle;
            updateHumanCharacterAnimation(
              playerHuman,
              s.characterAnim,
              s.speed,
              s.jumpY,
              timeSec,
              dt
            );

            soundEngine.updateLoop(false, 0, false, false, s.wantedStars, dt);
          } else {
            // ====================================================================
            // MODE B: 3D VEHICLE DRIVING PHYSICS (DRIVING)
            // ====================================================================
            playerHuman.group.visible = false;
            playerVehicleBundle.group.visible = true;

            const throttle =
              (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) -
              (keys['KeyS'] || keys['ArrowDown'] ? 0.65 : 0);
            const steer =
              (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
              (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
            const isDrifting = Boolean(keys['Space']);
            const isBoosting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']);

            s.steerInputSmoothed = THREE.MathUtils.damp(s.steerInputSmoothed, steer, 10, dt);

            if (inputBufferRef.current.hornBuffered > 0) {
              inputBufferRef.current.hornBuffered = 0;
              soundEngine.playAutoHorn(s.vehicle.id === 'mtc_bus');
              s.scaleX = 1.14;
              s.scaleY = 0.88;
            }

            if (inputBufferRef.current.empBuffered > 0 && s.empCharge >= 100) {
              inputBufferRef.current.empBuffered = 0;
              s.empCharge = 0;
              s.empWaveRadius = 2;
              s.empWaveAlpha = 1;
              s.shakeIntensity = 1.8;
              s.hitstopTimer = 0.055;
              soundEngine.playEmpBlast();
              s.statusBanner = '3D SHOCKWAVE PULSE UNLEASHED!';
              s.statusBannerTimer = 2.4;

              for (const car of trafficCars) {
                const { dxMeters, dyMeters, distanceMeters } = latLngToMetersDelta(
                  { lat: s.playerLat, lng: s.playerLng },
                  { lat: car.lat, lng: car.lng }
                );
                if (distanceMeters < 60) {
                  const pushAngle = Math.atan2(dyMeters, dxMeters);
                  car.vx += Math.cos(pushAngle) * 44;
                  car.vy += Math.sin(pushAngle) * 44;
                  car.stunTimer = 4.0;
                  car.aiState = 'STUNNED';
                  car.hitFlash = 0.4;
                  car.armor -= 105;
                  const carXZ = latLngToWorldXZ(car.lat, car.lng);
                  spawnParticles3D(carXZ.x, 1.5, carXZ.z, 18, 0x38bdf8, 8, 26, 1.2, 2.0);
                  if (car.armor <= 0 && car.isPolice) {
                    s.policeDefeated += 1;
                    s.cashInr += 10000;
                    s.respect += 50;
                  }
                }
              }
            }

            const forwardX = Math.cos(s.angle);
            const forwardY = Math.sin(s.angle);
            const forwardSpeed = s.vx * forwardX + s.vy * forwardY;

            const steerFactor = Math.min(1, Math.abs(forwardSpeed) / 7 + 0.25);
            const driftMult = isDrifting ? 1.48 : 1.0;
            const steerDir = forwardSpeed >= -1 ? 1 : -1;
            s.angle += steer * s.vehicle.handling * driftMult * steerFactor * steerDir * dt;
            playerHeadingRef.current = (s.angle * 180) / Math.PI + 90;

            // Smoothly align orbitYaw behind car when player isn't actively dragging mouse
            if (s.manualOrbitTimer <= 0 && Math.abs(forwardSpeed) > 2) {
              let yawDiff = s.angle - s.orbitYaw;
              while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
              while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
              s.orbitYaw += yawDiff * Math.min(1, 5.5 * dt);
            }

            let accelForce = throttle * s.vehicle.acceleration;
            if (isBoosting && s.nitrous > 2 && throttle > 0) {
              accelForce *= 1.55;
              s.nitrous = Math.max(0, s.nitrous - 28 * dt);
              const rearX = s.worldX - Math.cos(s.angle) * 2.2;
              const rearZ = s.worldZ - Math.sin(s.angle) * 2.2;
              spawnParticles3D(rearX, 0.65, rearZ, 2, 0x38bdf8, 4, 14, 0.9, 3.8);
            } else {
              s.nitrous = Math.min(100, s.nitrous + 9 * dt);
            }

            s.empCharge = Math.min(100, s.empCharge + 8.5 * dt);

            s.vx += Math.cos(s.angle) * accelForce * dt;
            s.vy += Math.sin(s.angle) * accelForce * dt;

            const rightX = -Math.sin(s.angle);
            const rightY = Math.cos(s.angle);
            const lateralVel = s.vx * rightX + s.vy * rightY;
            const grip = isDrifting ? 0.96 : s.vehicle.driftGrip;
            s.vx -= rightX * lateralVel * (1 - Math.pow(grip, dt * 60));
            s.vy -= rightY * lateralVel * (1 - Math.pow(grip, dt * 60));

            const drag = isDrifting && throttle === 0 ? 0.94 : 0.986;
            s.vx *= Math.pow(drag, dt * 60);
            s.vy *= Math.pow(drag, dt * 60);

            s.speed = Math.hypot(s.vx, s.vy);
            const maxSpd =
              isBoosting && s.nitrous > 0 ? s.vehicle.maxSpeed * 1.28 : s.vehicle.maxSpeed;
            if (s.speed > maxSpd) {
              s.vx = (s.vx / s.speed) * maxSpd;
              s.vy = (s.vy / s.speed) * maxSpd;
              s.speed = maxSpd;
            }

            if ((isDrifting || Math.abs(lateralVel) > 11) && s.speed > 13) {
              const rearX = s.worldX - Math.cos(s.angle) * 1.9;
              const rearZ = s.worldZ - Math.sin(s.angle) * 1.9;
              spawnParticles3D(rearX, 0.35, rearZ, 1, 0x94a3b8, 2, 7, 1.1, 2.4);
            }

            const nextX = s.worldX + s.vx * dt;
            const nextZ = s.worldZ + s.vy * dt;
            const colRes = resolveWorldCollisions(nextX, nextZ, 2.2);
            if (colRes.hit && s.speed > 8) {
              s.vx *= -0.35;
              s.vy *= -0.35;
              s.shakeIntensity = Math.min(1.5, s.speed * 0.025);
              soundEngine.playImpact(Math.min(1, s.speed / 45));
            }
            s.worldX = colRes.x;
            s.worldZ = colRes.z;
            s.activeColliderLabel = colRes.hitLabel;

            const delta = metersToLatLngDelta(s.worldX, s.worldZ);
            s.playerLat = INITIAL_VIEWPORT_CENTER.lat + delta.dLat;
            s.playerLng = INITIAL_VIEWPORT_CENTER.lng + delta.dLng;
            mapCenterRef.current = { lat: s.playerLat, lng: s.playerLng };

            playerVehicleBundle.group.position.set(s.worldX, 0, s.worldZ);
            playerVehicleBundle.group.rotation.y = -s.angle;

            s.scaleX = THREE.MathUtils.damp(s.scaleX, 1, 14, dt);
            s.scaleY = THREE.MathUtils.damp(s.scaleY, 1, 14, dt);
            playerVehicleBundle.group.scale.set(s.scaleX, s.scaleY, s.scaleX);

            const targetRoll = -s.steerInputSmoothed * Math.min(1, s.speed / 35) * 0.14;
            const targetPitch = -throttle * 0.05;
            s.rollAngle = THREE.MathUtils.damp(s.rollAngle, targetRoll, 10, dt);
            s.pitchAngle = THREE.MathUtils.damp(s.pitchAngle, targetPitch, 10, dt);
            playerVehicleBundle.chassisGroup.rotation.x = s.rollAngle;
            playerVehicleBundle.chassisGroup.rotation.z = s.pitchAngle;

            playerVehicleBundle.wheels.forEach((w) => {
              w.rotation.z -= (forwardSpeed / 0.42) * dt;
            });
            playerVehicleBundle.frontWheels.forEach((fw) => {
              fw.rotation.y = -s.steerInputSmoothed * 0.42;
            });

            s.playerHitFlash = Math.max(0, s.playerHitFlash - dt);
            playerVehicleBundle.primaryMats.forEach((m) => {
              m.color.setHex(s.playerHitFlash > 0 ? 0xffffff : playerVehicleBundle.baseColorHex);
            });
            if (playerVehicleBundle.sirenLeftMat && playerVehicleBundle.sirenRightMat) {
              const redOn = Math.floor(timeSec * 10) % 2 === 0;
              playerVehicleBundle.sirenLeftMat.emissiveIntensity = redOn ? 2.5 : 0.2;
              playerVehicleBundle.sirenRightMat.emissiveIntensity = redOn ? 0.2 : 2.5;
            }

            soundEngine.updateLoop(
              true,
              s.speed / s.vehicle.maxSpeed,
              s.vehicle.id === 'auto_rickshaw',
              isDrifting && s.speed > 14,
              s.wantedStars,
              dt
            );
          }

          // Update 3D EMP Ring
          if (s.empWaveAlpha > 0) {
            s.empWaveRadius += 95 * dt;
            s.empWaveAlpha = Math.max(0, s.empWaveAlpha - dt * 1.8);
            empRingMesh.visible = true;
            empRingMesh.position.set(s.worldX, 0.5, s.worldZ);
            empRingMesh.scale.setScalar(s.empWaveRadius);
            empRingMat.opacity = s.empWaveAlpha;
          } else {
            empRingMesh.visible = false;
          }

          s.shakeIntensity = THREE.MathUtils.damp(s.shakeIntensity, 0, 8, dt);

          if (s.statusBannerTimer > 0) {
            s.statusBannerTimer = Math.max(0, s.statusBannerTimer - dt);
            if (s.statusBannerTimer === 0) s.statusBanner = null;
          }

          // Wanted Level Cooldown
          if (s.wantedStars > 0) {
            const closePolice = trafficCars.some((c) => {
              if (!c.isPolice) return false;
              const { distanceMeters } = latLngToMetersDelta(
                { lat: s.playerLat, lng: s.playerLng },
                { lat: c.lat, lng: c.lng }
              );
              return distanceMeters < 85;
            });
            if (!closePolice) {
              s.wantedCooldown += dt;
              if (s.wantedCooldown >= 14) {
                s.wantedStars = Math.max(0, s.wantedStars - 1);
                s.wantedCooldown = 0;
                s.statusBanner =
                  s.wantedStars === 0
                    ? 'WANTED LEVEL CLEARED'
                    : `HEAT REDUCED TO ${s.wantedStars} STARS`;
                s.statusBannerTimer = 2.5;
              }
            } else {
              s.wantedCooldown = Math.max(0, s.wantedCooldown - dt * 0.5);
            }
          } else {
            s.wantedCooldown = 0;
          }

          // Update Walking NPC Pedestrians along Marina Promenade & Sidewalks
          for (const ped of pedestrians) {
            ped.worldX += ped.vx * dt;
            ped.worldZ += ped.vz * dt;
            ped.bundle.group.position.set(ped.worldX, 0, ped.worldZ);
            ped.bundle.group.rotation.y = -ped.angle;
            updateHumanCharacterAnimation(ped.bundle, 'WALK', ped.walkSpeed, 0, timeSec, dt);
          }

          // Update Traffic & Police 3D AI + Collisions
          for (const car of trafficCars) {
            car.hitFlash = Math.max(0, car.hitFlash - dt);
            car.scaleX = THREE.MathUtils.damp(car.scaleX, 1, 12, dt);
            car.scaleY = THREE.MathUtils.damp(car.scaleY, 1, 12, dt);

            const { dxMeters, dyMeters, distanceMeters } = latLngToMetersDelta(
              { lat: s.playerLat, lng: s.playerLng },
              { lat: car.lat, lng: car.lng }
            );

            if (car.isParked && car.aiState === 'PARKED') {
              car.vx *= Math.pow(0.88, dt * 60);
              car.vy *= Math.pow(0.88, dt * 60);
              car.laserBeamMesh.visible = false;
            } else if (car.stunTimer > 0) {
              car.stunTimer = Math.max(0, car.stunTimer - dt);
              car.vx *= Math.pow(0.92, dt * 60);
              car.vy *= Math.pow(0.92, dt * 60);
              car.laserBeamMesh.visible = false;
              if (car.stunTimer === 0) {
                car.aiState = car.isPolice ? 'PURSUIT' : 'CRUISE';
              }
            } else if (car.isPolice && s.wantedStars > 0) {
              const angleToPlayer = Math.atan2(-dyMeters, -dxMeters);

              if (car.aiState === 'PURSUIT') {
                car.laserBeamMesh.visible = false;
                let diff = angleToPlayer - car.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                car.angle += Math.sign(diff) * Math.min(Math.abs(diff), 3.2 * dt);

                const chaseSpeed = 30 + s.wantedStars * 4.2;
                car.vx = Math.cos(car.angle) * chaseSpeed;
                car.vy = Math.sin(car.angle) * chaseSpeed;

                if (distanceMeters < 44 && distanceMeters > 14 && Math.abs(diff) < 0.42) {
                  car.aiState = 'WINDUP_LUNGE';
                  car.windupTimer = 0.95;
                  car.targetAngle = angleToPlayer;
                }
              } else if (car.aiState === 'WINDUP_LUNGE') {
                car.windupTimer -= dt;
                car.angle = car.targetAngle;
                car.vx = Math.cos(car.angle) * 20;
                car.vy = Math.sin(car.angle) * 20;
                car.laserBeamMesh.visible = true;
                if (car.windupTimer <= 0) {
                  car.aiState = 'LUNGING';
                  car.lungeTimer = 0.65;
                  car.scaleX = 1.25;
                  car.scaleY = 0.8;
                  car.laserBeamMesh.visible = false;
                }
              } else if (car.aiState === 'LUNGING') {
                car.lungeTimer -= dt;
                car.laserBeamMesh.visible = false;
                const lungeSpeed = 62 + s.wantedStars * 4;
                car.vx = Math.cos(car.angle) * lungeSpeed;
                car.vy = Math.sin(car.angle) * lungeSpeed;
                if (car.lungeTimer <= 0) {
                  car.aiState = 'PURSUIT';
                }
              }
            } else {
              car.laserBeamMesh.visible = false;
              const cruiseSpd = 16;
              car.vx = Math.cos(car.angle) * cruiseSpd;
              car.vy = Math.sin(car.angle) * cruiseSpd;
            }

            const cDelta = metersToLatLngDelta(car.vx * dt, car.vy * dt);
            car.lat += cDelta.dLat;
            car.lng += cDelta.dLng;

            const carXZ = latLngToWorldXZ(car.lat, car.lng);
            car.meshBundle.group.position.set(carXZ.x, 0, carXZ.z);
            car.meshBundle.group.rotation.y = -car.angle;
            car.meshBundle.group.scale.set(car.scaleX, car.scaleY, car.scaleX);

            if (car.laserBeamMesh.visible) {
              car.laserBeamMesh.position.set(carXZ.x, 0.35, carXZ.z);
              car.laserBeamMesh.rotation.y = -car.angle;
            }

            const carSpd = Math.hypot(car.vx, car.vy);
            car.meshBundle.wheels.forEach((w) => {
              w.rotation.z -= (carSpd / 0.42) * dt;
            });
            car.meshBundle.primaryMats.forEach((m) => {
              m.color.setHex(car.hitFlash > 0 ? 0xffffff : car.meshBundle.baseColorHex);
            });
            if (car.meshBundle.sirenLeftMat && car.meshBundle.sirenRightMat) {
              const redOn = Math.floor(timeSec * 11 + car.id) % 2 === 0;
              car.meshBundle.sirenLeftMat.emissiveIntensity = redOn ? 2.5 : 0.2;
              car.meshBundle.sirenRightMat.emissiveIntensity = redOn ? 0.2 : 2.5;
            }

            // Collision Check against Player
            const collisionRadiusMeters = s.controlMode === 'DRIVING' ? 3.2 : 2.0;
            if (distanceMeters < collisionRadiusMeters) {
              const relVx = s.vx - car.vx;
              const relVy = s.vy - car.vy;
              const impactSpeed = Math.hypot(relVx, relVy);

              const pushAngle = Math.atan2(dyMeters, dxMeters);
              const overlap = collisionRadiusMeters - distanceMeters + 0.35;
              const pushDelta = metersToLatLngDelta(
                Math.cos(pushAngle) * overlap,
                Math.sin(pushAngle) * overlap
              );
              car.lat += pushDelta.dLat;
              car.lng += pushDelta.dLng;

              if (impactSpeed > 7) {
                const playerMass = s.controlMode === 'DRIVING' ? s.vehicle.mass : 0.4;
                const massRatio = playerMass / car.spec.mass;
                car.vx += Math.cos(pushAngle) * impactSpeed * 0.78 * massRatio;
                car.vy += Math.sin(pushAngle) * impactSpeed * 0.78 * massRatio;
                s.vx -= Math.cos(pushAngle) * impactSpeed * (0.3 / Math.max(0.4, massRatio));
                s.vy -= Math.sin(pushAngle) * impactSpeed * (0.3 / Math.max(0.4, massRatio));

                const dmgToCar = impactSpeed * 1.45 * massRatio;
                const dmgToPlayer = Math.max(2, (impactSpeed * 0.35) / Math.max(0.5, massRatio));

                car.armor -= dmgToCar;
                if (s.controlMode === 'DRIVING') {
                  s.armor = Math.max(0, s.armor - dmgToPlayer);
                } else {
                  s.health = Math.max(0, s.health - dmgToPlayer * 0.65);
                }

                car.hitFlash = 0.22;
                s.playerHitFlash = 0.22;
                s.scaleX = 0.85;
                s.scaleY = 1.18;
                car.scaleX = 0.82;
                car.scaleY = 1.2;

                if (impactSpeed > 24) {
                  s.hitstopTimer = Math.min(0.07, 0.03 + (impactSpeed / 85) * 0.04);
                }
                s.shakeIntensity = Math.min(2.2, 0.4 + impactSpeed * 0.03);
                soundEngine.playImpact(impactSpeed / 55);

                spawnParticles3D(
                  (s.worldX + carXZ.x) * 0.5,
                  1.1,
                  (s.worldZ + carXZ.z) * 0.5,
                  14,
                  0xf59e0b,
                  8,
                  26,
                  0.9,
                  2.3
                );

                if (car.isPolice) {
                  s.wantedStars = Math.min(5, Math.max(1, s.wantedStars));
                }

                if (car.armor <= 0) {
                  spawnParticles3D(carXZ.x, 1.5, carXZ.z, 24, 0xef4444, 12, 34, 1.4, 1.8);
                  s.cashInr += car.isPolice ? 12000 : 3500;
                  s.respect += car.isPolice ? 65 : 15;
                  if (car.isPolice) s.policeDefeated += 1;
                }

                if (
                  (s.controlMode === 'DRIVING' && s.armor <= 0) ||
                  (s.controlMode === 'ON_FOOT' && s.health <= 0)
                ) {
                  soundEngine.playMissionComplete(false);
                  callbacksRef.current.onPlayerWasted(
                    s.controlMode === 'DRIVING'
                      ? 'Your 3D vehicle was wrecked in Chennai traffic.'
                      : 'You were knocked out on Kamarajar Salai.'
                  );
                }
              }
            }
          }

          // Update Telegraphed 3D Hazard Zones
          for (const h of hazardZones) {
            if (h.windupTimer > 0) {
              h.windupTimer = Math.max(0, h.windupTimer - dt);
              const progress = Math.max(0.05, 1 - h.windupTimer / h.maxWindup);
              h.innerDisc.scale.setScalar(progress);
              if (h.windupTimer === 0) {
                const { distanceMeters } = latLngToMetersDelta(
                  { lat: s.playerLat, lng: s.playerLng },
                  { lat: h.lat, lng: h.lng }
                );
                const hXZ = latLngToWorldXZ(h.lat, h.lng);
                spawnParticles3D(hXZ.x, 1.2, hXZ.z, 20, 0xf43f5e, 10, 30, 1.3, 2.0);
                if (distanceMeters <= h.radiusMeters) {
                  s.armor = Math.max(0, s.armor - 34);
                  s.shakeIntensity = 1.9;
                  s.playerHitFlash = 0.35;
                  soundEngine.playImpact(0.95);
                  if (s.armor <= 0) {
                    callbacksRef.current.onPlayerWasted(
                      'Direct hit from a tactical police blockade mortar.'
                    );
                  }
                }
              }
            } else if (h.activeTimer > 0) {
              h.activeTimer = Math.max(0, h.activeTimer - dt);
            }
          }

          // Check 3D Pickups Collection
          for (let i = worldPickups.length - 1; i >= 0; i--) {
            const p = worldPickups[i];
            p.mesh.rotation.y += dt * 2.2;
            p.mesh.position.y = Math.sin(timeSec * 3.5 + p.bobPhase) * 0.25;

            const { distanceMeters } = latLngToMetersDelta(
              { lat: s.playerLat, lng: s.playerLng },
              { lat: p.lat, lng: p.lng }
            );
            if (distanceMeters < 6.5) {
              const pXZ = latLngToWorldXZ(p.lat, p.lng);
              if (p.type === 'CASH_BUNDLE') {
                s.cashInr += p.value;
                s.respect += 15;
                soundEngine.playPickup(true);
                spawnParticles3D(pXZ.x, 1.2, pXZ.z, 12, 0x10b981, 6, 18, 0.9, 2.5);
              } else if (p.type === 'KAAPI_NITRO') {
                s.nitrous = 100;
                s.empCharge = Math.min(100, s.empCharge + 40);
                s.stamina = 100;
                soundEngine.playPickup(false);
                spawnParticles3D(pXZ.x, 1.2, pXZ.z, 12, 0xf59e0b, 6, 18, 0.9, 2.5);
              } else if (p.type === 'ARMOR_VEST') {
                s.armor = Math.min(s.vehicle.maxArmor, s.armor + 55);
                s.health = Math.min(100, s.health + 45);
                soundEngine.playPickup(false);
                spawnParticles3D(pXZ.x, 1.2, pXZ.z, 12, 0x38bdf8, 6, 18, 0.9, 2.5);
              }
              scene.remove(p.mesh);
              worldPickups.splice(i, 1);
            }
          }

          // Check Service Garages (Pay 'n' Spray / Filter Kaapi Stalls)
          let closestServiceNode: DiscoveredPlaceNode | null = null;
          for (const node of discoveredNodesRef.current) {
            if (node.category !== 'PAY_N_SPRAY' && node.category !== 'KAAPI_STALL') continue;
            const { distanceMeters } = latLngToMetersDelta(
              { lat: s.playerLat, lng: s.playerLng },
              node.location
            );
            if (distanceMeters < 24) {
              closestServiceNode = node;
              if (node.category === 'PAY_N_SPRAY') {
                if (s.armor < s.vehicle.maxArmor || s.wantedStars > 0) {
                  s.armor = s.vehicle.maxArmor;
                  s.health = 100;
                  s.wantedStars = 0;
                  s.wantedCooldown = 0;
                  soundEngine.playPickup(true);
                  s.statusBanner = `PAY 'N' SPRAY: ${node.displayName.toUpperCase()} — HEAT CLEARED!`;
                  s.statusBannerTimer = 3.0;
                }
              } else if (node.category === 'KAAPI_STALL') {
                if (s.nitrous < 95 || s.empCharge < 95) {
                  s.nitrous = 100;
                  s.empCharge = 100;
                  s.stamina = 100;
                  soundEngine.playPickup(false);
                  s.statusBanner = `FILTER KAAPI BOOST: ${node.displayName.toUpperCase()}`;
                  s.statusBannerTimer = 2.5;
                }
              }
            }
          }

          // Update Active Mission Checkpoints & 3D GPS Route Ribbon
          const actMission = activeMissionRef.current;
          let missionDistRemaining = 0;
          if (actMission) {
            s.missionTimer = Math.max(0, s.missionTimer - dt);
            const targetCoords =
              actMission.stage === 'GO_TO_ORIGIN'
                ? actMission.originLocation
                : actMission.destinationLocation;

            const { distanceMeters } = latLngToMetersDelta(
              { lat: s.playerLat, lng: s.playerLng },
              targetCoords
            );
            missionDistRemaining = Math.round(distanceMeters);

            const routeSyncKey = `${actMission.mission.id}_${actMission.stage}_${actMission.routePath.length}`;
            if (routeSyncKey !== lastRouteSyncKey) {
              lastRouteSyncKey = routeSyncKey;
              const ptsXZ = actMission.routePath.map((pt) => latLngToWorldXZ(pt.lat, pt.lng));
              envRig.updateGpsRibbon(
                ptsXZ,
                actMission.stage === 'GO_TO_ORIGIN' ? 0xf59e0b : 0x10b981
              );
            }

            if (distanceMeters < 26) {
              if (actMission.stage === 'GO_TO_ORIGIN') {
                soundEngine.playPickup(true);
                callbacksRef.current.onMissionAdvanceStage();
              } else {
                const reward = actMission.mission.rewardInr;
                const respect = actMission.mission.respectGain;
                s.cashInr += reward;
                s.respect += respect;
                s.missionsCompleted += 1;
                s.wantedStars = 0;
                soundEngine.playMissionComplete(true);
                callbacksRef.current.onMissionComplete(reward, respect);
              }
            } else if (s.missionTimer <= 0) {
              soundEngine.playMissionComplete(false);
              callbacksRef.current.onMissionFail('Contract timer expired in Chennai traffic.');
            }
          } else if (lastRouteSyncKey !== '') {
            lastRouteSyncKey = '';
            envRig.updateGpsRibbon([], 0x10b981);
          }

          // Update 3D City Chunks Around Player
          envRig.updateAroundPlayer(s.worldX, s.worldZ, timeSec, tod);

          // ==================================================================
          // 3D CAMERA FOLLOW + MOUSE ORBIT KINEMATICS (THREE.MathUtils.damp)
          // ==================================================================
          const camMode = cameraModeRef.current;
          const shakeX = (Math.random() - 0.5) * s.shakeIntensity;
          const shakeY = (Math.random() - 0.5) * s.shakeIntensity * 0.5;

          if (s.controlMode === 'ON_FOOT') {
            // Smooth Third-Person Human Follow + Mouse Orbit Camera
            const camDist = 6.4;
            const camHeight = 1.65 + Math.sin(s.orbitPitch) * 3.8;
            const horizDist = Math.cos(s.orbitPitch) * camDist;

            _camDesiredPos.set(
              s.worldX - Math.cos(s.orbitYaw) * horizDist + shakeX,
              camHeight + s.jumpY * 0.5 + shakeY,
              s.worldZ - Math.sin(s.orbitYaw) * horizDist
            );
            _camLookTarget.set(
              s.worldX + Math.cos(s.orbitYaw) * 2.5,
              1.45 + s.jumpY * 0.5,
              s.worldZ + Math.sin(s.orbitYaw) * 2.5
            );

            _camCurrentPos.x = THREE.MathUtils.damp(_camCurrentPos.x, _camDesiredPos.x, 12, dt);
            _camCurrentPos.y = THREE.MathUtils.damp(_camCurrentPos.y, _camDesiredPos.y, 12, dt);
            _camCurrentPos.z = THREE.MathUtils.damp(_camCurrentPos.z, _camDesiredPos.z, 12, dt);

            _camCurrentLook.x = THREE.MathUtils.damp(_camCurrentLook.x, _camLookTarget.x, 15, dt);
            _camCurrentLook.y = THREE.MathUtils.damp(_camCurrentLook.y, _camLookTarget.y, 15, dt);
            _camCurrentLook.z = THREE.MathUtils.damp(_camCurrentLook.z, _camLookTarget.z, 15, dt);

            camera.position.copy(_camCurrentPos);
            camera.lookAt(_camCurrentLook);

            const targetFov = s.characterAnim === 'RUN' ? 66 : 60;
            camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
            camera.updateProjectionMatrix();
          } else if (camMode === 'CHASE') {
            const chaseDist = s.vehicle.id === 'mtc_bus' ? 14.5 : 9.8;
            const chaseHeight =
              (s.vehicle.id === 'mtc_bus' ? 5.2 : 3.6) + Math.sin(s.orbitPitch) * 2.2;
            const camYaw = s.manualOrbitTimer > 0 ? s.orbitYaw : s.angle;

            _camDesiredPos.set(
              s.worldX - Math.cos(camYaw) * chaseDist + shakeX,
              chaseHeight + shakeY,
              s.worldZ - Math.sin(camYaw) * chaseDist
            );
            _camLookTarget.set(
              s.worldX + Math.cos(camYaw) * 6.5,
              1.35,
              s.worldZ + Math.sin(camYaw) * 6.5
            );

            _camCurrentPos.x = THREE.MathUtils.damp(_camCurrentPos.x, _camDesiredPos.x, 10, dt);
            _camCurrentPos.y = THREE.MathUtils.damp(_camCurrentPos.y, _camDesiredPos.y, 10, dt);
            _camCurrentPos.z = THREE.MathUtils.damp(_camCurrentPos.z, _camDesiredPos.z, 10, dt);

            _camCurrentLook.x = THREE.MathUtils.damp(_camCurrentLook.x, _camLookTarget.x, 14, dt);
            _camCurrentLook.y = THREE.MathUtils.damp(_camCurrentLook.y, _camLookTarget.y, 14, dt);
            _camCurrentLook.z = THREE.MathUtils.damp(_camCurrentLook.z, _camLookTarget.z, 14, dt);

            camera.position.copy(_camCurrentPos);
            camera.lookAt(_camCurrentLook);

            const targetFov = 60 + Math.min(18, (s.speed / s.vehicle.maxSpeed) * 16);
            camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 8, dt);
            camera.updateProjectionMatrix();
          } else if (camMode === 'HOOD') {
            const hoodForward = s.vehicle.id === 'mtc_bus' ? 4.3 : 1.4;
            const hoodHeight = s.vehicle.id === 'mtc_bus' ? 2.4 : 1.55;
            camera.position.set(
              s.worldX + Math.cos(s.angle) * hoodForward + shakeX * 0.3,
              hoodHeight + shakeY * 0.3,
              s.worldZ + Math.sin(s.angle) * hoodForward
            );
            camera.lookAt(
              s.worldX + Math.cos(s.angle) * 28,
              hoodHeight - 0.2,
              s.worldZ + Math.sin(s.angle) * 28
            );
          } else {
            // HELI TACTICAL TOP-DOWN 3D VIEW
            _camDesiredPos.set(
              s.worldX - Math.cos(s.angle) * 14,
              46,
              s.worldZ - Math.sin(s.angle) * 14
            );
            _camCurrentPos.x = THREE.MathUtils.damp(_camCurrentPos.x, _camDesiredPos.x, 8, dt);
            _camCurrentPos.y = THREE.MathUtils.damp(_camCurrentPos.y, _camDesiredPos.y, 8, dt);
            _camCurrentPos.z = THREE.MathUtils.damp(_camCurrentPos.z, _camDesiredPos.z, 8, dt);
            camera.position.copy(_camCurrentPos);
            camera.lookAt(s.worldX + Math.cos(s.angle) * 8, 0, s.worldZ + Math.sin(s.angle) * 8);
          }

          // Update 3D InstancedMesh Particles
          let anyParticleChanged = false;
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const pt = particles[i];
            if (pt.active) {
              anyParticleChanged = true;
              pt.x += pt.vx * dt;
              pt.y += pt.vy * dt;
              pt.z += pt.vz * dt;
              pt.vy -= 14 * dt;
              pt.alpha -= pt.decay * dt;
              if (pt.alpha <= 0 || pt.y < 0) {
                pt.active = false;
                particleInstanced.setMatrixAt(i, _zeroScaleMatrix);
              } else {
                _dummyObj.position.set(pt.x, pt.y, pt.z);
                _dummyObj.scale.setScalar(pt.size * pt.alpha);
                _dummyObj.updateMatrix();
                particleInstanced.setMatrixAt(i, _dummyObj.matrix);
                particleInstanced.setColorAt(i, pt.color);
              }
            }
          }
          if (anyParticleChanged) {
            particleInstanced.instanceMatrix.needsUpdate = true;
            if (particleInstanced.instanceColor) {
              particleInstanced.instanceColor.needsUpdate = true;
            }
          }

          // Sync HUD Snapshot (~12Hz)
          hudSyncAccumulator += dt;
          if (hudSyncAccumulator >= 0.085) {
            hudSyncAccumulator = 0;
            const speedKmh = Math.round(
              s.speed * (s.controlMode === 'DRIVING' ? 2.4 : 3.6)
            );
            const gear =
              s.controlMode === 'ON_FOOT'
                ? 'FOOT'
                : speedKmh === 0
                ? 'N'
                : speedKmh < 28
                ? '1'
                : speedKmh < 58
                ? '2'
                : speedKmh < 92
                ? '3'
                : speedKmh < 130
                ? '4'
                : '5';

            callbacksRef.current.onHudUpdate({
              controlMode: s.controlMode,
              characterAnim: s.characterAnim,
              health: Math.round(s.health),
              stamina: Math.round(s.stamina),
              speedKmh,
              gear,
              armor: Math.round(s.armor),
              maxArmor: s.vehicle.maxArmor,
              nitrous: Math.round(s.nitrous),
              empCharge: Math.round(s.empCharge),
              cashInr: s.cashInr,
              respect: s.respect,
              wantedStars: s.wantedStars,
              wantedCooldownProgress: Math.min(1, s.wantedCooldown / 14),
              vehicle: s.vehicle,
              nearbyHijackableVehicle: closestVehicleCandidate
                ? closestVehicleCandidate.spec
                : null,
              nearbyServiceNode: closestServiceNode,
              playerCoords: { lat: s.playerLat, lng: s.playerLng },
              headingDeg: playerHeadingRef.current,
              currentDistrict: getClosestChennaiDistrict(s.worldX, s.worldZ),
              activeColliderLabel: s.activeColliderLabel,
              osmRoadCount: s.osmRoadCount,
              activeMission: actMission
                ? {
                    ...actMission,
                    distanceRemainingMeters: missionDistRemaining,
                    timeRemainingSec: Math.ceil(s.missionTimer),
                  }
                : null,
              missionsCompleted: s.missionsCompleted,
              policeDefeated: s.policeDefeated,
              comboMultiplier: s.comboMultiplier,
              statusBanner: s.statusBanner,
            });
          }
        }
      } else {
        soundEngine.updateLoop(false, 0, false, false, 0, dt);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      soundEngine.stopAll();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full z-10 pointer-events-auto cursor-grab active:cursor-grabbing"
    />
  );
};
