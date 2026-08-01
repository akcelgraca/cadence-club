import React, { useMemo } from "react";
import Svg, { Circle, Polyline } from "react-native-svg";

const NEON = "#C8F31D";

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface Props {
  coords: LatLng[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  maxPoints?: number;
}

// Desenha a rota como polyline néon com pontos de início/fim.
// Normaliza lat/lng para o viewBox preservando a proporção do percurso.
export default function RouteSketch({
  coords,
  width = 260,
  height = 160,
  strokeWidth = 6,
  maxPoints = 120,
}: Props) {
  const { points, start, end } = useMemo(() => {
    if (coords.length < 2) return { points: "", start: null, end: null };

    // decimação simples para não desenhar milhares de pontos
    const step = Math.max(1, Math.floor(coords.length / maxPoints));
    const sampled = coords.filter(
      (_, i) => i % step === 0 || i === coords.length - 1,
    );

    const lats = sampled.map((c) => c.latitude);
    const lngs = sampled.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // compensa a distorção de longitude com a latitude média
    const latMid = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const spanLng = Math.max(1e-6, (maxLng - minLng) * Math.cos(latMid));
    const spanLat = Math.max(1e-6, maxLat - minLat);

    const pad = strokeWidth + 6;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const scale = Math.min(innerW / spanLng, innerH / spanLat);
    const offsetX = (innerW - spanLng * scale) / 2 + pad;
    const offsetY = (innerH - spanLat * scale) / 2 + pad;

    const project = (c: LatLng) => ({
      x: offsetX + (c.longitude - minLng) * Math.cos(latMid) * scale,
      y: offsetY + (maxLat - c.latitude) * scale,
    });

    const projected = sampled.map(project);
    return {
      points: projected.map((p) => `${p.x},${p.y}`).join(" "),
      start: projected[0],
      end: projected[projected.length - 1],
    };
  }, [coords, width, height, strokeWidth, maxPoints]);

  if (!points) return null;

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={NEON}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {start && (
        <Circle cx={start.x} cy={start.y} r={strokeWidth + 1} fill="#111111" stroke={NEON} strokeWidth={2.5} />
      )}
      {end && (
        <Circle cx={end.x} cy={end.y} r={strokeWidth + 1} fill="#FFFFFF" stroke="#111111" strokeWidth={2.5} />
      )}
    </Svg>
  );
}
