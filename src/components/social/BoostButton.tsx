import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { giveKudo, removeKudo } from '../../services/social';
import { typography, type Colors } from '../../lib/theme';

interface BoostButtonProps {
  activityId: string;
  initialBoosted: boolean;
  initialCount: number;
}

export function BoostButton({ activityId, initialBoosted, initialCount }: BoostButtonProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [boosted, setBoosted] = useState(initialBoosted);
  const [count, setCount] = useState(initialCount);

  const handlePress = async () => {
    // Optimistic update
    const newBoosted = !boosted;
    setBoosted(newBoosted);
    setCount((c) => c + (newBoosted ? 1 : -1));

    try {
      if (newBoosted) {
        await giveKudo(activityId);
      } else {
        await removeKudo(activityId);
      }
    } catch {
      // Revert on error
      setBoosted(!newBoosted);
      setCount((c) => c + (newBoosted ? -1 : 1));
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Ionicons
        name={boosted ? 'heart' : 'heart-outline'}
        size={20}
        color={boosted ? c.primary : c.mutedForeground}
      />
      <Text style={[styles.count, boosted && styles.countActive]}>{count}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: { fontSize: 20 },
  iconActive: {},
  count: { ...typography.mono, fontSize: 14, color: c.mutedForeground },
  countActive: { color: c.primary },
});
