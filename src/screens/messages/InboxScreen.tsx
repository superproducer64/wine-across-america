import React, { useCallback, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Fonts, Radius, Spacing } from '@/theme';
import { useResponsive, SIDEBAR_WIDTH, MAX_CONTENT_WIDTH } from '@/hooks/useResponsive';
import { fetchConversations, Conversation, MemberSearchResult } from '@/lib/supabase';
import { MemberPicker } from '@/components/messages/MemberPicker';
import { useAuthStore } from '@/stores/authStore';
import { MainStackParamList } from '@/navigation/types';

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  const [imageError, setImageError] = useState(false);
  const initials = (name ?? '?').charAt(0).toUpperCase();
  return url && !imageError ? (
    <Image source={{ uri: url }} style={styles.avatar} onError={() => setImageError(true)} />
  ) : (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function ConversationRow({
  conversation,
  currentUserId,
  onPress,
}: {
  conversation: Conversation;
  currentUserId: string;
  onPress: () => void;
}) {
  const unread = conversation.unreadCount > 0;
  const mineLast = conversation.lastMessage.sender_id === currentUserId;
  const previewText =
    conversation.lastMessage.content ||
    (conversation.lastMessage.attachment_url ? '📷 Wine card' : '');
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar name={conversation.otherDisplayName} url={conversation.otherAvatarUrl} />
      <View style={styles.rowMeta}>
        <View style={styles.rowTop}>
          <View style={styles.nameRow}>
            {unread && <View style={styles.unreadDot} />}
            <Text style={[styles.rowName, unread && styles.rowNameUnread]}>
              {conversation.otherDisplayName ?? 'Unnamed member'}
            </Text>
          </View>
          <Text style={styles.rowTime}>{formatTimestamp(conversation.lastMessage.created_at)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.rowPreview, unread && styles.rowPreviewUnread]}
            numberOfLines={2}
          >
            {mineLast ? 'You: ' : ''}
            {previewText}
          </Text>
          {unread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function InboxScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { isWide } = useResponsive();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);

  // MessageDetail loads the existing thread with this member if there is one;
  // otherwise it opens empty and the thread is created by the first send.
  const openThreadWith = (member: MemberSearchResult | null) => {
    if (!member) return;
    setComposeOpen(false);
    const existing = conversations.find((c) => c.otherUserId === member.id);
    navigation.navigate('MessageDetail', {
      otherUserId: member.id,
      otherDisplayName: existing?.otherDisplayName ?? member.display_label,
      otherAvatarUrl: existing?.otherAvatarUrl ?? member.avatar_url,
    });
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await fetchConversations(user.id);
    if (fetchError) setError(fetchError);
    else setConversations(data ?? []);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={[styles.safe, isWide && { paddingLeft: SIDEBAR_WIDTH }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' } : undefined}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>Messages</Text>
            <Pressable
              style={styles.composeBtn}
              onPress={() => setComposeOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="New message"
              hitSlop={6}
            >
              <Text style={styles.composeIcon}>✎</Text>
              <Text style={styles.composeText}>New</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading messages…</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✉️</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Conversations with other members will show up here.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {user &&
                conversations.map((c) => (
                  <ConversationRow
                    key={c.otherUserId}
                    conversation={c}
                    currentUserId={user.id}
                    onPress={() =>
                      navigation.navigate('MessageDetail', {
                        otherUserId: c.otherUserId,
                        otherDisplayName: c.otherDisplayName,
                        otherAvatarUrl: c.otherAvatarUrl,
                      })
                    }
                  />
                ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={composeOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setComposeOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>New Message</Text>
            <Pressable onPress={() => setComposeOpen(false)} hitSlop={10}>
              <Text style={styles.sheetClose}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <MemberPicker selected={null} onSelect={openThreadWith} autoFocus />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  backBtn: { paddingVertical: Spacing.xs },
  backText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.gold,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Fonts.playfair,
    fontSize: 28,
    color: Colors.ink,
    marginBottom: 4,
  },
  composeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  composeIcon: { fontSize: 14, color: Colors.ink },
  composeText: { fontFamily: Fonts.dmSansMedium, fontSize: 13, color: Colors.ink },
  sheet: { flex: 1, backgroundColor: Colors.surface },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  sheetTitle: { fontFamily: Fonts.playfair, fontSize: 20, color: Colors.ink },
  sheetClose: { fontFamily: Fonts.dmSansRegular, fontSize: 15, color: Colors.gold },
  sheetBody: { padding: Spacing.xl },
  errorBanner: {
    backgroundColor: 'rgba(139,46,46,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.red,
  },
  errorText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.red,
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: Spacing.huge,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 20,
    color: Colors.ink,
  },
  emptyText: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  list: { gap: Spacing.md },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.playfair,
    fontSize: 18,
    color: Colors.ink,
  },
  rowMeta: { flex: 1, gap: 3 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  rowName: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
  },
  rowNameUnread: {
    fontFamily: Fonts.dmSansMedium,
  },
  rowTime: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rowPreview: {
    flex: 1,
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    lineHeight: 18,
  },
  rowPreviewUnread: {
    color: Colors.inkMid,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.ink,
  },
});
