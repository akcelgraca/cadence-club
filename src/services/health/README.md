# Sincronização com a Saúde

Importa treinos do **Apple Saúde** (iOS) e do **Health Connect** (Android).

## Estado

| Parte | Ficheiro | Verificado |
|---|---|---|
| Deduplicação e mapeamento | `dedup.ts`, `mapping.ts` | ✅ 22 testes |
| Nomes de campos e API | `adapters.ts` | ✅ contra as tipagens instaladas |
| Orquestração e escrita | `sync.ts` | ⚠️ tipos apenas |
| **Comportamento em dispositivo** | tudo | ❌ **por verificar** |
| Base de dados | `../../../../supabase/migrations/043_health_sync.sql` | ⚠️ por aplicar |

As bibliotecas estão instaladas e os plugins configurados. Os nomes de campos e
as assinaturas foram verificados contra as tipagens reais — foi assim que se
apanhou que **as duas plataformas identificam a modalidade por número**, não
por nome (a primeira versão mapeava só nomes e não teria acertado num único
treino).

O que continua por verificar é o comportamento com dados reais: permissões,
formato dos registos, e o que acontece quando o utilizador recusa.

## Pré-requisitos

**Exige dev build.** Ambas as bibliotecas têm código nativo e não funcionam em
Expo Go. Os adaptadores carregam os módulos com `require()` dentro de `try`,
por isso o projeto compila e corre sem eles — `isAvailable()` devolve `false` e
a linha nas Definições nem aparece.

```bash
npx expo prebuild --clean
npx expo run:ios      # ou run:android
```

- **iOS:** o plugin trata do entitlement do HealthKit, mas este também tem de
  estar ligado no App ID, no portal da Apple.
- **Android:** `minSdkVersion` 26 ou superior. O plugin acrescenta a activity
  com o intent-filter `ACTION_SHOW_PERMISSIONS_RATIONALE`; as permissões
  `android.permission.health.READ_*` estão no `app.json`.

## Onde carregar

**Definições → Rastreamento e dispositivos → Sincronizar treinos.** A linha só
aparece onde a plataforma o suporta.

## Testar no dispositivo

Nenhum destes casos é coberto por testes automáticos. Todos já partiram
integrações de saúde noutras apps:

1. **Primeira ligação.** Conceder permissão → importa os últimos 30 dias.
2. **Recusar a permissão.** `isConnected` tem de ficar `false`. Era exatamente
   isto que o stub antigo fazia mal: dizia "ligado" sem ter perguntado.
3. **Sincronizar duas vezes seguidas.** A segunda tem de importar **zero**.
4. **Gravar na app com o relógio a gravar também.** Só deve aparecer **uma**
   atividade. É o caso que o id externo não apanha — depende da sobreposição
   temporal.
5. **Treino sem distância** (ioga, musculação). Entra com `distance: 0` e
   `avg_pace` nulo, sem dividir por zero.
6. **Modalidade não suportada** (tiro com arco). Ignorada em silêncio, não
   forçada a "workout".
7. **Reinstalar a app.** O estado vive no servidor; não deve reimportar tudo.
8. **iOS: negar só os treinos e permitir o resto.** A Apple não diz o que foi
   negado na leitura — `hasPermissions()` tenta ler e infere. Confirmar que
   este caso não fica preso em "ligado" sem dados.
9. **Android sem o Health Connect instalado.** `isAvailable()` deve dar
   `false` e a interface não deve oferecer o botão.

## Decisões

**Importado entra privado.** `is_public: false` — ninguém escolheu partilhar
um treino que a app foi buscar sozinha.

**Sem traçado.** O GPS fica no relógio; `route_summary` é nulo. Consequência
útil: não há rasto para as zonas de privacidade cortarem.

**Modalidade desconhecida é descartada, não convertida.** Forçar tudo a
"workout" estragaria as estatísticas e o cálculo de calorias, que depende da
modalidade (ver `utils/calculateCalories.ts`).

**Margem de 12 horas para trás** a cada sincronização. Os relógios entregam
treinos fora de ordem, e um treino gravado offline pode chegar à Saúde horas
depois. Sem a margem, nunca mais seria visto.

**A restrição única na base de dados é a última defesa.** Se duas
sincronizações correrem ao mesmo tempo, uma falha no `insert` e isso está
certo — o `sync.ts` ignora esse erro em vez de o tratar como falha.

## Ainda por fazer

- **Frequência cardíaca.** O `ExternalWorkout` já a transporta, mas não há
  coluna em `activities` para a guardar. É o ponto 2 da análise original e
  vem quase de graça a partir daqui.
- **Distância no Health Connect.** Vive num registo separado do
  `ExerciseSession`; hoje fica a zero. Precisa de uma segunda leitura.
- **Escrever na Saúde.** A app ainda não devolve os treinos que grava. Quando
  o fizer, o filtro `recordedByUs` em `dedup.ts` é o que evita reimportá-los.
