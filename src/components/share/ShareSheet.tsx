import React, { useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import ShareActivityCard, { ShareCardData } from "./ShareActivityCard";
import { useShareActivity } from "./useShareActivity";
import { useTranslation } from 'react-i18next';
import { track } from '../../lib/analytics';

// Bottom sheet aberta pelo botão "partilhar" de um post.
// Mostra a pré-visualização do sticker sobre cinza escuro (para se perceber a transparência).

const NEON = "#C8F31D";

interface Props {
  visible: boolean;
  onClose: () => void;
  data: ShareCardData;
}

export default function ShareSheet({ visible, onClose, data }: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<View>(null);
  const { busy, shareToInstagramStories, shareGeneric, saveToGallery } =
    useShareActivity(cardRef);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('share_close')} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('share_activity')}</Text>

          {/* Preview — escala 62% para caber no ecrã */}
          <View style={styles.preview}>
            <ShareActivityCard ref={cardRef} data={data} />
          </View>

          <View style={styles.actions}>
            <Action
              icon="instagram"
              label={t('share_stories')}
              onPress={() => { track('activity_shared', { destination: 'instagram_stories' }); shareToInstagramStories(); }}
              disabled={busy}
              accent
            />
            <Action
              icon="share-2"
              label={t('share_system')}
              onPress={() => { track('activity_shared', { destination: 'system' }); shareGeneric(); }}
              disabled={busy}
            />
            <Action
              icon="download"
              label={t('save')}
              onPress={async () => {
                track('activity_shared', { destination: 'gallery' });
                const ok = await saveToGallery();
                if (ok) Alert.alert(t("share_saved_to_gallery"));
              }}
              disabled={busy}
            />
          </View>

          {busy && <ActivityIndicator style={{ marginTop: 8 }} color={NEON} />}
        </View>
      </View>
    </Modal>
  );
}

function Action({
  icon,
  label,
  onPress,
  disabled,
  accent,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionCircle, accent && styles.actionAccent]}>
        <Feather name={icon} size={22} color={accent ? "#111111" : "#FFFFFF"} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginTop: 10,
  },
  title: {
    fontFamily: "Barlow_600SemiBold",
    fontSize: 17,
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 4,
  },
  preview: {
    borderRadius: 16,
    backgroundColor: "#3A3A3C",
    transform: [{ scale: 0.62 }],
    marginVertical: -80,
    overflow: "hidden",
  },
  actions: {
    flexDirection: "row",
    gap: 36,
    marginTop: 16,
  },
  action: { alignItems: "center", gap: 6 },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionAccent: { backgroundColor: NEON },
  actionLabel: {
    fontFamily: "Barlow_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
});
