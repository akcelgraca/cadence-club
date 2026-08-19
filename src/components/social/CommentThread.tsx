import { useState, useMemo } from 'react';
import { useColors } from '../../hooks/useColors';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getComments, addComment } from '../../services/social';
import { Avatar } from '../common/Avatar';
import { formatRelativeTime } from '../../utils/dateHelpers';
import { typography, type Colors } from '../../lib/theme';
import type { Comment } from '../../lib/types';
import { useTranslation } from 'react-i18next';

interface CommentThreadProps {
  activityId: string;
}

export function CommentThread({ activityId }: CommentThreadProps) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useTranslation();
  const [newComment, setNewComment] = useState('');
  const [isSending, setIsSending] = useState(false);
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['comments', activityId],
    queryFn: ({ pageParam = 0 }) => getComments(activityId, pageParam),
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage || lastPage.length === 0) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
  });

  const comments = data?.pages.flat() ?? [];

  const handleSend = async () => {
    if (!newComment.trim() || isSending) return;
    setIsSending(true);
    try {
      await addComment(activityId, newComment.trim());
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['comments', activityId] });
    } catch {
      // ignore
    } finally {
      setIsSending(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Avatar
        uri={item.profile?.avatar_url}
        name={item.profile?.full_name}
        size={32}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUser}>{item.profile?.username ?? 'user'}</Text>
          <Text style={styles.commentTime}>{formatRelativeTime(item.created_at)}</Text>
        </View>
        <Text style={styles.commentBody}>{item.body}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('comments_title')}</Text>

      {isLoading ? (
        <ActivityIndicator style={{ padding: 20 }} />
      ) : isError ? (
        <Text style={styles.errorText}>{t('comments_load_error')}</Text>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          onEndReached={() => hasNextPage && fetchNextPage()}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('comments_be_first')}</Text>
          }
          scrollEnabled={false}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('comment_placeholder')}
          placeholderTextColor={c.mutedForeground}
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newComment.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newComment.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>{t('send')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { marginTop: 20 },
  title: { ...typography.headline, fontSize: 18, marginBottom: 12, color: c.foreground },
  errorText: { ...typography.body, color: c.destructive, textAlign: 'center', padding: 20 },
  emptyText: { ...typography.body, color: c.mutedForeground, textAlign: 'center', padding: 20 },
  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
  commentUser: { ...typography.bodyBold, fontSize: 14, color: c.foreground },
  commentTime: { ...typography.body, fontSize: 12, color: c.mutedForeground },
  commentBody: { ...typography.body, fontSize: 14, color: c.foreground, lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: c.border },
  input: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: c.inputBackground,
    color: c.foreground,
    ...typography.body,
  },
  sendButton: {
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { ...typography.bodyBold, color: c.primaryForeground, fontSize: 14 },
});
