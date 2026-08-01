import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import RouteSketch, { LatLng } from "./RouteSketch";

/**
 * Cartão de estatísticas com FUNDO TRANSPARENTE (sticker à Strava).
 *
 * É renderizado fora do ecrã e capturado em PNG com react-native-view-shot,
 * ao terminar uma atividade. Segue o formato 9:16 das stories.
 *
 * Layout: distância · ritmo · tempo empilhados com separadores, traçado real
 * do percurso e logótipo — conforme assets/images/design_share_t.png.
 */

export interface ShareCardData {
  distanceKm: number;
  paceSecPerKm: number;
  durationSec: number;
  routeCoords: LatLng[];
}

const NEON = "#C8F31D";

/** Sombra suave para o texto se ler sobre stories claras e escuras. */
const shadow = {
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
} as const;

function formatPace(secPerKm: number) {
  if (!secPerKm || secPerKm <= 0) return "--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.label, shadow]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, shadow]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {!!unit && <Text style={[styles.unit, shadow]}>{unit}</Text>}
      </View>
    </View>
  );
}

/** Logótipo Cadence Club — laço em SVG + wordmark. */
function BrandLogo() {
  return (
    <View style={styles.logo}>
      <Svg width={230} height={78} viewBox="0 0 230 78">
        {/* Laço que envolve o wordmark, como no logótipo da marca */}
        <Path
          d="M112 12 C 60 6, 18 22, 30 40 C 42 58, 120 70, 178 62 C 214 57, 226 44, 196 36"
          fill="none"
          stroke={NEON}
          strokeWidth={5}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.logoText}>
        <Text style={styles.logoLine}>adence</Text>
        <Text style={styles.logoLine}>Club</Text>
      </View>
    </View>
  );
}

const ShareActivityCard = forwardRef<View, { data: ShareCardData; width?: number }>(
  ({ data, width = 360 }, ref) => {
    const height = width * (16 / 9); // formato de story
    const km = data.distanceKm.toLocaleString("pt-PT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const hasRoute = data.routeCoords.length >= 2;

    return (
      <View ref={ref} collapsable={false} style={[styles.card, { width, height }]}>
        <View style={styles.stats}>
          <Stat label="DISTÂNCIA" value={km} unit="km" />
          <View style={styles.divider} />
          <Stat label="RITMO" value={formatPace(data.paceSecPerKm)} unit="/ km" />
          <View style={styles.divider} />
          <Stat label="TEMPO" value={formatDuration(data.durationSec)} />
        </View>

        {hasRoute && (
          <View style={styles.route}>
            <RouteSketch
              coords={data.routeCoords}
              width={width * 0.62}
              height={width * 0.42}
              strokeWidth={5}
            />
          </View>
        )}

        <BrandLogo />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },

  stats: { alignItems: "center", alignSelf: "stretch", paddingHorizontal: 40 },
  stat: { alignItems: "center", paddingVertical: 14 },
  label: {
    fontFamily: "Barlow_500Medium",
    fontSize: 22,
    letterSpacing: 1.5,
    color: "#FFFFFF",
    marginBottom: 2,
  },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  value: {
    fontFamily: "BarlowCondensed_900Black",
    fontSize: 68,
    lineHeight: 74,
    color: "#FFFFFF",
  },
  unit: {
    fontFamily: "Barlow_500Medium",
    fontSize: 26,
    color: "#FFFFFF",
  },
  divider: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  route: { marginTop: 28, alignItems: "center" },

  logo: { marginTop: 28, alignItems: "center", justifyContent: "center" },
  logoText: { position: "absolute", alignItems: "center" },
  logoLine: {
    fontFamily: "BarlowCondensed_900Black",
    fontSize: 30,
    lineHeight: 32,
    color: NEON,
  },
});

export default ShareActivityCard;
