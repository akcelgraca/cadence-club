import { StyleSheet } from 'react-native';
import { colors, withAlpha, typography } from '../../lib/theme';

/** Estilos partilhados por todas as vistas do ecrã de gravação. */
export const styles = StyleSheet.create({
  // ---- Shared ----
  container: { flex: 1, backgroundColor: colors.background },

  // ---- Idle ----
  idleControls: { flex: 1 },
  closeButton: { position: 'absolute', top: 8, right: 16, zIndex: 10, padding: 8 },

  // Activity type label shown above the start button
  idleActivityLabel: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.foreground,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },

  // Button row
  idleButtonRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 28,
    paddingTop: 8,
  },
  nonDistanceBottomGroup: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  idleButtonRowNoFlex: {
    flex: 0,
    paddingTop: 0,
    gap: 28,
  },
  idleSideButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleSideButtonActive: {
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  idleButtonGroup: {
    alignItems: 'center',
    gap: 8,
  },
  idleButtonLabel: {
    ...typography.mono,
    fontSize: 10,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonDisabled: { opacity: 0.35 },

  // Selected route indicator
  routeSelectedBar: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routeSelectedText: { flex: 1, ...typography.body, color: colors.foreground, fontSize: 13 },

  // Non-distance idle clock (absolutely centered)
  idleClockCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idleClockTime: {
    ...typography.statNumber,
    fontSize: 72,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  idleClockLabel: {
    ...typography.body,
    color: colors.mutedForeground,
    fontSize: 14,
    marginTop: 4,
  },

  // ---- Non-distance views ----
  nonDistanceContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  nonDistanceClockCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonDistanceBottom: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  nonDistanceClock: {
    ...typography.statNumber,
    fontSize: 72,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  nonDistanceClockLabel: {
    ...typography.body,
    color: colors.mutedForeground,
    fontSize: 14,
    marginBottom: 16,
  },
  nonDistanceTimer: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    ...typography.statNumber,
    fontSize: 56,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },

  // ---- Countdown ----
  countdownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  countdownNumber: {
    ...typography.statNumber,
    fontSize: 120,
    color: colors.foreground,
  },
  countdownLabel: {
    ...typography.body,
    fontSize: 18,
    color: colors.mutedForeground,
    marginTop: 8,
  },
  countdownDots: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 32,
  },
  countdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  countdownDotFilled: {
    backgroundColor: colors.primary,
  },

  // ---- Recording ----
  recordingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // GPS row
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  gpsGood: { backgroundColor: colors.gpsGood },
  gpsWeak: { backgroundColor: colors.gpsWeak },
  gpsNone: { backgroundColor: colors.gpsNone },
  gpsText: { ...typography.mono, color: colors.mutedForeground, fontSize: 12 },

  // Time display
  metricTimeRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  metricTime: {
    ...typography.statNumber,
    fontSize: 64,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },

  // Distance + pace row
  metricMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 4,
  },
  metricMainItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricMainValue: {
    ...typography.statNumber,
    fontSize: 26,
    color: colors.foreground,
  },
  metricMainLabel: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  metricDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },

  // Secondary metrics grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  metricGridItem: {
    width: '48.5%',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  metricGridValue: { ...typography.mono, fontSize: 15, color: colors.foreground },
  metricGridLabel: {
    ...typography.mono,
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // Pause button
  pauseButton: {
    backgroundColor: withAlpha(colors.foreground, 0.12),
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 36,
    marginHorizontal: 4,
  },
  pauseButtonText: { ...typography.bodyBold, color: colors.foreground, fontSize: 16 },

  // ---- Paused ----
  pausedContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  pausedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pausedIndicatorTop: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pausedTitle: {
    ...typography.headline,
    fontSize: 16,
    color: colors.warning,
    letterSpacing: 2,
  },
  pausedButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
    marginHorizontal: 4,
  },
  discardButton: {
    flex: 1,
    backgroundColor: withAlpha(colors.destructive, 0.12),
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  discardButtonText: { ...typography.bodyBold, color: colors.destructive, fontSize: 14 },
  resumeButton: {
    flex: 1,
    backgroundColor: withAlpha(colors.gpsGood, 0.15),
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  resumeButtonText: { ...typography.bodyBold, color: colors.gpsGood, fontSize: 14 },
  finishButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  finishButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 14 },

  // ---- Finished ----
  finishedContent: { paddingBottom: 60 },
  finishedHeader: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
  },
  finishedTitle: {
    ...typography.headline,
    fontSize: 26,
    textAlign: 'center',
    color: colors.foreground,
    letterSpacing: 1,
  },
  finishedType: {
    ...typography.body,
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },

  // Summary stats grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  summaryItem: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  // Galeria de fotos (grelha reordenável — ver PhotoGrid)
  photoGridWrap: { paddingHorizontal: 20 },

  /** Fora do ecrã mas com layout, para o view-shot poder capturar. */
  offscreenCard: { position: 'absolute', left: -10000, top: 0 },
  photoCount: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.mutedForeground,
  },

  summaryItemWide: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  summaryMap: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryValue: { ...typography.statNumber, fontSize: 22, color: colors.foreground },
  summaryLabel: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 6,
    textTransform: 'uppercase',
  },

  // Form fields
  fieldLabel: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 20,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.foreground,
    marginHorizontal: 20,
    ...typography.body,
  },
  fieldTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.mono,
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  chipTextActive: {
    color: colors.primaryForeground,
  },

  // Visibility
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 14,
  },
  visibilityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visibilityLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.foreground,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryForeground,
  },
  toggleKnobActive: {
    marginLeft: 'auto' as any,
  },

  // Charts
  chartSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  chartSectionTitle: {
    ...typography.mono,
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // Mood
  moodTitle: {
    ...typography.bodyMedium,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 14,
    marginTop: 24,
    color: colors.foreground,
  },
  moodRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 28 },
  moodButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  moodButtonSelected: { borderColor: colors.primary, backgroundColor: colors.inputBackground },
  moodImage: { width: 48, height: 48, borderRadius: 24, tintColor: '#FFFFFF' },

  // Save button
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 18 },

  // Discard link (at bottom of finished screen)
  discardLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  discardLinkText: {
    ...typography.body,
    fontSize: 14,
    color: colors.destructive,
  },

  // ---- Modal (shared) ----
  modalContainer: { flex: 1, backgroundColor: colors.background, paddingTop: 60 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  modalTitle: { ...typography.headline, fontSize: 22, color: colors.foreground },

  // Search bar in modal
  searchContainer: { paddingHorizontal: 24, marginBottom: 10 },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    ...typography.body,
  },

  // Create route
  createRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: withAlpha(colors.primary, 0.08),
    borderRadius: 10,
  },
  createRouteText: { ...typography.bodyBold, color: colors.primary, fontSize: 13 },
  createRouteLink: { ...typography.bodyBold, color: colors.primary, fontSize: 14, marginTop: 8 },
  clearRouteButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  clearRouteText: { ...typography.body, color: colors.destructive, fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { ...typography.body, color: colors.mutedForeground, marginTop: 12 },
  emptyText: { ...typography.body, color: colors.mutedForeground, fontSize: 14 },
  emptySubtext: { ...typography.body, color: colors.mutedForeground, fontSize: 12, marginTop: 4 },
  routeList: { paddingHorizontal: 24, paddingBottom: 40 },
  routeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  routeCardSelected: { borderColor: colors.primary },
  routeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  routeCardName: { ...typography.bodyBold, color: colors.foreground, fontSize: 15, flexShrink: 1 },
  routeCardCreator: { ...typography.body, color: colors.mutedForeground, fontSize: 11, marginTop: 2 },
  routeCardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  routeCardStat: { ...typography.mono, fontSize: 11, color: colors.mutedForeground },

  // ---- Map controls overlay ----
  mapBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Controlos do mapa — coluna no canto superior direito, fundo claro com
  // sombra para se lerem sobre qualquer estilo de mapa
  mapControlStack: {
    position: 'absolute',
    right: 12,
    gap: 8,
  },
  mapControlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  // Ativo = anel verde sobre o mesmo branco opaco. Um fundo translúcido
  // aqui deixaria o mapa passar através do botão e apagava-o outra vez.
  mapControlBtnActive: {
    borderWidth: 0,
    borderColor: colors.primary,
  },
  styleMenu: {
    position: 'absolute',
    right: 60,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 118,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  styleMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 1,
  },
  styleMenuItemActive: {
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  styleMenuText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
  },
  styleMenuTextActive: {
    color: colors.primary,
    fontFamily: 'DMMono_500Medium',
  },
});
