import { useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { computeSplits, type SplitPoint } from '../../utils/splits';
import { formatPace } from '../../utils/formatPace';
import { useSettingsStore } from '../../store/settingsStore';
import { typography, withAlpha, type Colors } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

/**
 * Parciais por quilómetro (ou milha), com barra proporcional ao ritmo.
 *
 * A barra é o que torna a tabela legível de relance: quanto mais longa, mais
 * rápido foi o parcial. O mais rápido fica marcado.
 */

interface SplitsTableProps {
  points: SplitPoint[];
  /** Limita as linhas mostradas (ex.: resumo pós-treino). */
  maxRows?: number;
}

export function SplitsTable({ points, maxRows }: SplitsTableProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const unitSystem = useSettingsStore((s) => s.settings.unitSystem);
  const unitLabel = unitSystem === 'imperial' ? 'mi' : 'km';

  const splits = useMemo(() => computeSplits(points, unitSystem), [points, unitSystem]);

  const { fastestIndex, minPace, maxPace } = useMemo(() => {
    const full = splits.filter((s) => !s.isPartial && s.pace > 0);
    if (full.length === 0) return { fastestIndex: -1, minPace: 0, maxPace: 0 };
    let fastest = full[0];
    for (const s of full) if (s.pace < fastest.pace) fastest = s;
    return {
      fastestIndex: fastest.index,
      minPace: Math.min(...full.map((s) => s.pace)),
      maxPace: Math.max(...full.map((s) => s.pace)),
    };
  }, [splits]);

  if (splits.length === 0) return null;

  const visible = maxRows ? splits.slice(0, maxRows) : splits;
  const hiddenCount = splits.length - visible.length;

  /** Ritmo mais rápido → barra cheia. Escala mínima de 40% para não desaparecer. */
  const barWidth = (pace: number) => {
    if (pace <= 0) return 0;
    if (maxPace === minPace) return 1;
    const normalized = (maxPace - pace) / (maxPace - minPace);
    return 0.4 + normalized * 0.6;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.colIndex]}>{unitLabel}</Text>
        <Text style={[styles.headerCell, styles.colPace]}>{t('pace')}</Text>
        <View style={styles.colBar} />
        <Text style={[styles.headerCell, styles.colElev]}>{t('splits_elevation')}</Text>
      </View>

      {visible.map((split) => {
        const isFastest = split.index === fastestIndex;
        return (
          <View key={split.index} style={styles.row}>
            <Text style={[styles.index, isFastest && styles.textFastest]}>
              {split.isPartial
                ? (split.distance / (unitSystem === 'imperial' ? 1609.344 : 1000))
                    .toFixed(2)
                    .replace('.', ',')
                : split.index}
            </Text>

            <Text style={[styles.pace, isFastest && styles.textFastest]}>
              {formatPace(split.pace, unitSystem)}
            </Text>

            <View style={styles.colBar}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${barWidth(split.pace) * 100}%`,
                    backgroundColor: isFastest ? c.primary : withAlpha(c.primary, 0.35),
                  },
                  split.isPartial && styles.barPartial,
                ]}
              />
              {isFastest && (
                <Ionicons name="flash" size={11} color={c.primary} style={styles.fastestIcon} />
              )}
            </View>

            <Text style={styles.elev}>
              {split.elevationGain >= 1 ? `+${Math.round(split.elevationGain)}` : '—'}
            </Text>
          </View>
        );
      })}

      {hiddenCount > 0 && (
        <Text style={styles.more}>
          {t('splits_hidden', { count: hiddenCount })}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { gap: 2 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerCell: {
    fontFamily: 'Barlow_500Medium',
    fontSize: 9,
    letterSpacing: 1,
    color: c.mutedForeground,
    textTransform: 'uppercase',
  },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },

  colIndex: { width: 34 },
  colPace: { width: 78 },
  colBar: { flex: 1, height: 8, justifyContent: 'center', paddingRight: 10 },
  colElev: { width: 44, textAlign: 'right' },

  index: {
    width: 34,
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 15,
    color: c.foreground,
  },
  pace: {
    width: 78,
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
    color: c.foreground,
  },
  elev: {
    width: 44,
    textAlign: 'right',
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: c.mutedForeground,
  },
  textFastest: { color: c.primary },

  bar: { height: 8, borderRadius: 4, minWidth: 4 },
  barPartial: { opacity: 0.5 },
  fastestIcon: { position: 'absolute', right: 0 },

  more: {
    ...typography.body,
    fontSize: 12,
    color: c.mutedForeground,
    textAlign: 'center',
    paddingTop: 10,
  },
});
