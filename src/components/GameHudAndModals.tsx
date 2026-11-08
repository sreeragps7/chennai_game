import React, { useEffect, useState } from 'react';
import {
  CHENNAI_DISTRICTS,
  MISSION_TEMPLATES,
  VEHICLE_SPECS,
} from '../data/chennaiWorld';
import {
  CameraViewMode,
  ChennaiDistrictId,
  DiscoveredPlaceNode,
  GameState,
  GraphicsQuality,
  HudSnapshot,
  MissionTemplate,
  TimeOfDayMode,
  VehicleId,
} from '../types/game';

interface GameHudAndModalsProps {
  gameState: GameState;
  hud: HudSnapshot;
  selectedVehicleId: VehicleId;
  onSelectVehicle: (id: VehicleId) => void;
  selectedDistrictId: ChennaiDistrictId;
  onSelectDistrict: (id: ChennaiDistrictId) => void;
  graphicsQuality: GraphicsQuality;
  onChangeGraphicsQuality: (q: GraphicsQuality) => void;
  cameraMode: CameraViewMode;
  onCycleCameraMode: () => void;
  timeOfDay: TimeOfDayMode;
  onCycleTimeOfDay: () => void;
  isFullMapOpen: boolean;
  onToggleFullMap: () => void;
  onToggleFullscreen: () => void;
  onStartGame: () => void;
  onPauseToggle: () => void;
  onRestartGame: () => void;
  onStartMission: (mission: MissionTemplate) => void;
  onAbortMission: () => void;
  mapTypeId: 'roadmap' | 'hybrid';
  onToggleMapType: () => void;
  showTraffic: boolean;
  onToggleTraffic: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onTriggerEnterExit: () => void;
  onTriggerEmp: () => void;
  onTriggerHorn: () => void;
  onSearchChennaiPlace: (query: string) => void;
  discoveredNodes: DiscoveredPlaceNode[];
  endModalReason: string;
  lastMissionReward: { inr: number; respect: number } | null;
}

