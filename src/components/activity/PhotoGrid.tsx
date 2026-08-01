import { useCallback, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, withAlpha } from '../../lib/theme';

/**
 * Grelha de fotos com reordenação por arrasto.
 *
 * Grelha em vez de tira horizontal de propósito: com um máximo de 6 fotos tudo
 * cabe sem scroll, o que evita o conflito clássico entre arrastar um item e
 * fazer scroll do contentor.
 *
 * A primeira posição é a capa — reordenar é a forma de escolher qual é.
 */

const COLUMNS = 3;
const GAP = 10;
const ASPECT = 1.25; // 4:5

export interface PhotoGridItem {
  /** Estável entre renders: id da BD ou uri local. */
  key: string;
  uri: string;
  /** Cartão gerado pela app — PNG transparente, mostra-se sobre fundo escuro. */
  generated?: boolean;
}

interface PhotoGridProps {
  photos: PhotoGridItem[];
  onReorder: (photos: PhotoGridItem[]) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  maxPhotos: number;
  loading?: boolean;
}

/** Nova ordem depois de mover um item de `from` para `to`. */
function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface CellProps {
  item: PhotoGridItem;
  index: number;
  /** Índice onde o item é desenhado — muda enquanto outro é arrastado. */
  displayIndex: number;
  cellWidth: number;
  cellHeight: number;
  isDragging: boolean;
  onDragStart: (index: number) => void;
  onDragMove: (translationX: number, translationY: number) => void;
  onDragEnd: () => void;
  onRemove: () => void;
}

function Cell({
  item, index, displayIndex, cellWidth, cellHeight,
  isDragging, onDragStart, onDragMove, onDragEnd, onRemove,
}: CellProps) {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lifted = useSharedValue(0);

  const slotX = (displayIndex % COLUMNS) * (cellWidth + GAP);
  const slotY = Math.floor(displayIndex / COLUMNS) * (cellHeight + GAP);

  const pan = Gesture.Pan()
    // Só depois de manter premido, senão arrastar competia com o toque no ✕
    .activateAfterLongPress(180)
    .onStart(() => {
      lifted.value = withTiming(1, { duration: 120 });
      runOnJS(onDragStart)(index);
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      runOnJS(onDragMove)(e.translationX, e.translationY);
    })
    .onFinalize(() => {
      dragX.value = withSpring(0, { damping: 20, stiffness: 200 });
      dragY.value = withSpring(0, { damping: 20, stiffness: 200 });
      lifted.value = withTiming(0, { duration: 140 });
      runOnJS(onDragEnd)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    // O item arrastado segue o dedo; os outros deslizam para o novo lugar
    left: isDragging ? slotX : withTiming(slotX, { duration: 180 }),
    top: isDragging ? slotY : withTiming(slotY, { duration: 180 }),
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: 1 + lifted.value * 0.06 },
    ],
    zIndex: isDragging ? 10 : 1,
    shadowOpacity: lifted.value * 0.3,
    elevation: isDragging ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.cell,
          { width: cellWidth, height: cellHeight },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri: item.uri }}
          style={[styles.image, item.generated && styles.imageGenerated]}
          resizeMode={item.generated ? 'contain' : 'cover'}
        />

        {item.generated ? (
          <View style={styles.autoBadge}>
            <Text style={styles.autoBadgeText}>Auto</Text>
          </View>
        ) : displayIndex === 0 ? (
          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>Capa</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.remove} onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

export function PhotoGrid({
  photos, onReorder, onRemove, onAdd, maxPhotos, loading,
}: PhotoGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const cellWidth = containerWidth > 0
    ? (containerWidth - GAP * (COLUMNS - 1)) / COLUMNS
    : 0;
  const cellHeight = cellWidth * ASPECT;

  const canAdd = photos.length < maxPhotos;
  const slotCount = photos.length + (canAdd ? 1 : 0);
  const rows = Math.max(1, Math.ceil(slotCount / COLUMNS));
  const gridHeight = rows * cellHeight + (rows - 1) * GAP;

  const handleDragStart = useCallback((index: number) => {
    setActiveIndex(index);
    setHoverIndex(index);
  }, []);

  const handleDragMove = useCallback((translationX: number, translationY: number) => {
    setActiveIndex((current) => {
      if (current == null || cellWidth === 0) return current;

      const startCol = current % COLUMNS;
      const startRow = Math.floor(current / COLUMNS);
      const col = Math.round(startCol + translationX / (cellWidth + GAP));
      const row = Math.round(startRow + translationY / (cellHeight + GAP));

      const target = Math.min(
        photos.length - 1,
        Math.max(0, row * COLUMNS + Math.min(COLUMNS - 1, Math.max(0, col))),
      );
      setHoverIndex(target);
      return current;
    });
  }, [cellWidth, cellHeight, photos.length]);

  const handleDragEnd = useCallback(() => {
    setActiveIndex((from) => {
      setHoverIndex((to) => {
        if (from != null && to != null && from !== to) {
          onReorder(move(photos, from, to));
        }
        return null;
      });
      return null;
    });
  }, [photos, onReorder]);

  /**
   * Onde cada item é desenhado durante o arrasto: o item ativo vai para o
   * slot sob o dedo e os restantes fecham o buraco.
   */
  const displayIndexOf = (index: number): number => {
    if (activeIndex == null || hoverIndex == null) return index;
    if (index === activeIndex) return hoverIndex;
    if (activeIndex < hoverIndex && index > activeIndex && index <= hoverIndex) return index - 1;
    if (activeIndex > hoverIndex && index >= hoverIndex && index < activeIndex) return index + 1;
    return index;
  };

  const addSlot = photos.length;
  const addX = (addSlot % COLUMNS) * (cellWidth + GAP);
  const addY = Math.floor(addSlot / COLUMNS) * (cellHeight + GAP);

  return (
    <View>
      <View
        style={[styles.grid, { height: containerWidth > 0 ? gridHeight : cellHeight || 120 }]}
        onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && photos.map((item, index) => (
          <Cell
            key={item.key}
            item={item}
            index={index}
            displayIndex={displayIndexOf(index)}
            cellWidth={cellWidth}
            cellHeight={cellHeight}
            isDragging={activeIndex === index}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onRemove={() => onRemove(item.key)}
          />
        ))}

        {containerWidth > 0 && canAdd && (
          <TouchableOpacity
            style={[
              styles.addSlot,
              { width: cellWidth, height: cellHeight, left: addX, top: addY },
            ]}
            onPress={onAdd}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={24} color={colors.mutedForeground} />
                <Text style={styles.addText}>
                  {photos.length === 0 ? 'Adicionar' : 'Mais'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {photos.length > 1 && (
        <Text style={styles.hint}>
          Mantém premida uma foto para a arrastar. A primeira é a capa.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { position: 'relative', width: '100%' },

  cell: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  image: { width: '100%', height: '100%' },
  imageGenerated: { backgroundColor: '#0c0c0c' },

  autoBadge: {
    position: 'absolute',
    bottom: 6, left: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: withAlpha(colors.foreground, 0.65),
  },
  autoBadgeText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 9,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  coverBadge: {
    position: 'absolute',
    bottom: 6, left: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  coverBadgeText: {
    fontFamily: 'Barlow_600SemiBold',
    fontSize: 9,
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  remove: {
    position: 'absolute',
    top: 6, right: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  addSlot: {
    position: 'absolute',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  addText: { ...typography.body, fontSize: 12, color: colors.mutedForeground },

  hint: {
    ...typography.body,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 10,
    lineHeight: 15,
  },
});
