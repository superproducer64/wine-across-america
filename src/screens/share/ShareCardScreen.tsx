import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { VivinoStyleCard } from '@/components/wine/VivinoStyleCard';
import { ShareCardToMemberModal } from '@/components/wine/ShareCardToMemberModal';
import { useWineStore } from '@/stores/wineStore';
import { useAuthStore } from '@/stores/authStore';
import { MainStackParamList } from '@/navigation/types';
import { getWineEntry } from '@/lib/supabase';
import { WineEntry } from '@/types';

type Props = NativeStackScreenProps<MainStackParamList, 'ShareCard'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PREVIEW_WIDTH = Math.min(SCREEN_WIDTH - Spacing.xl * 2, 420);
const PREVIEW_HEIGHT = SCREEN_HEIGHT * 0.6;
const CAPTURE_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

export function ShareCardScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { entries } = useWineStore();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Use cached store entry immediately — avoids a network round-trip when the
  // entry is already loaded. Only fall back to fetching if the entry isn't in
  // the store (e.g. reached via search results or a deep link).
  const cached = entries.find((e) => e.id === entryId) ?? null;
  const [entry, setEntry] = useState<WineEntry | null>(cached);
  const [entryLoading, setEntryLoading] = useState(cached === null);

  useEffect(() => {
    if (cached !== null) return; // already have it, skip the fetch
    let cancelled = false;
    (async () => {
      const { data, error } = await getWineEntry(entryId);
      if (!cancelled && !error && data) {
        setEntry(data as WineEntry);
      }
      if (!cancelled) setEntryLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  const cardRef = useRef<View>(null);
  const [cardUri, setCardUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(true);
  const [captureError, setCaptureError] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [externalError, setExternalError] = useState('');

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setCapturing(true);
    setCaptureError('');

    (async () => {
      // The card's label photo (if any) is typically already cached from
      // being rendered elsewhere on the wine detail page, so this is just a
      // settle margin for the off-screen copy, not a cold load.
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (cancelled) return;
      try {
        const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (!cancelled) setCardUri(uri);
      } catch {
        if (!cancelled) setCaptureError('Could not generate the card image.');
      } finally {
        if (!cancelled) setCapturing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entry]);

  const handleShareExternally = async () => {
    if (!cardUri) return;
    setExternalError('');
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setExternalError('Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(cardUri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch (err) {
      // expo-sharing throws for both user-cancellation and genuine failures,
      // and there's no reliable cross-platform way to tell them apart — but a
      // real failure must not be completely silent, so surface it.
      console.warn('Share externally failed:', err);
      setExternalError('Could not share the card. Please try again.');
    }
  };

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          {entryLoading ? (
            <>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.capturingText}>Loading wine…</Text>
            </>
          ) : (
            <>
              <Text style={styles.errorText}>Wine not found.</Text>
              <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
                <Text style={styles.backLinkText}>Go Back</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Share Card</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.previewArea}>
        <View style={[styles.previewFrame, { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }]}>
          {cardUri ? (
            <Image source={{ uri: cardUri }} style={styles.previewImage} resizeMode="contain" />
          ) : (
            <View style={styles.previewPlaceholder}>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.capturingText}>Preparing your card…</Text>
            </View>
          )}
        </View>
        {captureError ? <Text style={styles.errorText}>{captureError}</Text> : null}
      </View>

      {/* Off-screen instance used only as the capture target — same card style used for "Share on Social". */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={cardRef} collapsable={false} style={{ width: CAPTURE_WIDTH }}>
          <VivinoStyleCard key={entry.id} entry={entry} />
        </View>
      </View>

      {externalError ? <Text style={styles.errorText}>{externalError}</Text> : null}

      <View style={[styles.actions, { paddingBottom: Spacing.xl + insets.bottom }]}>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary, (!cardUri || capturing) && styles.actionBtnDisabled]}
          onPress={() => setShowMemberModal(true)}
          disabled={!cardUri || capturing}
        >
          <Text style={styles.actionBtnPrimaryText}>Send to PAA member</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, (!cardUri || capturing) && styles.actionBtnDisabled]}
          onPress={handleShareExternally}
          disabled={!cardUri || capturing}
        >
          <Text style={styles.actionBtnText}>Share externally</Text>
        </Pressable>
      </View>

      {cardUri && user && (
        <ShareCardToMemberModal
          visible={showMemberModal}
          onClose={() => setShowMemberModal(false)}
          entry={entry}
          senderId={user.id}
          cardImageUri={cardUri}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  navBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 56 },
  navBtnText: { fontFamily: Fonts.dmSansRegular, fontSize: 16, color: Colors.gold },
  navTitle: { fontFamily: Fonts.playfair, fontSize: 16, color: Colors.ink },
  previewArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  previewFrame: {
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  capturingText: { fontFamily: Fonts.dmSans, fontSize: 13, color: Colors.inkMuted },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -100000,
  },
  errorText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  backLink: { padding: Spacing.md },
  backLinkText: { fontFamily: Fonts.dmSansMedium, fontSize: 14, color: Colors.gold },
  actions: {
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { fontFamily: Fonts.dmSansMedium, fontSize: 14, color: Colors.gold, letterSpacing: 0.3 },
  actionBtnPrimaryText: { fontFamily: Fonts.dmSansMedium, fontSize: 14, color: Colors.gold, letterSpacing: 0.3 },
});
