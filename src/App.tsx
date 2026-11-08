/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  CHENNAI_DISTRICTS,
  INITIAL_VIEWPORT_CENTER,
  MISSION_TEMPLATES,
  VEHICLE_SPECS,
  metersToLatLngDelta,
} from './data/chennaiWorld';
import {
  ActiveMissionState,
  CameraViewMode,
  ChennaiDistrictId,
  DiscoveredPlaceNode,
  GameState,
  GraphicsQuality,
  HudSnapshot,
  MissionTemplate,
  TimeOfDayMode,
  VehicleId,
} from './types/game';
import { ChennaiMapLayer } from './components/ChennaiMapLayer';
import { GameCanvas } from './components/GameCanvas';
import { GameHudAndModals } from './components/GameHudAndModals';
import { soundEngine } from './audio/soundEngine';

const MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof process !== 'undefined' &&
    (process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_API_KEY)) ||
  '';

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [selectedVehicleId, setSelectedVehicleId] = useState<VehicleId>('contessa_sedan');
  const [selectedDistrictId, setSelectedDistrictId] = useState<ChennaiDistrictId>('marina_beach');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('HIGH');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('CHASE');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayMode>('SUNSET');
  const [isFullMapOpen, setIsFullMapOpen] = useState<boolean>(false);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('roadmap');
  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [discoveredNodes, setDiscoveredNodes] = useState<DiscoveredPlaceNode[]>([]);
  const [activeMission, setActiveMission] = useState<ActiveMissionState | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState<string | null>(null);

  const [triggerEnterExitSignal, setTriggerEnterExitSignal] = useState(0);
  const [triggerEmpSignal, setTriggerEmpSignal] = useState(0);
  const [triggerHornSignal, setTriggerHornSignal] = useState(0);
  const [teleportSignal, setTeleportSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);

  const [endModalReason, setEndModalReason] = useState('');
  const [lastMissionReward, setLastMissionReward] = useState<{
    inr: number;
    respect: number;
  } | null>(null);

  const mapCenterRef = useRef<{ lat: number; lng: number }>({
    lat: INITIAL_VIEWPORT_CENTER.lat,
    lng: INITIAL_VIEWPORT_CENTER.lng,
  });
  const playerHeadingRef = useRef<number>(0);

  const [hud, setHud] = useState<HudSnapshot>({
    controlMode: 'ON_FOOT',
    characterAnim: 'IDLE',
    health: 100,
    stamina: 100,
    speedKmh: 0,
    gear: 'FOOT',
    armor: VEHICLE_SPECS.contessa_sedan.maxArmor,
    maxArmor: VEHICLE_SPECS.contessa_sedan.maxArmor,
    nitrous: 100,
    empCharge: 100,
    cashInr: 25000,
    respect: 100,
    wantedStars: 0,
    wantedCooldownProgress: 0,
    vehicle: VEHICLE_SPECS.contessa_sedan,
    nearbyHijackableVehicle: VEHICLE_SPECS.contessa_sedan,
    nearbyServiceNode: null,
    playerCoords: INITIAL_VIEWPORT_CENTER,
    headingDeg: 0,
    currentDistrict: CHENNAI_DISTRICTS.marina_beach,
    activeColliderLabel: null,
    osmRoadCount: 128,
    activeMission: null,
    missionsCompleted: 0,
    policeDefeated: 0,
    comboMultiplier: 1,
    statusBanner: null,
  });

  // Listen for Google Maps Platform quota exceeded events (Mandatory Tier 1 & 2 handler)
  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const handleNodesDiscovered = useCallback((nodes: DiscoveredPlaceNode[]) => {
    setDiscoveredNodes(nodes);
  }, []);

  const handleLaunchMission = useCallback(
    (mission: MissionTemplate, nodesList: DiscoveredPlaceNode[]) => {
      const originNode = nodesList.find((n) => n.id === `${mission.id}_origin`);
      const destNode = nodesList.find((n) => n.id === `${mission.id}_dest`);

      const fallbackOriginDelta = metersToLatLngDelta(60, -90);
      const fallbackDestDelta = metersToLatLngDelta(-120, -280);

      const originLoc = originNode
        ? originNode.location
        : {
            lat: mapCenterRef.current.lat + fallbackOriginDelta.dLat,
            lng: mapCenterRef.current.lng + fallbackOriginDelta.dLng,
          };

      const destLoc = destNode
        ? destNode.location
        : {
            lat: mapCenterRef.current.lat + fallbackDestDelta.dLat,
            lng: mapCenterRef.current.lng + fallbackDestDelta.dLng,
          };

      setActiveMission({
        mission,
        stage: 'GO_TO_ORIGIN',
        originLocation: originLoc,
        originName: originNode?.displayName || mission.originQuery,
        destinationLocation: destLoc,
        destinationName: destNode?.displayName || mission.destinationQuery,
        routePath: [mapCenterRef.current, originLoc],
        nextWaypointIndex: 0,
        distanceRemainingMeters: 360,
        timeRemainingSec: mission.timeLimitSec,
        checkpointsCleared: 0,
        totalCheckpoints: 2,
      });
    },
    []
  );

  const handleStartGame = useCallback(() => {
    soundEngine.init();
    setResetSignal((s) => s + 1);
    setGameState('PLAYING');
    handleLaunchMission(MISSION_TEMPLATES[0], discoveredNodes);
  }, [discoveredNodes, handleLaunchMission]);

  const handleRestartGame = useCallback(() => {
    soundEngine.init();
    setResetSignal((s) => s + 1);
    setLastMissionReward(null);
    setGameState('PLAYING');
    handleLaunchMission(MISSION_TEMPLATES[0], discoveredNodes);
  }, [discoveredNodes, handleLaunchMission]);

  const handleSelectDistrict = useCallback(
    (id: ChennaiDistrictId) => {
      setSelectedDistrictId(id);
      if (gameState === 'PLAYING') {
        setTeleportSignal((s) => s + 1);
      }
    },
    [gameState]
  );

  const handlePauseToggle = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED' || prev === 'ROUND_SUMMARY') return 'PLAYING';
      return prev;
    });
  }, []);

  const handleCycleCameraMode = useCallback(() => {
    setCameraMode((prev) => (prev === 'CHASE' ? 'HOOD' : prev === 'HOOD' ? 'HELI' : 'CHASE'));
  }, []);

  const handleCycleTimeOfDay = useCallback(() => {
    setTimeOfDay((prev) => (prev === 'SUNSET' ? 'NIGHT' : prev === 'NIGHT' ? 'NOON' : 'SUNSET'));
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleMissionRouteComputed = useCallback(
    (routePoints: { lat: number; lng: number }[], distanceMeters: number) => {
      setActiveMission((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          routePath: routePoints,
          distanceRemainingMeters: Math.round(distanceMeters),
          totalCheckpoints: Math.max(1, routePoints.length),
        };
      });
    },
    []
  );

  const handleMissionAdvanceStage = useCallback(() => {
    setActiveMission((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        stage: 'RACE_TO_DESTINATION',
        routePath: [prev.originLocation, prev.destinationLocation],
        nextWaypointIndex: 0,
      };
    });
  }, []);

  const handleMissionComplete = useCallback((rewardInr: number, respectGain: number) => {
    setLastMissionReward({ inr: rewardInr, respect: respectGain });
    setEndModalReason(
      'Route completed across 3D Chennai streets. Syndicate payout transferred.'
    );
    setActiveMission(null);
    setGameState('ROUND_SUMMARY');
  }, []);

  const handleMissionFail = useCallback((reason: string) => {
    setEndModalReason(reason);
    setActiveMission(null);
    setGameState('GAME_OVER');
  }, []);

  const handlePlayerWasted = useCallback((reason: string) => {
    setEndModalReason(reason);
    setActiveMission(null);
    setGameState('GAME_OVER');
  }, []);

  const handleCustomDestinationFound = useCallback((place: DiscoveredPlaceNode) => {
    setDiscoveredNodes((prev) => [...prev.filter((p) => !p.id.startsWith('custom_')), place]);
    const customMission: MissionTemplate = {
      id: place.id,
      chapterNumber: 'GPS',
      title: `Express Route: ${place.displayName}`,
      briefing: `3D open-world route to ${place.displayName} via live Chennai Google Maps navigation.`,
      originQuery: place.displayName,
      destinationQuery: place.displayName,
      rewardInr: 30000,
      respectGain: 200,
      timeLimitSec: 120,
      initialWantedStars: 1,
      recommendedVehicle: 'contessa_sedan',
    };

    setActiveMission({
      mission: customMission,
      stage: 'RACE_TO_DESTINATION',
      originLocation: mapCenterRef.current,
      originName: 'Current Location',
      destinationLocation: place.location,
      destinationName: place.displayName,
      routePath: [mapCenterRef.current, place.location],
      nextWaypointIndex: 0,
      distanceRemainingMeters: 600,
      timeRemainingSec: 120,
      checkpointsCleared: 0,
      totalCheckpoints: 2,
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none flex flex-col">
      {/* Mandatory Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Full-Viewport 3D Game Shell */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Isolated 60fps Three.js 3D WebGL Viewport */}
        <GameCanvas
          gameState={gameState}
          selectedVehicleId={selectedVehicleId}
          selectedDistrictId={selectedDistrictId}
          graphicsQuality={graphicsQuality}
          cameraMode={cameraMode}
          timeOfDay={timeOfDay}
          mapCenterRef={mapCenterRef}
          playerHeadingRef={playerHeadingRef}
          discoveredNodes={discoveredNodes}
          activeMission={activeMission}
          onHudUpdate={setHud}
          onMissionAdvanceStage={handleMissionAdvanceStage}
          onMissionComplete={handleMissionComplete}
          onMissionFail={handleMissionFail}
          onPlayerWasted={handlePlayerWasted}
          triggerEnterExitSignal={triggerEnterExitSignal}
          triggerEmpSignal={triggerEmpSignal}
          triggerHornSignal={triggerHornSignal}
          teleportSignal={teleportSignal}
          resetSignal={resetSignal}
        />

        {/* Live Google Maps GTA Radar Minimap & Expandable Tactical GPS Map */}
        <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
          <ChennaiMapLayer
            gameState={gameState}
            isFullMapOpen={isFullMapOpen}
            onToggleFullMap={() => setIsFullMapOpen((prev) => !prev)}
            mapCenterRef={mapCenterRef}
            playerHeadingRef={playerHeadingRef}
            mapTypeId={mapTypeId}
            showTraffic={showTraffic}
            discoveredNodes={discoveredNodes}
            onNodesDiscovered={handleNodesDiscovered}
            activeMission={activeMission}
            onMissionRouteComputed={handleMissionRouteComputed}
            customSearchQuery={customSearchQuery}
            onCustomDestinationFound={handleCustomDestinationFound}
          />
        </APIProvider>

        {/* World-Matched Perimeter HUD & Collapsible Bottom Dock */}
        <GameHudAndModals
          gameState={gameState}
          hud={hud}
          selectedVehicleId={selectedVehicleId}
          onSelectVehicle={setSelectedVehicleId}
          selectedDistrictId={selectedDistrictId}
          onSelectDistrict={handleSelectDistrict}
          graphicsQuality={graphicsQuality}
          onChangeGraphicsQuality={setGraphicsQuality}
          cameraMode={cameraMode}
          onCycleCameraMode={handleCycleCameraMode}
          timeOfDay={timeOfDay}
          onCycleTimeOfDay={handleCycleTimeOfDay}
          isFullMapOpen={isFullMapOpen}
          onToggleFullMap={() => setIsFullMapOpen((prev) => !prev)}
          onToggleFullscreen={handleToggleFullscreen}
          onStartGame={handleStartGame}
          onPauseToggle={handlePauseToggle}
          onRestartGame={handleRestartGame}
          onStartMission={(m) => handleLaunchMission(m, discoveredNodes)}
          onAbortMission={() => setActiveMission(null)}
          mapTypeId={mapTypeId}
          onToggleMapType={() =>
            setMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))
          }
          showTraffic={showTraffic}
          onToggleTraffic={() => setShowTraffic((prev) => !prev)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onTriggerEnterExit={() => setTriggerEnterExitSignal((s) => s + 1)}
          onTriggerEmp={() => setTriggerEmpSignal((s) => s + 1)}
          onTriggerHorn={() => setTriggerHornSignal((s) => s + 1)}
          onSearchChennaiPlace={(q) => setCustomSearchQuery(q)}
          discoveredNodes={discoveredNodes}
          endModalReason={endModalReason}
          lastMissionReward={lastMissionReward}
        />
      </div>
    </div>
  );
}
