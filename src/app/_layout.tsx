import { useEffect, useMemo, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { usePendingSync } from '../hooks/usePendingSync';
import { useActivityStore } from '../store/activityStore';
import { Stack, router, usePathname } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { ActivityIndicator, Animated, Easing, View, StatusBar, Text, StyleSheet, TouchableOpacity, Appearance } from 'react-native';
import { CustomHeader } from '../components/common/CustomHeader';
import { useFonts } from 'expo-font';
import { supabase } from '../services/supabase';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_900Black,
} from '@expo-google-fonts/barlow-condensed';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono';
import Mapbox from '@rnmapbox/maps';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useColors } from '../hooks/useColors';
import { Logo } from '../components/common/Logo';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { MAPBOX_ACCESS_TOKEN } from '../lib/constants';
import { type Colors } from '../lib/theme';
import { PostHogProvider } from 'posthog-react-native';
import { posthog, track } from '../lib/analytics';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// Keep React Query in sync with device network state.
// Uses expo-network when native module is linked (after prebuild);
// falls back to always-online otherwise.
try {
  const NetworkMod = require('expo-network');
  onlineManager.setEventListener((setOnline) => {
    const subscription = NetworkMod.addNetworkStateListener((state: any) => {
      setOnline(!!state.isConnected);
    });
    return () => subscription.remove();
  });
} catch {
  // expo-network native module not linked — React Query stays always-online
}

/**
 * Quanto tempo a marca fica no ecrã, no mínimo.
 *
 * O contador arranca com o componente e corre **ao mesmo tempo** que a sessão
 * e as fontes carregam: o arranque é `max(carregamento, 2s)` e não a soma dos
 * dois. Sem isto, em quem já tem sessão guardada — que é toda a gente a partir
 * do segundo arranque — o ecrã da marca aparecia e desaparecia no mesmo
 * instante, o que se lê como um piscar e não como um arranque.
 */
const TEMPO_MINIMO_DA_MARCA_MS = 2000;

/** Quanto demora a marca a abrir-se por cima da app já montada. */
const DURACAO_DA_TRANSICAO_MS = 600;

/**
 * Até onde o símbolo cresce antes de desaparecer.
 *
 * Passa da borda do ecrã de propósito: o que se quer não é um símbolo a ficar
 * grande, é a sensação de se entrar por ele adentro.
 */
const AMPLIACAO_FINAL = 1.8;

/**
 * De que tamanho a app entra, antes de assentar no seu.
 *
 * Enquanto o símbolo se afasta a acelerar, a app aproxima-se a travar. É o par
 * que faz os dois movimentos parecerem o mesmo movimento.
 */
const AMPLIACAO_INICIAL_DA_APP = 0.94;