export const GameHudAndModals: React.FC<GameHudAndModalsProps> = ({
  gameState,
  hud,
  selectedVehicleId,
  onSelectVehicle,
  selectedDistrictId,
  onSelectDistrict,
  graphicsQuality,
  onChangeGraphicsQuality,
  cameraMode,
  onCycleCameraMode,
  timeOfDay,
  onCycleTimeOfDay,
  isFullMapOpen,
  onToggleFullMap,
  onToggleFullscreen,
  onStartGame,
  onPauseToggle,
  onRestartGame,
  onStartMission,
  onAbortMission,
  mapTypeId,
  onToggleMapType,
  showTraffic,
  onToggleTraffic,
  isMuted,
  onToggleMute,
  onTriggerEnterExit,
  onTriggerEmp,
  onTriggerHorn,
  onSearchChennaiPlace,
  discoveredNodes,
  endModalReason,
  lastMissionReward,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [worldDrawerOpen, setWorldDrawerOpen] = useState(false);
  const [placeSearchInput, setPlaceSearchInput] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (gameState === 'TITLE_MENU' && e.code === 'Enter') {
        e.preventDefault();
        onStartGame();
      } else if (
        (gameState === 'PLAYING' || gameState === 'PAUSED') &&
        e.code === 'Escape'
      ) {
        e.preventDefault();
        onPauseToggle();
      } else if (gameState === 'PLAYING') {
        if (e.code === 'KeyC') {
          e.preventDefault();
          onCycleCameraMode();
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          onToggleFullMap();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, onStartGame, onPauseToggle, onCycleCameraMode, onToggleFullMap]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeSearchInput.trim()) return;
    onSearchChennaiPlace(placeSearchInput.trim());
    setPlaceSearchInput('');
    setWorldDrawerOpen(false);
  };

  // ==========================================================================
  // 1. CINEMATIC START MENU (CHENNAI OPEN WORLD · சென்னை ஓப்பன் வேர்ல்ட்)
  // ==========================================================================
  if (gameState === 'TITLE_MENU') {
    const districts = Object.values(CHENNAI_DISTRICTS);
    const activeDistrict = CHENNAI_DISTRICTS[selectedDistrictId] || CHENNAI_DISTRICTS.marina_beach;
    const vehicles = Object.values(VEHICLE_SPECS);

    return (
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-5 md:p-9 pointer-events-none bg-gradient-to-t from-slate-950/92 via-slate-950/25 to-slate-950/80">
        {/* Top Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200 pointer-events-auto">
          <div className="flex items-center gap-2 font-mono-num tracking-wider">
            <span className="text-amber-400 font-bold">CHENNAI OPEN WORLD 3D</span>
            <span aria-hidden="true">·</span>
            <span>சென்னை ஓப்பன் வேர்ல்ட்</span>
            <span aria-hidden="true">·</span>
            <span>OSM + GOOGLE MAPS HYBRID PIPELINE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded p-0.5 text-[11px]">
              {(['LOW', 'MEDIUM', 'HIGH'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onChangeGraphicsQuality(q)}
                  className={`px-2 py-1 rounded-xs font-mono-num cursor-pointer ${
                    graphicsQuality === q
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onCycleTimeOfDay}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded text-xs font-medium cursor-pointer"
            >
              Sky: {timeOfDay}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded text-xs font-medium cursor-pointer"
            >
              Fullscreen
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded text-xs font-medium cursor-pointer"
            >
              {isMuted ? 'Audio: Off' : 'Audio: On'}
            </button>
          </div>
        </div>

        {/* Left-Aligned Title Lockup & Neighborhood Selector */}
        <div className="my-auto max-w-2xl pointer-events-auto">
          <div className="text-xs font-semibold tracking-widest text-amber-400 mb-1">
            சென்னை ஓப்பன் வேர்ல்ட் · தமிழ்நாடு, இந்தியா
          </div>
          <svg
            viewBox="0 0 740 145"
            className="w-full max-w-xl h-auto mb-2 drop-shadow-lg"
            role="img"
            aria-label="Chennai Open World 3D"
          >
            <defs>
              <linearGradient id="chennaiSun" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="55%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#EA580C" />
              </linearGradient>
            </defs>
            <g transform="translate(6, 10)">
              <polygon
                points="34,0 58,105 10,105"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="3"
              />
              <line x1="20" y1="30" x2="48" y2="30" stroke="#F59E0B" strokeWidth="2.5" />
              <line x1="16" y1="56" x2="52" y2="56" stroke="#F59E0B" strokeWidth="2.5" />
              <line x1="12" y1="82" x2="56" y2="82" stroke="#F59E0B" strokeWidth="2.5" />
              <circle cx="34" cy="105" r="7" fill="#10B981" />
            </g>

            <text
              x="82"
              y="68"
              fill="url(#chennaiSun)"
              fontFamily="'Barlow Condensed', sans-serif"
              fontWeight="700"
              fontStyle="italic"
              fontSize="70"
              letterSpacing="2"
            >
              CHENNAI OPEN WORLD
            </text>
            <text
              x="84"
              y="114"
              fill="#F8FAFC"
              fontFamily="'Barlow Condensed', sans-serif"
              fontWeight="700"
              fontSize="32"
              letterSpacing="4"
            >
              MARINA BEACH &amp; GREATER CHENNAI 3D SANDBOX
            </text>
            <rect x="84" y="128" width="540" height="3" fill="#F59E0B" />
          </svg>

          <p className="text-slate-200 text-xs sm:text-sm max-w-xl leading-relaxed mb-4">
            Explore Marina Beach on foot or behind the wheel—featuring Kamarajar Salai, sandy
            shoreline, Tamil signboards, auto rickshaws, MTC 21G buses, pedestrians, and 8 connected
            Chennai districts with honest architectural placeholders.
          </p>

          {/* 8 Chennai Neighborhoods Selector (Default: Marina Beach) */}
          <div className="mb-3.5 bg-slate-950/92 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-amber-400">
                1. Spawn Neighborhood: {activeDistrict.tamilName} ({activeDistrict.name})
              </span>
              <span className="font-mono-num text-slate-400 text-[11px]">
                {activeDistrict.lat.toFixed(4)}°N, {activeDistrict.lng.toFixed(4)}°E
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {districts.map((d) => {
                const isSelected = d.id === selectedDistrictId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectDistrict(d.id)}
                    className={`px-2.5 py-1.5 rounded text-left transition-colors border cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-slate-100'
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] font-semibold truncate">{d.name}</div>
                    <div className="text-[10px] text-amber-300/90 truncate">{d.tamilName}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Starting Vehicle Selector */}
          <div className="mb-4 bg-slate-950/92 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
              <span className="font-semibold">
                2. Companion Vehicle Parked Nearby (Enter/Exit with [E]):
              </span>
              <span className="font-mono-num text-emerald-400 text-[11px]">
                {VEHICLE_SPECS[selectedVehicleId].tamilTag}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {vehicles.map((v) => {
                const isSelected = v.id === selectedVehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVehicle(v.id)}
                    className={`px-2 py-1.5 rounded text-left border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/20 border-emerald-400 text-slate-100'
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: v.primaryColor }}
                      />
                      <span className="text-[11px] font-semibold truncate">{v.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Launch CTA */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onStartGame}
              className="px-7 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xl tracking-wider rounded transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              ENTER CHENNAI OPEN WORLD (ENTER)
            </button>
            <div className="text-xs text-slate-300 font-mono-num">
              <div>визуал / Graphics: {graphicsQuality} · Third-Person Human + Vehicle Sandbox</div>
              <div className="text-slate-400">
                {discoveredNodes.length > 0
                  ? `${discoveredNodes.length} Live Chennai Places & OSM Road Graph Active`
                  : 'Marina Beach & 8 Chennai Districts Ready'}
              </div>
            </div>
          </div>
        </div>

        {/* Single Flat Control-Hint Line */}
        <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 font-mono-num pointer-events-auto">
          <span>
            WASD Walk/Drive · Mouse Drag Orbit Camera · Shift Sprint/Nitro · Space Jump/Drift · [E] Enter/Exit Vehicle · [C] Camera · [M] Map
          </span>
          <span className="text-amber-400">
            மெரினா கடற்கரை · அண்ணா சாலை · சென்ட்ரல் · தி. நகர் · கத்திப்பாரா · OMR
          </span>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // 2. ACTIVE PLAY PERIMETER HUD & COLLAPSIBLE BOTTOM DOCK
  // ==========================================================================
  const healthPct = Math.max(0, Math.min(100, hud.health));
  const armorPct = Math.max(0, Math.min(100, Math.round((hud.armor / hud.maxArmor) * 100)));
  const isDriving = hud.controlMode === 'DRIVING';

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-5 overflow-hidden">
      {/* TOP PERIMETER BAR */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-Left Speedometer, Player Mode, Health & Stamina/Armor */}
        <div className="flex flex-col gap-1.5 max-w-md pointer-events-auto">
          <div className="bg-slate-950/94 border border-slate-800 rounded px-3.5 py-2.5 flex items-center gap-4 shadow-md">
            {/* Speedometer & Gear */}
            <div className="pr-3.5 border-r border-slate-800 min-w-[92px]">
              <div className="text-2xl font-display font-bold text-amber-400 font-mono-num leading-none">
                {hud.speedKmh}{' '}
                <span className="text-[11px] text-slate-400 font-normal">KM/H</span>
              </div>
              <div className="text-[10px] font-mono-num text-emerald-400 mt-1">
                {isDriving ? `GEAR ${hud.gear} · DRIVING` : `ON FOOT · ${hud.characterAnim}`}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[115px]">
                {isDriving ? hud.vehicle.name : 'நடந்து செல்கிறீர்கள்'}
              </div>
            </div>

            {/* Health, Armor & Stamina/Nitrous Bars */}
            <div className="flex flex-col gap-1.5 min-w-[185px]">
              {/* Health Bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-300 mb-0.5">
                  <span>உடல்நலம் / HEALTH</span>
                  <span>{healthPct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                  <div
                    className="h-full transition-transform duration-100 origin-left"
                    style={{
                      backgroundColor: healthPct > 35 ? '#10B981' : '#EF4444',
                      transform: `scaleX(${healthPct / 100})`,
                    }}
                  />
                </div>
              </div>

              {/* Vehicle Armor OR On-Foot Stamina Bar */}
              {isDriving ? (
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-300 mb-0.5">
                    <span>வாகன கவசம் / ARMOR</span>
                    <span>
                      {hud.armor}/{hud.maxArmor}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                    <div
                      className="h-full transition-transform duration-100 origin-left"
                      style={{
                        backgroundColor: '#38BDF8',
                        transform: `scaleX(${armorPct / 100})`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-300 mb-0.5">
                    <span>சக்தி / SPRINT STAMINA</span>
                    <span>{hud.stamina}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-xs overflow-hidden">
                    <div
                      className="h-full transition-transform duration-100 origin-left"
                      style={{
                        backgroundColor: '#F59E0B',
                        transform: `scaleX(${hud.stamina / 100})`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400">
                <span>NITRO: {hud.nitrous}%</span>
                <span>QUALITY: {graphicsQuality}</span>
              </div>
            </div>
          </div>

          {/* Interactive [E] Vehicle Enter / Exit Prompt */}
          {!isDriving && hud.nearbyHijackableVehicle && (
            <button
              type="button"
              onClick={onTriggerEnterExit}
              className="bg-emerald-950/95 border border-emerald-400 rounded px-3 py-1.5 text-left text-xs font-mono-num text-emerald-200 shadow-lg cursor-pointer hover:bg-emerald-900/90"
            >
              <span className="font-bold text-emerald-400">[E] ENTER VEHICLE:</span>{' '}
              {hud.nearbyHijackableVehicle.name} ({hud.nearbyHijackableVehicle.tamilTag})
            </button>
          )}

          {isDriving && (
            <button
              type="button"
              onClick={onTriggerEnterExit}
              className="bg-slate-950/92 border border-amber-500/60 rounded px-3 py-1 text-left text-[11px] font-mono-num text-amber-300 cursor-pointer hover:bg-slate-900"
            >
              Press [E] to Exit Vehicle (வாகனத்திலிருந்து இறங்க [E])
            </button>
          )}
        </div>

        {/* Center Top Bilingual Location Banner & Active Mission */}
        <div className="hidden lg:flex flex-col items-center gap-1.5 pointer-events-auto">
          <div className="bg-slate-950/92 border border-slate-800 rounded px-4 py-1.5 shadow-md text-center">
            <div className="text-xs font-semibold text-amber-400">
              {hud.currentDistrict.tamilName} · {hud.currentDistrict.name}
            </div>
            <div className="text-[10px] font-mono-num text-slate-400">
              {hud.currentDistrict.subtitle} · OSM Roads: {hud.osmRoadCount}
            </div>
          </div>

          {hud.activeColliderLabel && (
            <div className="bg-slate-950/92 border border-sky-500/60 rounded px-3 py-1 text-[11px] font-mono-num text-sky-300">
              Landmark: {hud.activeColliderLabel}
            </div>
          )}

          {hud.activeMission && (
            <div className="bg-slate-950/92 border border-amber-500/60 rounded px-4 py-1.5 shadow-md flex items-center gap-3 text-xs font-mono-num">
              <span className="text-amber-400 font-semibold">
                {hud.activeMission.mission.chapterNumber}. {hud.activeMission.mission.title}
              </span>
              <span className="text-slate-300">
                {hud.activeMission.stage === 'GO_TO_ORIGIN'
                  ? `Start: ${hud.activeMission.originName}`
                  : `Target: ${hud.activeMission.destinationName}`}
              </span>
              <span className="text-emerald-400 font-bold">
                {hud.activeMission.distanceRemainingMeters} m
              </span>
              <span className="text-slate-200 font-bold">
                {hud.activeMission.timeRemainingSec}s
              </span>
              <button
                type="button"
                onClick={onAbortMission}
                className="text-rose-400 hover:underline cursor-pointer"
              >
                Abort
              </button>
            </div>
          )}

          {hud.statusBanner && (
            <div className="bg-slate-950/95 border border-amber-500/70 px-4 py-1.5 rounded text-center shadow-lg">
              <div className="font-display font-bold tracking-wider text-sm text-amber-400">
                {hud.statusBanner}
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Wanted Stars, Rupees, & Pause/Settings */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="bg-slate-950/94 border border-slate-800 rounded px-3.5 py-2 flex items-center gap-3.5 shadow-md">
            <div className="flex items-center gap-1" title="Chennai Police Heat">
              {[1, 2, 3, 4, 5].map((starIdx) => {
                const active = starIdx <= hud.wantedStars;
                return (
                  <svg
                    key={starIdx}
                    viewBox="0 0 24 24"
                    className={`w-4 h-4 ${
                      active ? 'text-amber-400 fill-amber-400' : 'text-slate-700 fill-slate-800'
                    }`}
                  >
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                  </svg>
                );
              })}
            </div>

            <span className="text-slate-700" aria-hidden="true">|</span>

            <div className="text-right font-mono-num">
              <div className="text-sm font-bold text-emerald-400">
                ₹{hud.cashInr.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400">
                {hud.playerCoords.lat.toFixed(4)}°N, {hud.playerCoords.lng.toFixed(4)}°E
              </div>
            </div>

            <button
              type="button"
              onClick={onPauseToggle}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 font-medium cursor-pointer whitespace-nowrap shrink-0"
            >
              Pause / Settings (Esc)
            </button>
          </div>
        </div>
      </div>

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL DOCK (Pinned Bottom Center) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(960px,95vw)] flex flex-col items-center pointer-events-auto z-20">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="px-3.5 py-1 bg-slate-950/94 border border-b-0 border-slate-800 rounded-t text-[11px] font-mono-num text-slate-300 hover:text-white cursor-pointer"
        >
          {dockCollapsed ? '▴ Show Controls (கட்டுப்பாடுகள்)' : '▾ Hide Controls'}
        </button>

        {!dockCollapsed && (
          <div className="w-full bg-slate-950/95 border border-slate-800 rounded-lg px-3.5 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-2">
            {/* Left Group: Enter/Exit Vehicle, Districts/Missions, Horn */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onTriggerEnterExit}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                {isDriving ? 'Exit Car [E]' : 'Enter Car [E]'}
              </button>

              <button
                type="button"
                onClick={() => setWorldDrawerOpen((prev) => !prev)}
                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                Chennai Map &amp; Districts (8)
              </button>

              {isDriving && (
                <button
                  type="button"
                  onClick={onTriggerHorn}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded text-xs font-mono-num cursor-pointer whitespace-nowrap shrink-0"
                >
                  Horn [H]
                </button>
              )}

              <button
                type="button"
                onClick={onTriggerEmp}
                disabled={hud.empCharge < 100}
                className={`px-2.5 py-1.5 text-xs font-mono-num rounded border whitespace-nowrap shrink-0 cursor-pointer ${
                  hud.empCharge >= 100
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300 hover:bg-sky-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Pulse [Q]
              </button>
            </div>

            {/* Center Group: Live Chennai GPS Search */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
              <input
                type="text"
                value={placeSearchInput}
                onChange={(e) => setPlaceSearchInput(e.target.value)}
                placeholder="Search Chennai Landmark..."
                className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-36 sm:w-44"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                GPS Route
              </button>
            </form>

            {/* Right Group: Camera, Sky, Quality, Map, Fullscreen */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onCycleCameraMode}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 rounded text-xs font-mono-num cursor-pointer whitespace-nowrap shrink-0"
              >
                Cam [C]: {cameraMode}
              </button>
              <button
                type="button"
                onClick={onCycleTimeOfDay}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                Sky: {timeOfDay}
              </button>
              <button
                type="button"
                onClick={() =>
                  onChangeGraphicsQuality(
                    graphicsQuality === 'LOW'
                      ? 'MEDIUM'
                      : graphicsQuality === 'MEDIUM'
                      ? 'HIGH'
                      : 'LOW'
                  )
                }
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-slate-700 rounded text-xs font-mono-num cursor-pointer whitespace-nowrap shrink-0"
              >
                GFX: {graphicsQuality}
              </button>
              <button
                type="button"
                onClick={onToggleFullMap}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-sky-300 border border-slate-700 rounded text-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                {isFullMapOpen ? 'Close Map [M]' : 'Map [M]'}
              </button>
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="px-2 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs cursor-pointer whitespace-nowrap shrink-0"
              >
                Full
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CHENNAI NEIGHBORHOODS FAST-TRAVEL, GARAGE & MISSIONS MODAL */}
      {worldDrawerOpen && gameState === 'PLAYING' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/88 pointer-events-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-display font-bold tracking-wide text-slate-100">
                  CHENNAI OPEN WORLD · DISTRICTS, GARAGE &amp; CONTRACTS
                </h2>
                <p className="text-xs text-slate-400">
                  Fast-travel to any of the 8 Chennai neighborhoods, spawn a vehicle, or start a GPS
                  route mission
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWorldDrawerOpen(false)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* 1. Fast-Travel across 8 Chennai Neighborhoods */}
            <div className="mb-5">
              <div className="text-xs font-semibold text-amber-400 mb-2">
                Fast-Travel Chennai Neighborhoods (உடனடி இடமாற்றம்):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.values(CHENNAI_DISTRICTS).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onSelectDistrict(d.id);
                      setWorldDrawerOpen(false);
                    }}
                    className={`p-2.5 rounded border text-left cursor-pointer ${
                      hud.currentDistrict.id === d.id
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{d.name}</div>
                    <div className="text-[11px] text-amber-300 truncate">{d.tamilName}</div>
                    <div className="text-[10px] font-mono-num text-slate-400 mt-0.5">
                      {d.lat.toFixed(3)}°N, {d.lng.toFixed(3)}°E
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Switch Active Vehicle */}
            <div className="mb-5">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Select Vehicle Model (வாகனம் தேர்வு):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {Object.values(VEHICLE_SPECS).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVehicle(v.id)}
                    className={`px-2.5 py-2 rounded text-left border text-xs cursor-pointer ${
                      hud.vehicle.id === v.id
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-semibold truncate">{v.name}</div>
                    <div className="text-[10px] text-amber-300 truncate">{v.tamilTag}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Chennai Contracts */}
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Chennai Open-World Contracts:
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {MISSION_TEMPLATES.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <span className="text-amber-400 font-mono-num">{m.chapterNumber}.</span>
                        <span>{m.title}</span>
                        {m.tamilTitle && (
                          <span className="text-xs text-amber-300">({m.tamilTitle})</span>
                        )}
                        <span className="text-xs font-mono-num text-emerald-400">
                          ₹{m.rewardInr.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{m.briefing}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onStartMission(m);
                        setWorldDrawerOpen(false);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Start Route
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE / SETTINGS / ROUND SUMMARY / GAME OVER MODAL */}
      {(gameState === 'PAUSED' ||
        gameState === 'ROUND_SUMMARY' ||
        gameState === 'GAME_OVER') && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/90 pointer-events-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-lg w-full p-6 text-center shadow-2xl">
            <h2
              className={`text-3xl font-display font-bold tracking-wider mb-1 ${
                gameState === 'ROUND_SUMMARY'
                  ? 'text-emerald-400'
                  : gameState === 'GAME_OVER'
                  ? 'text-rose-500'
                  : 'text-amber-400'
              }`}
            >
              {gameState === 'ROUND_SUMMARY'
                ? 'MISSION COMPLETED · வெற்றி!'
                : gameState === 'GAME_OVER'
                ? 'WASTED IN CHENNAI'
                : 'PAUSED & SETTINGS · அமைப்புகள்'}
            </h2>

            <p className="text-xs text-slate-300 mb-4">{endModalReason}</p>

            {/* Settings Panel inside Pause Modal */}
            {gameState === 'PAUSED' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 mb-5 text-left space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">
                    Graphics Quality (வரைகலை தரம்):
                  </span>
                  <div className="flex gap-1">
                    {(['LOW', 'MEDIUM', 'HIGH'] as GraphicsQuality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onChangeGraphicsQuality(q)}
                        className={`px-2.5 py-1 rounded font-mono-num cursor-pointer ${
                          graphicsQuality === q
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Time of Day / Sunlight:</span>
                  <button
                    type="button"
                    onClick={onCycleTimeOfDay}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded font-mono-num cursor-pointer"
                  >
                    {timeOfDay}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Google Maps Radar Layer:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleMapType}
                      className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded cursor-pointer"
                    >
                      {mapTypeId === 'roadmap' ? 'Roadmap' : 'Satellite'}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleTraffic}
                      className="px-2.5 py-1 bg-slate-800 text-emerald-300 rounded cursor-pointer"
                    >
                      Traffic: {showTraffic ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Audio &amp; Fullscreen:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleMute}
                      className="px-2.5 py-1 bg-slate-800 text-slate-200 rounded cursor-pointer"
                    >
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleFullscreen}
                      className="px-2.5 py-1 bg-slate-800 text-sky-300 rounded cursor-pointer"
                    >
                      Toggle Fullscreen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {gameState === 'ROUND_SUMMARY' && lastMissionReward && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-5 font-mono-num text-sm">
                <div className="text-emerald-400 font-bold text-lg">
                  +₹{lastMissionReward.inr.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Respect Earned: +{lastMissionReward.respect} · Completed:{' '}
                  {hud.missionsCompleted}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 bg-slate-900/70 border border-slate-800 rounded-lg p-3 mb-5 text-xs font-mono-num">
              <div>
                <div className="text-slate-400">DISTRICT</div>
                <div className="text-slate-100 font-semibold mt-0.5 truncate">
                  {hud.currentDistrict.name}
                </div>
              </div>
              <div>
                <div className="text-slate-400">CASH</div>
                <div className="text-emerald-400 font-semibold mt-0.5">
                  ₹{hud.cashInr.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div className="text-slate-400">MODE</div>
                <div className="text-amber-300 font-semibold mt-0.5">{hud.controlMode}</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {(gameState === 'PAUSED' || gameState === 'ROUND_SUMMARY') && (
                <button
                  type="button"
                  onClick={onPauseToggle}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded cursor-pointer whitespace-nowrap shrink-0"
                >
                  Resume Chennai 3D
                </button>
              )}
              <button
                type="button"
                onClick={onRestartGame}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold text-xs rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                Respawn at {CHENNAI_DISTRICTS[selectedDistrictId].name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
