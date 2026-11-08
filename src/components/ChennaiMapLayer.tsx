import React, { useEffect, useRef, useState } from 'react';
import {
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  CHENNAI_SERVICE_QUERIES,
  INITIAL_VIEWPORT_CENTER,
  MISSION_TEMPLATES,
  metersToLatLngDelta,
} from '../data/chennaiWorld';
import { ActiveMissionState, DiscoveredPlaceNode, GameState } from '../types/game';

interface GmpLatLng {
  lat: () => number;
  lng: () => number;
}

interface GmpPolyline {
  setMap: (map: unknown) => void;
  setOptions: (opts: Record<string, unknown>) => void;
}

interface GmpTrafficLayer {
  setMap: (map: unknown) => void;
}

interface ChennaiMapLayerProps {
  gameState: GameState;
  isFullMapOpen: boolean;
  onToggleFullMap: () => void;
  mapCenterRef: React.MutableRefObject<{ lat: number; lng: number }>;
  playerHeadingRef: React.MutableRefObject<number>;
  mapTypeId: 'roadmap' | 'hybrid';
  showTraffic: boolean;
  discoveredNodes: DiscoveredPlaceNode[];
  onNodesDiscovered: (nodes: DiscoveredPlaceNode[]) => void;
  activeMission: ActiveMissionState | null;
  onMissionRouteComputed: (routePoints: { lat: number; lng: number }[], distanceMeters: number) => void;
  customSearchQuery: string | null;
  onCustomDestinationFound: (place: DiscoveredPlaceNode) => void;
}

