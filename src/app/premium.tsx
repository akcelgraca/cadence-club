import { useEffect, useState, useMemo } from 'react';
import { useColors } from '../hooks/useColors';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { typography, withAlpha, type Colors } from '../lib/theme';
import { FREE_HISTORY_MONTHS } from '../hooks/usePremium';
import {
  getPlans, isAvailable, purchase, refreshEntitlement, restore, type Plan,
} from '../services/purchases';
import { track } from '../lib/analytics';
import { goBackOr } from '../lib/navigation';

/**
 * Paywall.
 *
 * A ideia que organiza o ecrã: o premium desta app não é "mais app", é a
 * VISTA LONGA. Tudo o que está atrás do pagamento — relevo, satélite,
 * tendências para lá de três meses, histórico de troços, galeria, exportação
 * — é sobre ver melhor o que já foi feito. Nada disto tira nada a quem não
 * paga: gravar, as zonas de privacidade e o social inteiro ficam abertos.
 *
 * Daí as duas decisões do desenho:
 *
 *  1. O gráfico no topo é um perfil de elevação — o artefacto próprio desta
 *     app — sólido no troço que o plano gratuito mostra e esbatido no resto.
 *     Mostra o que se compra em vez de o prometer.
 *
 *  2. A lista tem uma régua a meio: por cima, o que é sempre grátis; por
 *     baixo, o que o premium acrescenta. Os paywalls costumam esconder o que
 *     é grátis. Mostrá-lo é honesto e é a estratégia do produto — numa app
 *     social, quem não paga é o valor que quem paga compra.
 *
 * Os preços vêm sempre da loja, já formatados e na moeda do utilizador.
 * Escrever preços à mão dá números errados noutros países, e a Apple recusa.
 */

/** Perfil de elevação do cabeçalho. Não são dados reais — é linguagem visual. */
const PERFIL = [
  40, 38, 44, 36, 30, 34, 28, 33, 24, 26,
  18, 22, 14, 20, 12, 16, 9, 14, 6, 10, 4,
];

/** Onde o plano gratuito deixa de ver. */
const CORTE = 0.34;

function perfilPath(pontos: number[], largura: number, altura: number): string {
  const passo = largura / (pontos.length - 1);
  const max = Math.max(...pontos);
  const y = (v: number) => altura - (v / max) * altura;
  return pontos
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * passo).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
}

