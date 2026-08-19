import { detectFormat } from './importFile';
import { parseGpx } from './parseGpx';
import { parseTcx } from './parseTcx';

const GPX_STRAVA = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>2026-08-18T09:00:00Z</time></metadata>
  <trk>
    <name>Corrida ao fim da tarde</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="38.7223" lon="-9.1393">
        <ele>10.5</ele>
        <time>2026-08-18T09:00:00Z</time>
      </trkpt>
      <trkpt lat="38.7233" lon="-9.1393">
        <ele>14.2</ele>
        <time>2026-08-18T09:00:30Z</time>
      </trkpt>
      <trkpt lat="38.7243" lon="-9.1393">
        <ele>18.0</ele>
        <time>2026-08-18T09:01:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

const TCX_GARMIN = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>2026-08-18T09:00:00Z</Id>
      <Lap StartTime="2026-08-18T09:00:00Z">
        <DistanceMeters>1500.0</DistanceMeters>
        <Track>
          <Trackpoint>
            <Time>2026-08-18T09:00:00Z</Time>
            <Position>
              <LatitudeDegrees>38.7223</LatitudeDegrees>
              <LongitudeDegrees>-9.1393</LongitudeDegrees>
            </Position>
            <AltitudeMeters>10.5</AltitudeMeters>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-08-18T09:02:00Z</Time>
            <Position>
              <LatitudeDegrees>38.7323</LatitudeDegrees>
              <LongitudeDegrees>-9.1393</LongitudeDegrees>
            </Position>
            <AltitudeMeters>25.0</AltitudeMeters>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

describe('detectFormat', () => {
  it('reconhece as extensões que sabemos ler', () => {
    expect(detectFormat('corrida.gpx')).toBe('gpx');
    expect(detectFormat('CORRIDA.GPX')).toBe('gpx');
    expect(detectFormat('treino.tcx')).toBe('tcx');
  });

  it('devolve null para o que não sabemos ler', () => {
    expect(detectFormat('treino.fit')).toBeNull();
    expect(detectFormat('foto.jpg')).toBeNull();
    expect(detectFormat('sem-extensao')).toBeNull();
  });
});

describe('parseGpx', () => {
  it('lê pontos, altitude, tempos, nome e modalidade', () => {
    const t = parseGpx(GPX_STRAVA)!;

    expect(t.points).toHaveLength(3);
    expect(t.name).toBe('Corrida ao fim da tarde');
    expect(t.rawType).toBe('running');
    expect(t.points[0]).toEqual({
      lat: 38.7223,
      lng: -9.1393,
      elevation: 10.5,
      heartRate: null,
      time: '2026-08-18T09:00:00.000Z',
    });
    // O GPX não declara distância — tem de ser calculada a partir dos pontos.
    expect(t.declaredDistance).toBeNull();
  });

  it('junta vários segmentos e vários trilhos', () => {
    const doisSegmentos = GPX_STRAVA.replace(
      '</trkseg>',
      `</trkseg><trkseg>
        <trkpt lat="38.7253" lon="-9.1393"><time>2026-08-18T09:01:30Z</time></trkpt>
      </trkseg>`,
    );
    expect(parseGpx(doisSegmentos)!.points).toHaveLength(4);
  });

  it('salta pontos sem coordenadas em vez de rejeitar o ficheiro', () => {
    // Um registo corrompido a meio não devia custar a corrida toda.
    const comLixo = GPX_STRAVA.replace(
      '<trkpt lat="38.7233" lon="-9.1393">',
      '<trkpt lat="" lon="">',
    );
    expect(parseGpx(comLixo)!.points).toHaveLength(2);
  });

  it('aceita pontos sem altitude nem tempo', () => {
    const minimo = `<gpx><trk><trkseg>
      <trkpt lat="38.7" lon="-9.1"/>
    </trkseg></trk></gpx>`;
    const t = parseGpx(minimo)!;
    expect(t.points[0].elevation).toBeNull();
    expect(t.points[0].time).toBeNull();
  });

  it('devolve null quando não é um GPX', () => {
    expect(parseGpx('<html><body>não</body></html>')).toBeNull();
    expect(parseGpx('isto não é xml de todo')).toBeNull();
  });

  it('devolve traçado vazio para um GPX sem pontos', () => {
    // Diferente de malformado: o ficheiro é válido, só não tem nada dentro.
    const t = parseGpx('<gpx><metadata><name>Vazio</name></metadata></gpx>');
    expect(t).not.toBeNull();
    expect(t!.points).toHaveLength(0);
  });
});

