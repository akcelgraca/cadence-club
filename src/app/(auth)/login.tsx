import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  Dimensions,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { colors, typography } from '../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---- Welcome Slides Data ----
const SLIDES = [
  {
    id: '1',
    image: require('../../../assets/images/images_initial01.jpg'),
    title: 'O teu progresso ao detalhe',
    description:
      'Corrida, ciclismo, caminhada, regista tudo com GPS, sincroniza com a app Saúde e vê a tua evolução em tempo real.',
  },
  {
    id: '2',
    image: require('../../../assets/images/images_initial02.jpg'),
    title: 'Cada dia conta para algo maior',
    description:
      'Constrói streaks, desbloqueia badges e entra em desafios da comunidade. A motivação nunca foi tão viciante.',
  },
  {
    id: '3',
    image: require('../../../assets/images/images_initial03.jpg'),
    title: 'O teu bairro também treina',
    description:
      'Descobre atletas perto de ti, junta-te a treinos e explora novos percursos com quem partilha a tua paixão.',
  },
];

// ---- Carousel Slide ----
function Slide({
  item,
  index,
  scrollX,
}: {
  item: (typeof SLIDES)[number];
  index: number;
  scrollX: Animated.Value;
}) {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const animatedOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.3, 1, 0.3],
    extrapolate: 'clamp',
  });

  const animatedScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.92, 1, 0.92],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.slide}>
      <Animated.View
        style={[
          styles.slideContent,
          { opacity: animatedOpacity, transform: [{ scale: animatedScale }] },
        ]}
      >
        <Image source={item.image} style={styles.slideImage} resizeMode="cover" />
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </Animated.View>
    </View>
  );
}

// ---- Pagination Dots ----
function PaginationDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: isActive ? 24 : 8,
                backgroundColor: isActive ? colors.primary : colors.mutedForeground,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// ============================================================
// Main Welcome / Login Screen
// ============================================================
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<any>>(null);

  const { t } = useTranslation();
  const { signIn, signInWithGoogle, signInWithApple } = useAuthStore();

  // ---- Auth handlers ----
  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('login_error_title'), t('login_fill_fields'));
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)/feed');
    } catch (err: any) {
      Alert.alert(t('login_error_title'), err.message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  // ---- Social auth handlers ----
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (err: any) {
      if (err.message !== t('login_auth_cancelled')) {
        Alert.alert(t('login_error_title'), err.message || t('error_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      router.replace('/');
    } catch (err: any) {
      Alert.alert(t('login_error_title'), err.message || t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  // ---- Carousel scroll handler ----
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveSlide(idx);
    },
    [],
  );

  // ---- Render ----
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Carousel Section ---- */}
        <View style={[styles.carouselSection, { paddingTop: insets.top }]}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>{t('app_name')}</Text>
          </View>

          {/* Slides */}
          <View style={styles.carouselWrapper}>
            <FlatList
              ref={flatListRef}
              data={SLIDES}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              bounces={false}
              onScroll={onScroll}
              onMomentumScrollEnd={onMomentumEnd}
              scrollEventThrottle={16}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <Slide item={item} index={index} scrollX={scrollX} />
              )}
            />
          </View>

          {/* Pagination */}
          <PaginationDots count={SLIDES.length} activeIndex={activeSlide} />
        </View>

        {/* ---- Auth Form Section ---- */}
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>{t('login_title')}</Text>

          <TextInput
            style={styles.input}
            placeholder={t('email_label')}
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder={t('password_label')}
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {loading ? t('loading') : t('login_button')}
            </Text>
          </TouchableOpacity>

          {/* ---- Separator ---- */}
          <View style={styles.separatorRow}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{t('login_separator')}</Text>
            <View style={styles.separatorLine} />
          </View>

          {/* ---- Social Buttons ---- */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
            activeOpacity={0.75}
          >
            <Text style={styles.socialButtonText}>{t('login_google')}</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={loading}
              activeOpacity={0.75}
            >
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>{t('login_apple')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.switchText}>
              {t('login_no_account')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Styles
// ============================================================
const CAROUSEL_HEIGHT = 420;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // -- Carousel --
  carouselSection: {
    height: CAROUSEL_HEIGHT,
    backgroundColor: colors.card,
    paddingTop: 0,
    paddingBottom: 0,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    ...typography.headline,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  carouselWrapper: {
    flex: 1,
  },

  // -- Slide --
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideContent: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  slideImage: {
    width: SCREEN_WIDTH * 0.75,
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
  },
  slideTitle: {
    ...typography.headline,
    fontSize: 23,
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 10,
  },
  slideDescription: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },

  // -- Dots --
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // -- Auth Form --
  formSection: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },
  formTitle: {
    ...typography.headline,
    fontSize: 22,
    color: colors.foreground,
    marginBottom: 20,
  },
  input: {
    ...typography.body,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: colors.inputBackground,
    marginBottom: 12,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 17,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    ...typography.bodyBold,
    color: colors.primaryForeground,
    fontSize: 17,
    letterSpacing: 0.2,
  },
  switchText: {
    ...typography.bodyMedium,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 18,
    fontSize: 14,
  },

  // -- Social Auth --
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    ...typography.bodyMedium,
    marginHorizontal: 12,
    color: colors.mutedForeground,
    fontSize: 13,
  },
  socialButton: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  socialButtonText: {
    ...typography.bodyBold,
    color: colors.foreground,
    fontSize: 16,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
});
