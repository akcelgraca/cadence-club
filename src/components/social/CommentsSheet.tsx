import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime } from '../../utils/dateHelpers';
import { getComments, addComment, deleteComment } from '../../services/social';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../common/Avatar';
import { colors, typography, withAlpha } from '../../lib/theme';
import type { Comment } from '../../lib/types';
import { useTranslation } from 'react-i18next';

interface CommentsSheetProps {
  activityId: string;
  visible: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export function CommentsSheet({ activityId, visible, onClose, onCountChange }: CommentsSheetProps) {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      loadComments();
    } else {
      setComments([]);
      setText('');
    }
  }, [visible, activityId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const data = await getComments(activityId);
      setComments(data);
    } catch {}
    setLoading(false);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const newComment = await addComment(activityId, trimmed);
      const updated = [...comments, newComment as Comment];
      setComments(updated);
      onCountChange?.(updated.length);
      setText('');
    } catch {
      Alert.alert(t('comment_send_error'));
    }
    setSending(false);
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(t('comment_delete'), t('comment_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(commentId);
            const updated = comments.filter((c) => c.id !== commentId);
            setComments(updated);
            onCountChange?.(updated.length);
          } catch {
            Alert.alert(t('comment_delete_error'));
          }
        },
      },
    ]);
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isOwn = item.user_id === profile?.id;
    return (
      <View style={styles.commentRow}>
        <Avatar
          uri={item.profile?.avatar_url}
          name={item.profile?.full_name}
          size={34}
          radius={17}
        />
        <View style={styles.commentBubble}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentName}>{item.profile?.full_name ?? 'Atleta'}</Text>
            <Text style={styles.commentTime}>{formatRelativeTime(item.created_at)}</Text>
          </View>
          <Text style={styles.commentBody}>{item.body}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity
            onPress={() => handleDeleteComment(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('comments')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={renderComment}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Ionicons name="chatbubble-outline" size={40} color={colors.mutedForeground} />
                  <Text style={styles.emptyText}>{t('comments_empty')}</Text>
                  <Text style={styles.emptySubText}>{t('be_first_comment')}</Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Input bar */}
          <View style={styles.inputRow}>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.full_name}
              size={32}
              radius={16}
            />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={t('comment_placeholder')}
              placeholderTextColor={colors.mutedForeground}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={[
                styles.sendButton,
                (!text.trim() || sending) && styles.sendButtonDisabled,
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Ionicons name="send" size={15} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: 300,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    ...typography.bodyBold,
    fontSize: 16,
    color: colors.foreground,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.foreground,
  },
  emptySubText: {
    ...typography.body,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  listContent: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  commentName: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.foreground,
  },
  commentTime: {
    ...typography.body,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  commentBody: {
    ...typography.body,
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: withAlpha(colors.foreground, 0.06),
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