export default function PremiumScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [planos, setPlanos] = useState<Plan[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aComprar, setAComprar] = useState(false);

  useEffect(() => {
    track('paywall_viewed');
    getPlans()
      .then((p) => {
        setPlanos(p);
        // Pré-selecionar o primeiro evita um passo extra no caso comum.
        if (p.length > 0) setEscolhido(p[0].id);
      })
      .finally(() => setCarregando(false));
  }, []);

  const comprar = async () => {
    const plano = planos.find((p) => p.id === escolhido);
    if (!plano) return;

    setAComprar(true);
    try {
      const r = await purchase(plano);
      // Desistir não é erro e não se comenta.
      if (!r.ok && r.cancelled) return;
      if (!r.ok) {
        Alert.alert(t('premium_error_title'), r.error);
        return;
      }

      track('premium_purchased', { plan: plano.id });

      // A loja aceitou, mas o direito só existe depois de o webhook escrever.
      const ativo = await refreshEntitlement();
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });

      Alert.alert(
        t('premium_thanks_title'),
        ativo ? t('premium_thanks_body') : t('premium_pending_body'),
        [{ text: t('ok'), onPress: () => goBackOr('/(tabs)/profile') }],
      );
    } finally {
      setAComprar(false);
    }
  };

  const repor = async () => {
    setAComprar(true);
    try {
      const tinha = await restore();
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      Alert.alert(
        t('premium_restore_title'),
        tinha ? t('premium_restore_found') : t('premium_restore_none'),
      );
    } finally {
      setAComprar(false);
    }
  };

  const GRATIS = ['premium_free_record', 'premium_free_privacy',
    'premium_free_offline', 'premium_free_social'];
  const PAGO = ['premium_paid_terrain', 'premium_paid_styles',
    'premium_paid_trends', 'premium_paid_segments',
    'premium_paid_photos', 'premium_paid_export'];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => goBackOr('/(tabs)/profile')} hitSlop={12}>
          <Ionicons name="close" size={26} color={c.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── O gráfico é o argumento ─────────────────────────────────── */}
        <View style={s.grafico}>
          <Svg width="100%" height={96} viewBox="0 0 320 96" preserveAspectRatio="none">
            <Path d={perfilPath(PERFIL, 320, 96)} stroke={withAlpha(c.foreground, 0.13)}
              strokeWidth={2} fill="none" />
            <Path d={perfilPath(PERFIL.slice(0, Math.ceil(PERFIL.length * CORTE)),
              320 * CORTE, 96 * 0.72)} stroke={c.primary} strokeWidth={2.5} fill="none" />
          </Svg>
          <View style={[s.corte, { left: `${CORTE * 100}%` }]} />
          <View style={s.legenda}>
            <Text style={s.legendaMono}>
              {t('premium_chart_free', { months: FREE_HISTORY_MONTHS })}
            </Text>
            <Text style={[s.legendaMono, s.legendaFraca]}>{t('premium_chart_rest')}</Text>
          </View>
        </View>

        <Text style={s.titulo}>{t('premium_title')}</Text>
        <Text style={s.subtitulo}>{t('premium_subtitle')}</Text>

        {/* ── A régua: o que nunca se paga, e o que o premium acrescenta ─ */}
        <View style={s.lista}>
          <Text style={s.grupoLabel}>{t('premium_always_free')}</Text>
          {GRATIS.map((k) => (
            <View key={k} style={s.linha}>
              <Ionicons name="checkmark" size={16} color={c.mutedForeground} />
              <Text style={s.linhaTextoFraca}>{t(k as any)}</Text>
            </View>
          ))}

          <View style={s.regua} />

          <Text style={[s.grupoLabel, { color: c.primary }]}>
            {t('premium_adds')}
          </Text>
          {PAGO.map((k) => (
            <View key={k} style={s.linha}>
              <Ionicons name="add" size={16} color={c.primary} />
              <Text style={s.linhaTexto}>{t(k as any)}</Text>
            </View>
          ))}
        </View>

        {/* ── Planos ─────────────────────────────────────────────────── */}
        {carregando ? (
          <ActivityIndicator style={{ marginTop: 28 }} color={c.primary} />
        ) : planos.length === 0 ? (
          // Sem produtos configurados na loja não há nada a vender. Dizer
          // isto é melhor do que um botão que não faz nada.
          <Text style={s.indisponivel}>
            {isAvailable() ? t('premium_no_plans') : t('premium_not_configured')}
          </Text>
        ) : (
          <>
            {planos.map((p) => {
              const ativo = p.id === escolhido;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.plano, ativo && s.planoAtivo]}
                  onPress={() => setEscolhido(p.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.planoPeriodo, ativo && { color: c.primary }]}>
                    {t(`premium_period_${p.period.toLowerCase()}` as any, {
                      defaultValue: p.period,
                    })}
                  </Text>
                  <Text style={s.planoPreco}>{p.price}</Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[s.cta, aComprar && { opacity: 0.6 }]}
              onPress={comprar}
              disabled={aComprar || !escolhido}
              activeOpacity={0.85}
            >
              {aComprar
                ? <ActivityIndicator color={c.primaryForeground} />
                : <Text style={s.ctaTexto}>{t('premium_cta')}</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* Obrigatório pela App Store — sem isto a app é recusada em revisão. */}
        <TouchableOpacity onPress={repor} disabled={aComprar} style={s.repor}>
          <Text style={s.reporTexto}>{t('premium_restore')}</Text>
        </TouchableOpacity>

        <Text style={s.legal}>{t('premium_legal')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  topBar: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, alignItems: 'flex-end' },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },

  grafico: { marginTop: 4, marginBottom: 22 },
  corte: {
    position: 'absolute', top: 0, bottom: 0, width: 1,
    backgroundColor: withAlpha(c.foreground, 0.18),
  },
  legenda: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  legendaMono: {
    ...typography.mono, fontSize: 10, color: c.primary,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  legendaFraca: { color: withAlpha(c.foreground, 0.35) },

  titulo: {
    ...typography.statNumber, fontSize: 40, lineHeight: 42,
    color: c.foreground, textTransform: 'uppercase',
  },
  subtitulo: {
    ...typography.body, fontSize: 15, lineHeight: 21,
    color: c.mutedForeground, marginTop: 10, marginBottom: 26,
  },

  lista: { backgroundColor: c.card, borderRadius: 14, padding: 18 },
  grupoLabel: {
    ...typography.headline, fontSize: 11, letterSpacing: 1,
    color: c.mutedForeground, marginBottom: 10,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  linhaTexto: { ...typography.bodyMedium, fontSize: 14, color: c.foreground, flex: 1 },
  linhaTextoFraca: { ...typography.body, fontSize: 14, color: c.mutedForeground, flex: 1 },
  regua: { height: 1, backgroundColor: c.border, marginVertical: 16 },

  plano: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: c.card, borderRadius: 12, padding: 16, marginTop: 12,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  planoAtivo: { borderColor: c.primary },
  planoPeriodo: {
    ...typography.headline, fontSize: 13, letterSpacing: 0.6,
    color: c.mutedForeground,
  },
  planoPreco: { ...typography.mono, fontSize: 15, color: c.foreground },

  cta: {
    backgroundColor: c.primary, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginTop: 22,
  },
  ctaTexto: {
    ...typography.headline, fontSize: 15, letterSpacing: 1,
    color: c.primaryForeground,
  },

  indisponivel: {
    ...typography.body, fontSize: 13, color: c.mutedForeground,
    textAlign: 'center', marginTop: 26,
  },
  repor: { alignItems: 'center', marginTop: 18 },
  reporTexto: { ...typography.bodyMedium, fontSize: 13, color: c.mutedForeground },
  legal: {
    ...typography.body, fontSize: 11, lineHeight: 16,
    color: withAlpha(c.foreground, 0.4), textAlign: 'center', marginTop: 20,
  },
});
