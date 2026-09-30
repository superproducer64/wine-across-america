import React, { useRef, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { Colors, Fonts, Radius, Spacing, Shadows } from '@/theme';
import { WineEntry } from '@/types';
import { VivinoStyleCard } from '@/components/wine/VivinoStyleCard';
import { shareToInstagramStoriesOrFallback } from '@/utils/instagramShare';

interface Props {
  visible: boolean;
  onClose: () => void;
  entry: WineEntry;
  onShareText: () => void;
  onShareWithMember: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAPTURE_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

export function ShareSheet({ visible, onClose, entry, onShareText, onShareWithMember }: Props) {
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const [sharingSocial, setSharingSocial] = useState(false);
  const [socialError, setSocialError] = useState('');

  const handleShareText = () => {
    onClose();
    onShareText();
  };

  const handleShareWithMember = () => {
    onClose();
    onShareWithMember();
  };

  const handleShareOnSocial = async () => {
    setSocialError('');
    setSharingSocial(true);
    try {
      // The card is already rendered on-screen elsewhere on this page, so its
      // label photo (if any) is typically already cached — this settle delay
      // is just a safety margin for the off-screen copy, not a cold load.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const shared = await shareToInstagramStoriesOrFallback(uri);
      setSharingSocial(false);
      if (shared) {
        onClose();
      } else {
        setSocialError('Sharing is not available on this device.');
      }
    } catch (err) {
      console.warn('Share on Social failed:', err);
      setSharingSocial(false);
      setSocialError('Could not share the card. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={sharingSocial ? undefined : onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Spacing.xxl + insets.bottom }]}
          onPress={() => {}}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Share This Wine</Text>

          <Pressable style={styles.option} onPress={handleShareText} disabled={sharingSocial}>
            <Text style={styles.optionIcon}>⬆</Text>
            <Text style={styles.optionText}>Text / Email</Text>
          </Pressable>

          <Pressable style={styles.option} onPress={handleShareWithMember} disabled={sharingSocial}>
            <Text style={styles.optionIcon}>🍷</Text>
            <Text style={styles.optionText}>Share with App Member</Text>
          </Pressable>

          <Pressable style={styles.option} onPress={handleShareOnSocial} disabled={sharingSocial}>
            {sharingSocial ? (
              <ActivityIndicator size="small" color={Colors.gold} style={styles.optionIcon} />
            ) : (
              <Text style={styles.optionIcon}>📷</Text>
            )}
            <Text style={styles.optionText}>Share on Social</Text>
          </Pressable>

          {socialError ? <Text style={styles.errorText}>{socialError}</Text> : null}

          <Pressable style={styles.cancelBtn} onPress={onClose} disabled={sharingSocial}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>

      {/* Off-screen capture target — the original wine card, unmodified. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={cardRef} collapsable={false} style={{ width: CAPTURE_WIDTH }}>
          <VivinoStyleCard entry={entry} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 10, 12, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 18,
    color: Colors.ink,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  optionIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  optionText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 15,
    color: Colors.ink,
  },
  errorText: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.red,
    textAlign: 'center',
  },
  cancelBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  cancelBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 15,
    color: Colors.inkMuted,
  },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -100000,
  },
});
