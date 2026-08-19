import { View } from 'react-native';
import { useColors } from '../hooks/useColors';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useActivityStore } from '../store/activityStore';
import { useLocationTracker } from '../hooks/useLocationTracker';
import { fetchRouteById } from '../services/routes';
import { getActivityByKey } from '../lib/constants';
import { LiveRecordingMap } from '../components/activity/LiveRecordingMap';
import { MAPBOX_STYLES, type MapboxStyleKey } from '../components/map/MapViewWrapper';
import { IdleView } from '../components/record/IdleView';
import { CountdownView } from '../components/record/CountdownView';
import { RecordingView } from '../components/record/RecordingView';
import { NonDistanceRecordingView } from '../components/record/NonDistanceRecordingView';
import { PausedView } from '../components/record/PausedView';
import { NonDistancePausedView } from '../components/record/NonDistancePausedView';
import { FinishedView } from '../components/record/FinishedView';
import { MapControls, mapControlsHeight } from '../components/record/MapControls';
import { type Colors } from '../lib/theme';

/**
 * Orquestra o fluxo de gravação: escolhe a vista conforme o estado da atividade
 * e mantém as definições do mapa (estilo, relevo, 3D) partilhadas entre elas.
 * Cada vista vive no seu ficheiro em components/record/.
 */
export default function RecordScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const state = useActivityStore((s) => s.state);
  const type = useActivityStore((s) => s.type);
  const selectRoute = useActivityStore((s) => s.selectRoute);
  const { startTracking, stopTracking } = useLocationTracker();
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const isDistanceBased = getActivityByKey(type ?? '')?.distance_based ?? true;

  // Definições do mapa — partilhadas por todos os estados
  const [mapStyle, setMapStyle] = useState<MapboxStyleKey>('outdoors');
  const [showTerrain, setShowTerrain] = useState(true);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [followUser, setFollowUser] = useState(true);

  const handleCenterOnUser = useCallback(() => {
    setFollowUser(false);
    setTimeout(() => setFollowUser(true), 50);
  }, []);

  // Rota vinda por parâmetro (ex.: "Seguir" a partir do mapa ou da pesquisa)
  useEffect(() => {
    if (!routeId) return;
    fetchRouteById(routeId)
      .then((route) => {
        if (route) selectRoute(route.id, route.name, route.path);
      })
      .catch(() => { /* rota inexistente — ignorar */ });
  }, [routeId, selectRoute]);

  // Parar o GPS ao sair do estado de gravação (pausa, fim, descartar)
  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current === 'recording' && state !== 'recording') {
      stopTracking();
    }
    prevState.current = state;
  }, [state, stopTracking]);

  /** Mapa em cima + vista em baixo, o arranjo comum a idle/gravação/pausa. */
  const withMap = (mapFlex: number, children: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: mapFlex }}>
        <LiveRecordingMap
          style={{ flex: 1 }}
          mapStyle={MAPBOX_STYLES[mapStyle]}
          terrain={showTerrain}
          hillshade={showTerrain}
          showContours={showTerrain}
          followUser={followUser}
          followPitch={show3D ? 60 : 0}
          compassPosition={{ top: insets.top + 8 + mapControlsHeight() + 8, right: 12 }}
        />
        <MapControls
          showTerrain={showTerrain}
          onToggleTerrain={() => setShowTerrain((v) => !v)}
          showStyleMenu={showStyleMenu}
          onToggleStyleMenu={() => setShowStyleMenu((v) => !v)}
          mapStyle={mapStyle}
          onSelectStyle={(key) => { setMapStyle(key); setShowStyleMenu(false); }}
          show3D={show3D}
          onToggle3D={() => setShow3D((v) => !v)}
          onCenterOnUser={handleCenterOnUser}
        />
      </View>
      <View style={{ flex: 1 - mapFlex }}>{children}</View>
    </View>
  );

  /** Atividades sem GPS ocupam o ecrã todo, sem mapa. */
  const withoutMap = (children: ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      {children}
    </SafeAreaView>
  );

  switch (state) {
    case 'idle':
      return isDistanceBased
        ? withMap(0.65, <IdleView />)
        : withoutMap(<IdleView isDistanceBased={false} />);

    case 'countdown':
      return <CountdownView />;

    case 'recording':
      return isDistanceBased
        ? withMap(0.4, <RecordingView startTracking={startTracking} />)
        : withoutMap(<NonDistanceRecordingView />);

    case 'paused':
      return isDistanceBased
        ? withMap(0.4, <PausedView />)
        : withoutMap(<NonDistancePausedView />);

    case 'finished':
      return <FinishedView isDistanceBased={isDistanceBased} />;

    default:
      return <IdleView />;
  }
}
