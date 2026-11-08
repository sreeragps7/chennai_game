export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';

export type PlayerControlMode = 'ON_FOOT' | 'DRIVING';

export type CharacterAnimState = 'IDLE' | 'WALK' | 'RUN' | 'JUMP';

export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH';

export type VehicleId = 'auto_rickshaw' | 'mtc_bus' | 'contessa_sedan' | 'ecr_bike' | 'police_suv';

export type CameraViewMode = 'CHASE' | 'HOOD' | 'HELI';

export type TimeOfDayMode = 'SUNSET' | 'NIGHT' | 'NOON';

export type ChennaiDistrictId =
  | 'marina_beach'
  | 'anna_salai'
  | 'chennai_central'
  | 'kathipara_flyover'
  | 't_nagar'
  | 'omr_corridor'
  | 'guindy'
  | 'adyar';

export interface ChennaiDistrictSpec {
  id: ChennaiDistrictId;
  name: string;
  tamilName: string;
  subtitle: string;
  lat: number;
  lng: number;
  worldX: number; // meters East from Marina Beach origin (0,0)
  worldZ: number; // meters South from Marina Beach origin (0,0)
  defaultHeadingDeg: number;
  landmarks: string[];
}

export interface WorldBuildingCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  label: string;
  tamilLabel: string;
  isPlaceholder: boolean;
}

export interface VehicleSpec {
  id: VehicleId;
  name: string;
  tamilTag: string;
  role: string;
  maxSpeed: number; // meters per second in sim
  acceleration: number;
  handling: number;
  driftGrip: number;
  maxArmor: number;
  mass: number;
  width: number;
  length: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface MissionTemplate {
  id: string;
  chapterNumber: string;
  title: string;
  tamilTitle?: string;
  briefing: string;
  originQuery: string;
  destinationQuery: string;
  rewardInr: number;
  respectGain: number;
  timeLimitSec: number;
  initialWantedStars: number;
  recommendedVehicle: VehicleId;
}

export interface DiscoveredPlaceNode {
  id: string;
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  category: 'MISSION_ORIGIN' | 'MISSION_TARGET' | 'PAY_N_SPRAY' | 'KAAPI_STALL' | 'LANDMARK';
  missionId?: string;
}

export interface ActiveMissionState {
  mission: MissionTemplate;
  stage: 'GO_TO_ORIGIN' | 'RACE_TO_DESTINATION';
  originLocation: { lat: number; lng: number };
  originName: string;
  destinationLocation: { lat: number; lng: number };
  destinationName: string;
  routePath: { lat: number; lng: number }[];
  nextWaypointIndex: number;
  distanceRemainingMeters: number;
  timeRemainingSec: number;
  checkpointsCleared: number;
  totalCheckpoints: number;
}

export interface HudSnapshot {
  controlMode: PlayerControlMode;
  characterAnim: CharacterAnimState;
  health: number;
  stamina: number;
  speedKmh: number;
  gear: string;
  armor: number;
  maxArmor: number;
  nitrous: number;
  empCharge: number;
  cashInr: number;
  respect: number;
  wantedStars: number;
  wantedCooldownProgress: number;
  vehicle: VehicleSpec;
  nearbyHijackableVehicle: VehicleSpec | null;
  nearbyServiceNode: DiscoveredPlaceNode | null;
  playerCoords: { lat: number; lng: number };
  headingDeg: number;
  currentDistrict: ChennaiDistrictSpec;
  activeColliderLabel: string | null;
  osmRoadCount: number;
  activeMission: ActiveMissionState | null;
  missionsCompleted: number;
  policeDefeated: number;
  comboMultiplier: number;
  statusBanner: string | null;
}
