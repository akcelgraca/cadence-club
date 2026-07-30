import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../hooks/useColors';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

export function CustomHeader({ options, back }: NativeStackHeaderProps) {
  const c = useColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: c.background, borderBottomColor: c.border, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.side}>
          {back ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color={c.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
          {options.title ?? ''}
        </Text>
        <View style={styles.side} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    paddingHorizontal: 8,
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 20,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