describe('parseTcx', () => {
  it('lê pontos, modalidade e distância declarada', () => {
    const t = parseTcx(TCX_GARMIN)!;

    expect(t.points).toHaveLength(2);
    expect(t.rawType).toBe('Biking');
    // O TCX traz a distância medida pelo dispositivo, ao contrário do GPX.
    expect(t.declaredDistance).toBe(1500);
    expect(t.points[0].elevation).toBe(10.5);
    expect(t.points[1].time).toBe('2026-08-18T09:02:00.000Z');
  });

  it('soma a distância de todas as voltas', () => {
    const duasVoltas = TCX_GARMIN.replace(
      '</Lap>',
      `</Lap><Lap StartTime="2026-08-18T09:05:00Z">
        <DistanceMeters>500.0</DistanceMeters>
      </Lap>`,
    );
    expect(parseTcx(duasVoltas)!.declaredDistance).toBe(2000);
  });

  it('salta pontos sem posição', () => {
    // Comum num TCX: o relógio perdeu sinal, ou é treino de interior.
    const semPosicao = TCX_GARMIN.replace(
      `<Position>
              <LatitudeDegrees>38.7223</LatitudeDegrees>
              <LongitudeDegrees>-9.1393</LongitudeDegrees>
            </Position>`,
      '',
    );
    expect(parseTcx(semPosicao)!.points).toHaveLength(1);
  });

  it('devolve null quando não é um TCX', () => {
    expect(parseTcx('<gpx><trk/></gpx>')).toBeNull();
  });
});


// ============================================================
// Frequência cardíaca
// ============================================================

describe('frequência cardíaca nos ficheiros', () => {
  it('lê o batimento de um GPX do Garmin', () => {
    // Nem o formato GPX prevê batimento: vive em <extensions>, com o prefixo
    // de namespace de cada fabricante.
    const gpx = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><name>Corrida</name><type>running</type><trkseg>
    <trkpt lat="38.7223" lon="-9.1393">
      <ele>10</ele><time>2026-08-18T09:00:00Z</time>
      <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>142</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
    </trkpt>
    <trkpt lat="38.7233" lon="-9.1393">
      <ele>12</ele><time>2026-08-18T09:05:00Z</time>
      <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>158</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
    </trkpt>
  </trkseg></trk>
</gpx>`;

    const t = parseGpx(gpx);
    expect(t!.points.map((p) => p.heartRate)).toEqual([142, 158]);
  });

  it('lê o batimento sem prefixo de namespace', () => {
    // Há exportadores que largam o prefixo. Procurar pelo sufixo da chave
    // trata dos dois casos sem ter de listar fabricantes.
    const gpx = `<?xml version="1.0"?>
<gpx version="1.1">
  <trk><trkseg>
    <trkpt lat="38.7223" lon="-9.1393">
      <time>2026-08-18T09:00:00Z</time>
      <extensions><TrackPointExtension><hr>131</hr></TrackPointExtension></extensions>
    </trkpt>
  </trkseg></trk>
</gpx>`;

    expect(parseGpx(gpx)!.points[0].heartRate).toBe(131);
  });

  it('devolve null quando o GPX não traz batimento', () => {
    const gpx = `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
  <trkpt lat="38.7223" lon="-9.1393"><time>2026-08-18T09:00:00Z</time></trkpt>
</trkseg></trk></gpx>`;

    expect(parseGpx(gpx)!.points[0].heartRate).toBeNull();
  });

  it('lê o batimento de um TCX, que o embrulha em <Value>', () => {
    const tcx = `<?xml version="1.0"?>
<TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap><Track>
  <Trackpoint>
    <Time>2026-08-18T09:00:00Z</Time>
    <Position><LatitudeDegrees>38.7223</LatitudeDegrees><LongitudeDegrees>-9.1393</LongitudeDegrees></Position>
    <HeartRateBpm><Value>147</Value></HeartRateBpm>
  </Trackpoint>
  <Trackpoint>
    <Time>2026-08-18T09:05:00Z</Time>
    <Position><LatitudeDegrees>38.7233</LatitudeDegrees><LongitudeDegrees>-9.1393</LongitudeDegrees></Position>
    <HeartRateBpm><Value>163</Value></HeartRateBpm>
  </Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

    const t = parseTcx(tcx);
    expect(t!.points.map((p) => p.heartRate)).toEqual([147, 163]);
  });

  it('ignora batimentos fora do plausível', () => {
    const gpx = `<?xml version="1.0"?>
<gpx version="1.1"><trk><trkseg>
  <trkpt lat="38.7223" lon="-9.1393"><time>2026-08-18T09:00:00Z</time>
    <extensions><gpxtpx:hr>0</gpxtpx:hr></extensions>
  </trkpt>
</trkseg></trk></gpx>`;

    expect(parseGpx(gpx)!.points[0].heartRate).toBeNull();
  });
});