function checkAndDispatchQuotaError(err: unknown) {
  const msg = String(err instanceof Error ? err.message : err);
  if (
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

function MapSynchronizer({
  gameState,
  isFullMapOpen,
  mapCenterRef,
  playerHeadingRef,
  showTraffic,
  discoveredNodes,
  onNodesDiscovered,
  activeMission,
  onMissionRouteComputed,
  customSearchQuery,
  onCustomDestinationFound,
}: Omit<ChennaiMapLayerProps, 'mapTypeId' | 'onToggleFullMap'>) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<GmpPolyline[]>([]);
  const trafficLayerRef = useRef<GmpTrafficLayer | null>(null);
  const hasSeededPlacesRef = useRef(false);
  const [playerPosState, setPlayerPosState] = useState<{
    lat: number;
    lng: number;
    heading: number;
  }>({
    lat: INITIAL_VIEWPORT_CENTER.lat,
    lng: INITIAL_VIEWPORT_CENTER.lng,
    heading: 0,
  });

  // Synchronize Google Map camera with 3D player vehicle position in real time
  useEffect(() => {
    if (!map) return;

    let animId = 0;
    let lastMarkerSync = 0;

    const syncCamera = (now: number) => {
      if (gameState === 'PLAYING' || gameState === 'TITLE_MENU') {
        map.moveCamera({
          center: mapCenterRef.current,
          zoom: isFullMapOpen ? 15 : 16.5,
        });
      }

      if (now - lastMarkerSync > 90) {
        lastMarkerSync = now;
        setPlayerPosState({
          lat: mapCenterRef.current.lat,
          lng: mapCenterRef.current.lng,
          heading: playerHeadingRef.current,
        });
      }

      animId = requestAnimationFrame(syncCamera);
    };

    animId = requestAnimationFrame(syncCamera);
    return () => cancelAnimationFrame(animId);
  }, [map, gameState, isFullMapOpen, mapCenterRef, playerHeadingRef]);

  // Toggle Real-Time Google Maps TrafficLayer
  useEffect(() => {
    const winGoogle = (window as unknown as {
      google?: { maps?: { TrafficLayer?: new () => GmpTrafficLayer } };
    }).google;
    if (!map || !winGoogle?.maps?.TrafficLayer) return;

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new winGoogle.maps.TrafficLayer();
    }

    trafficLayerRef.current.setMap(showTraffic ? map : null);

    return () => {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
    };
  }, [map, showTraffic]);

  // Discover real Chennai Mission Hubs & Service Garages via Places API (New) Place.searchByText
  useEffect(() => {
    if (!placesLib || hasSeededPlacesRef.current) return;
    hasSeededPlacesRef.current = true;

    const discoverChennaiWorld = async () => {
      const foundNodes: DiscoveredPlaceNode[] = [];
      const PlaceClass = (placesLib as unknown as {
        Place: {
          searchByText: (req: Record<string, unknown>) => Promise<{
            places?: Array<{
              id?: string;
              displayName?: string;
              formattedAddress?: string;
              location?: GmpLatLng;
            }>;
          }>;
        };
      }).Place;

      if (!PlaceClass || typeof PlaceClass.searchByText !== 'function') {
        return;
      }

      for (let i = 0; i < MISSION_TEMPLATES.length; i++) {
        const m = MISSION_TEMPLATES[i];
        try {
          const originRes = await PlaceClass.searchByText({
            textQuery: m.originQuery,
            fields: ['id', 'displayName', 'location', 'formattedAddress'],
            maxResultCount: 1,
          });
          const originPlace = originRes?.places?.[0];
          if (originPlace?.location) {
            foundNodes.push({
              id: `${m.id}_origin`,
              placeId: originPlace.id || `${m.id}_origin`,
              displayName: originPlace.displayName || m.title,
              formattedAddress: originPlace.formattedAddress || '',
              location: {
                lat: originPlace.location.lat(),
                lng: originPlace.location.lng(),
              },
              category: 'MISSION_ORIGIN',
              missionId: m.id,
            });
          }

          const destRes = await PlaceClass.searchByText({
            textQuery: m.destinationQuery,
            fields: ['id', 'displayName', 'location', 'formattedAddress'],
            maxResultCount: 1,
          });
          const destPlace = destRes?.places?.[0];
          if (destPlace?.location) {
            foundNodes.push({
              id: `${m.id}_dest`,
              placeId: destPlace.id || `${m.id}_dest`,
              displayName: destPlace.displayName || `${m.title} Target`,
              formattedAddress: destPlace.formattedAddress || '',
              location: {
                lat: destPlace.location.lat(),
                lng: destPlace.location.lng(),
              },
              category: 'MISSION_TARGET',
              missionId: m.id,
            });
          }
        } catch (err) {
          checkAndDispatchQuotaError(err);
        }
      }

      for (let i = 0; i < CHENNAI_SERVICE_QUERIES.length; i++) {
        const sq = CHENNAI_SERVICE_QUERIES[i];
        try {
          const res = await PlaceClass.searchByText({
            textQuery: sq.query,
            fields: ['id', 'displayName', 'location', 'formattedAddress'],
            maxResultCount: 2,
          });
          const places = res?.places || [];
          places.forEach((p, idx) => {
            if (p.location) {
              foundNodes.push({
                id: `service_${i}_${idx}`,
                placeId: p.id || `service_${i}_${idx}`,
                displayName:
                  p.displayName || (sq.category === 'PAY_N_SPRAY' ? 'Auto Workshop' : 'Kaapi Stall'),
                formattedAddress: p.formattedAddress || '',
                location: {
                  lat: p.location.lat(),
                  lng: p.location.lng(),
                },
                category: sq.category,
              });
            }
          });
        } catch (err) {
          checkAndDispatchQuotaError(err);
        }
      }

      if (foundNodes.length > 0) {
        onNodesDiscovered(foundNodes);
      }
    };

    discoverChennaiWorld();
  }, [placesLib, onNodesDiscovered]);

  // Handle Custom Free-Roam Place Search in Chennai via Place.searchByText
  useEffect(() => {
    if (!placesLib || !customSearchQuery) return;

    const runCustomSearch = async () => {
      try {
        const PlaceClass = (placesLib as unknown as {
          Place: {
            searchByText: (req: Record<string, unknown>) => Promise<{
              places?: Array<{
                id?: string;
                displayName?: string;
                formattedAddress?: string;
                location?: GmpLatLng;
              }>;
            }>;
          };
        }).Place;

        const res = await PlaceClass.searchByText({
          textQuery: `${customSearchQuery} Chennai`,
          fields: ['id', 'displayName', 'location', 'formattedAddress'],
          maxResultCount: 1,
        });
        const place = res?.places?.[0];
        if (place?.location) {
          onCustomDestinationFound({
            id: `custom_${Date.now()}`,
            placeId: place.id || `custom_${Date.now()}`,
            displayName: place.displayName || customSearchQuery,
            formattedAddress: place.formattedAddress || '',
            location: {
              lat: place.location.lat(),
              lng: place.location.lng(),
            },
            category: 'LANDMARK',
          });
        }
      } catch (err) {
        checkAndDispatchQuotaError(err);
      }
    };

    runCustomSearch();
  }, [placesLib, customSearchQuery, onCustomDestinationFound]);

  // Compute Real Driving Route on Chennai Roads via Routes API (Route.computeRoutes)
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !routesLib || !activeMission) return;

    const targetLoc =
      activeMission.stage === 'GO_TO_ORIGIN'
        ? activeMission.originLocation
        : activeMission.destinationLocation;

    const startLoc =
      activeMission.stage === 'GO_TO_ORIGIN'
        ? mapCenterRef.current
        : activeMission.originLocation;

    let cancelled = false;

    const computeMissionRoute = async () => {
      try {
        const RouteClass = (routesLib as unknown as {
          Route: {
            computeRoutes: (req: Record<string, unknown>) => Promise<{
              routes?: Array<{
                path?: Array<GmpLatLng | { lat: number; lng: number }>;
                distanceMeters?: number;
                createPolylines?: () => GmpPolyline[];
              }>;
            }>;
          };
        }).Route;

        if (!RouteClass || typeof RouteClass.computeRoutes !== 'function') return;

        const response = await RouteClass.computeRoutes({
          origin: startLoc,
          destination: targetLoc,
          travelMode: 'DRIVING',
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (cancelled) return;

        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) return;

        if (typeof primaryRoute.createPolylines === 'function') {
          const newPolylines = primaryRoute.createPolylines();
          newPolylines.forEach((polyline: GmpPolyline) => {
            polyline.setOptions({
              strokeColor: activeMission.stage === 'GO_TO_ORIGIN' ? '#F59E0B' : '#10B981',
              strokeOpacity: 0.9,
              strokeWeight: 5,
            });
            polyline.setMap(map);
          });
          polylinesRef.current = newPolylines;
        }

        const rawPath = primaryRoute.path || [];
        const points: { lat: number; lng: number }[] = rawPath.map((pt) => {
          if (typeof (pt as GmpLatLng).lat === 'function') {
            return {
              lat: (pt as GmpLatLng).lat(),
              lng: (pt as GmpLatLng).lng(),
            };
          }
          return pt as { lat: number; lng: number };
        });

        onMissionRouteComputed(
          points.length > 0 ? points : [startLoc, targetLoc],
          primaryRoute.distanceMeters || 850
        );
      } catch (err) {
        checkAndDispatchQuotaError(err);
        const midDelta = metersToLatLngDelta(120, -120);
        onMissionRouteComputed(
          [
            startLoc,
            {
              lat: (startLoc.lat + targetLoc.lat) / 2 + midDelta.dLat,
              lng: (startLoc.lng + targetLoc.lng) / 2 + midDelta.dLng,
            },
            targetLoc,
          ],
          900
        );
      }
    };

    computeMissionRoute();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    activeMission?.mission.id,
    activeMission?.stage,
    activeMission?.originLocation.lat,
    activeMission?.destinationLocation.lat,
  ]);

  return (
    <>
      {/* Player Live GPS Radar Arrow on Google Map */}
      <AdvancedMarker
        position={{ lat: playerPosState.lat, lng: playerPosState.lng }}
        title="Your Vehicle"
      >
        <div
          className="w-5 h-5 flex items-center justify-center"
          style={{ transform: `rotate(${playerPosState.heading}deg)` }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow">
            <polygon
              points="12,2 21,21 12,16 3,21"
              fill="#FACC15"
              stroke="#090D16"
              strokeWidth="2"
            />
          </svg>
        </div>
      </AdvancedMarker>

      {discoveredNodes.map((node) => {
        const isMissionOrigin = node.category === 'MISSION_ORIGIN';
        const isMissionTarget = node.category === 'MISSION_TARGET';
        const isGarage = node.category === 'PAY_N_SPRAY';

        if (isMissionTarget && activeMission?.mission.id !== node.missionId) {
          return null;
        }

        const badgeColor = isMissionOrigin
          ? '#F59E0B'
          : isMissionTarget
          ? '#10B981'
          : isGarage
          ? '#38BDF8'
          : '#F43F5E';

        return (
          <AdvancedMarker
            key={node.id}
            position={node.location}
            title={node.displayName}
          >
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/90 border text-[10px] font-semibold tracking-wide text-slate-100 shadow whitespace-nowrap"
              style={{ borderColor: badgeColor }}
            >
              <span
                className="w-1.5 h-1.5 rounded-xs shrink-0"
                style={{ backgroundColor: badgeColor }}
              />
              <span>{node.displayName}</span>
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
}

export const ChennaiMapLayer: React.FC<ChennaiMapLayerProps> = (props) => {
  const { gameState, isFullMapOpen, onToggleFullMap } = props;

  // Hide radar on Title Menu so 3D Hero Vehicle Showcase takes center stage
  const isHidden = gameState === 'TITLE_MENU';

  return (
    <div
      className={
        isHidden
          ? 'fixed -left-[9999px] top-0 w-64 h-44 opacity-0 pointer-events-none'
          : isFullMapOpen
          ? 'fixed inset-6 md:inset-12 z-30 rounded-xl overflow-hidden border-2 border-amber-400 shadow-2xl bg-slate-950 pointer-events-auto'
          : 'fixed top-36 left-3 md:left-5 z-20 w-48 h-36 md:w-56 md:h-40 rounded-lg overflow-hidden border-2 border-slate-700 shadow-xl bg-slate-950 pointer-events-auto'
      }
    >
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={INITIAL_VIEWPORT_CENTER}
        defaultZoom={16.5}
        mapTypeId={props.mapTypeId}
        colorScheme="DARK"
        disableDefaultUI={true}
        gestureHandling={isFullMapOpen ? 'greedy' : 'none'}
        keyboardShortcuts={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="w-full h-full"
      >
        <MapSynchronizer {...props} />
      </GoogleMap>

      {/* GTA Radar Header Strip */}
      <div className="absolute top-0 inset-x-0 px-2.5 py-1 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-[10px] font-mono-num text-slate-200">
        <span className="text-amber-400 font-semibold">CHENNAI GPS RADAR</span>
        <button
          type="button"
          onClick={onToggleFullMap}
          className="text-sky-400 hover:underline cursor-pointer"
        >
          {isFullMapOpen ? 'Minimize [M]' : 'Expand [M]'}
        </button>
      </div>
    </div>
  );
};
