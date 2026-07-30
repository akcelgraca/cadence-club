import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getComments, addComment } from '../../services/social';
import { Avatar } from '../common/Avatar';
import { formatRelativeTime } from '../../utils/dateHelpers';
import { colors, typography } from '../../lib/theme';
import type { Comment } from '../../lib/types';

interface CommentThreadProps {
  activityId: string;
}

export function CommentThread({ activityId }: CommentThreadProps) {
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
      <Text style={styles.title}>Comentarios</Text>

      {isLoading ? (
        <ActivityIndicator style={{ padding: 20 }} />
      ) : isError ? (
        <Text style={styles.errorText}>Erro ao carregar comentarios.</Text>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          onEndReached={() => hasNextPage && fetchNextPage()}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Se o primeiro a comentar!</Text>
          }
          scrollEnabled={false}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escreve um comentario..."
          placeholderTextColor={colors.mutedForeground}
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newComment.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newComment.trim() || isSending}
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20 },
  title: { ...typography.headline, fontSize: 18, marginBottom: 12, color: colors.foreground },
  errorText: { ...typography.body, color: colors.destructive, textAlign: 'center', padding: 20 },
  emptyText: { ...typography.body, color: colors.mutedForeground, textAlign: 'center', padding: 20 },
  commentItem: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 },
  commentUser: { ...typography.bodyBold, fontSize: 14, color: colors.foreground },
  commentTime: { ...typography.body, fontSize: 12, color: colors.mutedForeground },
  commentBody: { ...typography.body, fontSize: 14, color: colors.foreground, lineHeight: 20 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: colors.border },
  input: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    maxHeight: 80,
    backgroundColor: colors.inputBackground,
    color: colors.foreground,
    ...typography.body,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { ...typography.bodyBold, color: colors.primaryForeground, fontSize: 14 },
});