function AuthGate({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const { isLoading } = useAuthStore();
  const [tempoMinimoCumprido, setTempoMinimoCumprido] = useState(false);
  const [marcaMontada, setMarcaMontada] = useState(true);
  const opacidadeDaMarca = useRef(new Animated.Value(1)).current;
  const ampliacaoDaMarca = useRef(new Animated.Value(1)).current;
  const opacidadeDaApp = useRef(new Animated.Value(0)).current;
  const ampliacaoDaApp = useRef(new Animated.Value(AMPLIACAO_INICIAL_DA_APP)).current;

  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_900Black,
    DMMono_400Regular,
  });

  useEffect(() => {
    const temporizador = setTimeout(() => setTempoMinimoCumprido(true), TEMPO_MINIMO_DA_MARCA_MS);
    return () => clearTimeout(temporizador);
  }, []);

  /**
   * Duas condições, e não uma — foi aqui que estava o defeito.
   *
   * A app montava-se no instante em que a transição começava, e a animação de
   * *push* do navegador corria à vista por baixo da marca a desaparecer: via-se
   * o primeiro ecrã a deslizar da direita, que não tem nada que ver com o
   * movimento do símbolo. Agora monta-se assim que **carrega**, tapada por uma
   * sobreposição ainda opaca, e o deslize do navegador acontece sem ninguém o
   * ver. Quando o `pronto` chega, o que está por baixo já assentou.
   */
  const carregado = !isLoading && fontsLoaded;
  const pronto = carregado && tempoMinimoCumprido;

  /**
   * A marca não sai de cena: cresce e abre-se sobre a app já montada.
   *
   * Trocar um ecrã pelo outro dava um corte seco. Aqui a app monta-se por
   * baixo assim que está pronta e o símbolo amplia-se por cima dela até se
   * desfazer — o que também esconde o primeiro fotograma da app, que é o mais
   * provável de aparecer ainda por compor.
   *
   * As duas curvas são `Easing.in`, e é isso que faz a diferença entre um
   * símbolo a inchar e a sensação de se entrar por ele adentro: começa devagar
   * e acelera, como quem se aproxima. Com `Easing.out` o movimento trava no
   * fim e parece que a marca ficou presa ao vidro.
   *
   * A opacidade segura-se no início pela mesma razão — se desaparecesse a um
   * ritmo constante, a marca já não estaria lá quando a ampliação se nota.
   */
  useEffect(() => {
    if (!pronto) return;
    Animated.parallel([
      Animated.timing(ampliacaoDaMarca, {
        toValue: AMPLIACAO_FINAL,
        duration: DURACAO_DA_TRANSICAO_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacidadeDaMarca, {
        toValue: 0,
        duration: DURACAO_DA_TRANSICAO_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // A app faz o movimento contrário, e é o contrário que os liga: o
      // símbolo afasta-se a acelerar (`in`), a app aproxima-se a travar
      // (`out`). Duas curvas iguais dariam duas coisas a acontecer ao mesmo
      // tempo; estas duas dão uma só.
      Animated.timing(ampliacaoDaApp, {
        toValue: 1,
        duration: DURACAO_DA_TRANSICAO_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacidadeDaApp, {
        toValue: 1,
        duration: DURACAO_DA_TRANSICAO_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setMarcaMontada(false));
  }, [pronto, opacidadeDaMarca, ampliacaoDaMarca, opacidadeDaApp, ampliacaoDaApp]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {/* O invólucro fica montado para sempre, com os valores a assentar em 1.
          Trocá-lo por `children` nus no fim remontava a app inteira. */}
      <Animated.View
        style={{
          flex: 1,
          opacity: opacidadeDaApp,
          transform: [{ scale: ampliacaoDaApp }],
        }}
      >
        {carregado ? children : null}
      </Animated.View>
      {marcaMontada ? (
        // Fica a receber os toques até desaparecer de vez: durante a
        // transição a app já está lá por baixo, meia visível, e um toque
        // certeiro abriria um ecrã que ninguém escolheu.
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: opacidadeDaMarca,
              backgroundColor: c.background,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          {/* A ampliação vai neste invólucro e não na sobreposição: o fundo
              tem de continuar a tapar o ecrã todo enquanto o símbolo cresce,
              senão via-se a app pelas bordas a meio da transição. */}
          <Animated.View style={{ transform: [{ scale: ampliacaoDaMarca }] }}>
            {/* Só o símbolo, como fazem as apps que se abrem todos os dias. De
                caminho deixa de haver aqui dependência nenhuma das fontes:
                este ecrã aparece antes de a Barlow Condensed carregar, e era
                por isso que o nome tinha de esperar por ela para não trocar de
                letra à vista de quem está a olhar. */}
            <Logo size={88} variant="mark" />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function AppStack() {
  const c = useColors();
  const offlineStyles = useMemo(() => makeOfflineStyles(c), [c]);
  const { t } = useTranslation();
  const { isConnected } = useNetworkStatus();
  const { pendingCount, syncing } = usePendingSync();

  // Uma gravação interrompida fica em 'paused'/'finished' depois de rehidratar
  const recordingState = useActivityStore((s) => s.state);
  const pathname = usePathname();
  const hasUnfinishedActivity =
    (recordingState === 'paused' || recordingState === 'finished')
    && !pathname.startsWith('/record');

  return (
    // GestureHandlerRootView é obrigatório para os gestos do react-native-
    // gesture-handler funcionarem (sem ele, no Android não chega nada).
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar
        barStyle={c.scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={c.background}
      />
      {!isConnected && (
        <View style={offlineStyles.banner}>
          <Text style={offlineStyles.bannerText}>{t('offline_banner')}</Text>
        </View>
      )}
      {/* Treino recuperado depois de a app fechar a meio. Sem este aviso,
          ficaria esquecido no separador Registar. */}
      {hasUnfinishedActivity && (
        <TouchableOpacity
          style={offlineStyles.resumeBanner}
          onPress={() => router.push('/record')}
          activeOpacity={0.85}
        >
          <Text style={offlineStyles.bannerText}>
            {t('recording_in_progress')}
          </Text>
        </TouchableOpacity>
      )}

      {/* O utilizador tem de saber que o treino está guardado mas ainda não
          foi enviado — senão parece que se perdeu. */}
      {pendingCount > 0 && (
        <View style={offlineStyles.pendingBanner}>
          {syncing && <ActivityIndicator size="small" color={c.primaryForeground} />}
          <Text style={offlineStyles.bannerText}>
            {syncing
              ? 'A enviar atividades guardadas...'
              : pendingCount === 1
              ? t('pending_activities_one', { count: pendingCount })
              : t('pending_activities_other', { count: pendingCount })}
          </Text>
        </View>
      )}
      <Stack
        screenOptions={{
          headerShown: false,
          header: (props) => <CustomHeader {...props} />,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="record"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="activity/[id]"
          options={{ headerShown: true, title: t('activity_detail_screen') }}
        />
        <Stack.Screen
          name="activity/[id]/edit"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="activity/[id]/segment-new"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="segment/[id]"
          options={{ headerShown: true, title: t('segment_screen_title') }}
        />
        <Stack.Screen
          name="profile/[id]"
          options={{ headerShown: true, title: t('profile_screen_title') }}
        />
        <Stack.Screen
          name="profile/edit"
          options={{ headerShown: true, title: t('edit_profile_title') }}
        />
        <Stack.Screen
          name="profile/settings"
          options={{ headerShown: true, title: t('settings_title') }}
        />
        <Stack.Screen
          name="profile/equipment"
          options={{ headerShown: true, title: t('equipment_list_title') }}
        />
        <Stack.Screen
          name="profile/equipment/add"
          options={{ headerShown: true, title: t('equipment_add_title') }}
        />
        <Stack.Screen
          name="profile/equipment/[id]/edit"
          options={{ headerShown: true, title: t('equipment_edit_title') }}
        />
        <Stack.Screen
          name="map/create"
          options={{ headerShown: true, title: t('map_create_title') }}
        />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: true, title: t('notifications_screen_title') }}
        />
        <Stack.Screen
          name="profile/settings/picker"
          options={{ headerShown: true, title: '' }}
        />
        <Stack.Screen
          name="profile/privacy-zones"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="profile/questionnaire"
          options={{ headerShown: true, title: t('settings_training_preferences') }}
        />
        <Stack.Screen
          name="search"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="club/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="club/[id]/chat"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="club/[id]/event-new"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="club/create"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="club/discover"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="challenges"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="events"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="saved"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="messages/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="messages/new"
          options={{ headerShown: false }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}

const makeOfflineStyles = (c: Colors) => StyleSheet.create({
  banner: {
    backgroundColor: c.warning,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pendingBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resumeBanner: {
    alignItems: 'center',
    backgroundColor: c.foreground,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  bannerText: {
    color: c.primaryForeground,
    fontFamily: 'Barlow_500Medium',
    fontSize: 13,
  },
});

export default function RootLayout() {
  const preferenciaDeTema = useSettingsStore((st) => st.settings.theme);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, []);

  // As definições guardadas — entre elas o tema — só eram lidas ao abrir o
  // ecrã de Definições. Sem isto, a app arrancava sempre em claro e só mudava
  // de tema depois de lá passar uma vez.
  useEffect(() => {
    useSettingsStore.getState().loadSettings();
  }, []);

  /**
   * Dizer ao sistema qual é o tema, e não só à nossa paleta.
   *
   * Há partes do ecrã que não são nossas para pintar: o fundo das folhas
   * modais (`presentationStyle="pageSheet"`), o teclado, os alertas, as barras
   * de scroll. Quem escolhia 'escuro' na app com o telemóvel em claro ficava
   * com o conteúdo escuro dentro de uma folha que o iOS continuava a desenhar
   * clara — e via-se uma réstia branca nos cantos arredondados de cima, que é
   * onde a máscara da folha deixa o fundo do sistema à mostra. O ecrã de
   * escolher rota, que é uma pageSheet, era o caso mais visível.
   *
   * `'unspecified'` devolve o controlo ao telemóvel — é assim que esta versão
   * do React Native diz "sem preferência" (o `null` da documentação não passa
   * no tipo).
   */
  useEffect(() => {
    Appearance.setColorScheme(
      preferenciaDeTema === 'system' ? 'unspecified' : preferenciaDeTema,
    );
  }, [preferenciaDeTema]);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const hash = url.split('#')[1] ?? '';
      if (!hash) return;
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token') ?? '';
      if (access_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        // Sem isto a sessão existia só no supabase-js: o `authStore` continuava
        // a achar que ninguém tinha entrado, e quem acabava de confirmar o
        // email caía no ecrã de login. O `adoptSession` também trata de criar o
        // perfil a partir do registo guardado antes da confirmação.
        if (!error && data.session) {
          await useAuthStore.getState().adoptSession(data.session);
        }
      }
    };

    // App opened from a cold start via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // App already open, incoming deep link
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  // Set up push notifications
  usePushNotifications();

  // Base do cálculo de retenção a 1, 7 e 30 dias.
  useEffect(() => {
    track('app_opened');
  }, []);

  return (
    <PostHogProvider client={posthog}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <I18nextProvider i18n={i18n}>
            <AppStack />
          </I18nextProvider>
        </AuthGate>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
