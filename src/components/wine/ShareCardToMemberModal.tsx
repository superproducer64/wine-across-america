import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/theme';
import { uploadWineCard, sendMessage, MemberSearchResult } from '@/lib/supabase';
import { MemberPicker } from '@/components/messages/MemberPicker';
import { WineEntry } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  entry: WineEntry;
  senderId: string;
  cardImageUri: string;
}

export function ShareCardToMemberModal({ visible, onClose, entry, senderId, cardImageUri }: Props) {
  const [selected, setSelected] = useState<MemberSearchResult | null>(null);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const reset = () => {
    setSelected(null);
    setCaption('');
    setStatus('idle');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelect = (member: MemberSearchResult | null) => {
    setSelected(member);
    setStatus('idle');
  };

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    setStatus('idle');

    const { url, error: uploadError } = await uploadWineCard(senderId, entry.id, cardImageUri);
    if (uploadError || !url) {
      console.warn('uploadWineCard failed:', uploadError);
      setSending(false);
      setStatus('error');
      return;
    }

    const { error: sendError } = await sendMessage(senderId, selected.id, caption.trim(), url);

    setSending(false);

    if (sendError) {
      console.warn('sendMessage failed:', sendError);
      setStatus('error');
    } else {
      setStatus('success');
      setTimeout(() => {
        handleClose();
      }, 1800);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Send to a Member</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.winePreview}>
              <Text style={styles.winePreviewLabel}>Sharing card for</Text>
              <Text style={styles.winePreviewName}>
                {entry.name || 'Untitled Wine'}
                {entry.vintage ? ` ${entry.vintage}` : ''}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Send to</Text>
            <MemberPicker selected={selected} onSelect={handleSelect} />

            {selected && status !== 'success' && (
              <>
                <Text style={styles.inputLabel}>Add a note (optional)</Text>
                <TextInput
                  style={styles.captionInput}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Say something about this wine…"
                  placeholderTextColor={Colors.inkFaint}
                  multiline
                  maxLength={2000}
                />
              </>
            )}

            {status === 'success' && (
              <View style={[styles.feedback, styles.feedbackSuccess]}>
                <Text style={styles.feedbackText}>
                  🍷 Card sent to {selected?.display_label}!
                </Text>
              </View>
            )}
            {status === 'error' && (
              <View style={[styles.feedback, styles.feedbackError]}>
                <Text style={styles.feedbackText}>Something went wrong. Please try again.</Text>
              </View>
            )}

            {selected && status !== 'success' && (
              <Pressable
                style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={Colors.ink} size="small" />
                ) : (
                  <Text style={styles.sendBtnText}>
                    Send to {selected.display_label}
                  </Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1, backgroundColor: Colors.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  title: { fontFamily: Fonts.playfair, fontSize: 20, color: Colors.ink },
  closeBtn: { padding: Spacing.sm },
  closeBtnText: { fontFamily: Fonts.dmSansRegular, fontSize: 16, color: Colors.inkMuted },
  body: { padding: Spacing.xl, gap: Spacing.lg },
  winePreview: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: 3,
    marginBottom: Spacing.sm,
  },
  winePreviewLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.gold,
  },
  winePreviewName: { fontFamily: Fonts.playfair, fontSize: 18, color: Colors.white, lineHeight: 24 },
  inputLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.white,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  feedback: { borderRadius: Radius.md, padding: Spacing.md },
  feedbackSuccess: { backgroundColor: '#EBF7F0', borderWidth: 0.5, borderColor: Colors.green },
  feedbackError: { backgroundColor: Colors.redLight, borderWidth: 0.5, borderColor: Colors.red },
  feedbackText: { fontFamily: Fonts.dmSansRegular, fontSize: 14, color: Colors.inkMid, textAlign: 'center' },
  sendBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { fontFamily: Fonts.dmSansMedium, fontSize: 15, color: Colors.ink },
});
