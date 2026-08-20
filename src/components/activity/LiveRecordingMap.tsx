import { UserTrackingMode } from '@rnmapbox/maps';
import { MapViewWrapper, MAPBOX_STYLES } from '../map/MapViewWrapper';
import { RoutePolyline } from '../map/RoutePolyline';
import { RouteMarker } from '../map/RouteMarker';
import { useActivityStore } from '../../store/activityStore';
import { useTranslation } from 'react-i18next';

interface LiveRecordingMapProps {
  /** Empurra a bússola para baixo dos controlos do ecrã. */
  compassPosition?: { top: number; right: number };
  style?: any;
  mapStyle?: string;
  terrain?: boolean;
  hillshade?: boolean;
  showContours?: boolean;
  followUser?: boolean;
  followPitch?: number;
}

export function LiveRecordingMap({
  style,
  mapStyle = MAPBOX_STYLES.outdoors,
  terrain: showTerrain = true,
  hillshade: showHillshade = true,
  showContours = true,
  followUser = true,
  followPitch,
  compassPosition,
}: LiveRecordingMapProps) {
  const { t } = useTranslation();
  const points = useActivityStore((s) => s.points);
  const currentLocation = useActivityStore((s) => s.currentLocation);
  const routePath = useActivityStore((s) => s.selectedRoutePath);
  const routeName = useActivityStore((s) => s.selectedRouteName);

  const liveCoords: [number, number][] = points.map((p) => [p.lng, p.lat]);
  const hasRoute = routePath && routePath.length >= 2;

  return (
    <MapViewWrapper
      compassPosition={compassPosition}
      center={currentLocation ? [currentLocation.lng, currentLocation.lat] : undefined}
      zoom={15}
      mapStyle={mapStyle}
      showUserLocation={true}
      followUser={followUser}
      followUserMode={UserTrackingMode.FollowWithCourse}
      followPitch={followPitch}
      animationDuration={1000}
      terrain={showTerrain}
      hillshade={showHillshade}
      showContours={showContours}
      style={style}
    >
      {hasRoute && (
        <>
          <RoutePolyline
            id={`route-${routeName}`}
            coordinates={routePath!}
            color="#3b82f6"
            opacity={0.5}
            width={3}
          />
          {routePath![0] && (
            <RouteMarker
              id="route-start"
              coordinate={routePath![0]}
              type="start"
              label={t('routes_start')}
            />
          )}
          {routePath![routePath!.length - 1] && (
            <RouteMarker
              id="route-finish"
              coordinate={routePath![routePath!.length - 1]}
              type="finish"
              label={t('segment_new_end')}
            />
          )}
        </>
      )}
      {liveCoords.length >= 2 && (
        <RoutePolyline id="live-track" coordinates={liveCoords} opacity={0.8} width={4} />
      )}
    </MapViewWrapper>
  );
}
