import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
  TextInput,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LABEL_PHOTO_PLACEHOLDER, computeLabelPhotoPlaceholder } from '@/utils/imagePlaceholder';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { useResponsive, MAX_CONTENT_WIDTH } from '@/hooks/useResponsive';
import { VivinoStyleCard } from '@/components/wine/VivinoStyleCard';
import { ProWineCard } from '@/components/wine/ProWineCard';
import { TechnicalScoreDisplay } from '@/components/wine/TechnicalScoreDisplay';
import { Button } from '@/components/ui/Button';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { getWineEntry, uploadLabelPhoto } from '@/lib/supabase';
import { useWineStore } from '@/stores/wineStore';
import { useAuthStore } from '@/stores/authStore';
import { useEntryDraftStore } from '@/stores/entryDraftStore';
import { ShareSheet } from '@/components/wine/ShareSheet';
import { LabelPhotoModal, LabelPhoto } from '@/components/wine/LabelPhotoModal';
import { CurrencyPicker } from '@/components/ui/CurrencyPicker';
import { getCurrencySymbol } from '@/utils/currency';
import { WineEntry, PriceEntry } from '@/types';
import { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'WineDetail'>;

function buildShareText(entry: WineEntry): string {
  const lines: string[] = [];

  const vintage = entry.vintage ? ` ${entry.vintage}` : '';
  lines.push(`🍷 ${entry.name || 'Untitled Wine'}${vintage}`);

  if (entry.producer) lines.push(entry.producer);

  const origin = [entry.appellation, entry.subregion, entry.region, entry.country]
    .filter(Boolean)
    .join(', ');
  if (origin) lines.push(origin);

  lines.push('');

  if (entry.technical_score) {
    lines.push(`Technical Score: ${entry.technical_score}/100`);
  }

  if (entry.aromas_l1.length > 0) {
    lines.push(`Aromas: ${entry.aromas_l1.join(', ')}`);
  }

  if (entry.custom_aromas?.length > 0) {
    lines.push(`Notes: ${entry.custom_aromas.join(', ')}`);
  }

  if (entry.grapes.length > 0) {
    lines.push(`Grapes: ${entry.grapes.join(', ')}`);
  }

  if (entry.free_notes) {
    lines.push('');
    lines.push(`"${entry.free_notes}"`);
  }

  lines.push('');

  if (entry.location_name) {
    lines.push(`📍 ${entry.location_name}`);
  }

  lines.push(
    `🗓 ${new Date(entry.tasting_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}`
  );

  if (entry.want_another_glass) lines.push('🥂 Would have another glass');
  if (entry.want_to_buy) lines.push('🛒 Would buy a bottle');

  lines.push('');
  lines.push('Logged with Pour Across America');

  return lines.join('\n');
}

const TODAY = new Date().toISOString().slice(0, 10);

export function WineDetailScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { entries, removeEntry, updateEntry } = useWineStore();
  const { isWide } = useResponsive();
  const { user } = useAuthStore();
  const { loadForEdit } = useEntryDraftStore();
  const insets = useSafeAreaInsets();

  // Use cached store entry immediately — avoids a network round-trip on every open.
  // Only fall back to fetching if the entry isn't in the store (e.g. deep link).
  const cached = entries.find((e) => e.id === entryId) ?? null;
  const [entry, setEntry] = useState<WineEntry | null>(cached);
  const [loading, setLoading] = useState(cached === null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  // ── Log another visit ──────────────────────────────────────────────────────
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [visitDate, setVisitDate] = useState(TODAY);
  const [visitLocation, setVisitLocation] = useState('');
  const [visitAmount, setVisitAmount] = useState('');
  const [visitCurrency, setVisitCurrency] = useState('USD');
  const [visitType, setVisitType] = useState<'glass' | 'bottle'>('bottle');
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitBanner, setVisitBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSaveVisit = async () => {
    if (!entry) return;
    const amount = parseFloat(visitAmount);
    if (!visitAmount || isNaN(amount) || amount <= 0) {
      setVisitBanner({ type: 'error', msg: 'Please enter a valid price.' });
      return;
    }
    setSavingVisit(true);
    setVisitBanner(null);
    const newPrice: PriceEntry = {
      amount,
      currency: visitCurrency.trim() || 'USD',
      date: visitDate,
      location: visitLocation.trim(),
      type: visitType,
    };
    const updatedPrices = [...(entry.price ?? []), newPrice];
    await updateEntry(entryId, { price: updatedPrices });
    const updated = { ...entry, price: updatedPrices };
    setEntry(updated);
    setVisitBanner({ type: 'success', msg: 'Visit saved!' });
    setVisitAmount('');
    setVisitLocation('');
    setVisitDate(TODAY);
    setVisitType('bottle');
    setVisitCurrency('USD');
    setSavingVisit(false);
    setTimeout(() => { setShowVisitForm(false); setVisitBanner(null); }, 1500);
  };

  // ── Editable notes ─────────────────────────────────────────────────────────
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesBanner, setNotesBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [photoModal, setPhotoModal] = useState(false);
  const [replacingPhoto, setReplacingPhoto] = useState(false);
  const [photoBanner, setPhotoBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleEditNotes = () => {
    setNotesText(entry?.free_notes ?? '');
    setNotesBanner(null);
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!entry) return;
    setSavingNotes(true);
    setNotesBanner(null);
    await updateEntry(entryId, { free_notes: notesText.trim() });
    const updated = { ...entry, free_notes: notesText.trim() };
    setEntry(updated);
    setNotesBanner({ type: 'success', msg: 'Notes saved!' });
    setSavingNotes(false);
    setTimeout(() => { setEditingNotes(false); setNotesBanner(null); }, 1200);
  };

  const handleReplacePhoto = async () => {
    if (!entry || !user) return;
    setPhotoBanner(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPhotoBanner({ type: 'error', msg: 'Photo library permission denied.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const localUri = result.assets[0].uri;
    setReplacingPhoto(true);
    try {
      const [uploadResult, blurhash] = await Promise.all([
        uploadLabelPhoto(user.id, localUri),
        computeLabelPhotoPlaceholder(localUri),
      ]);
      if (uploadResult.error || !uploadResult.url) {
        setPhotoBanner({ type: 'error', msg: uploadResult.error ?? 'Upload failed.' });
        return;
      }
      await updateEntry(entryId, {
        label_photo_url: uploadResult.url,
        label_photo_blurhash: blurhash ?? null,
      });
      setEntry({ ...entry, label_photo_url: uploadResult.url, label_photo_blurhash: blurhash ?? null });
      setPhotoBanner({ type: 'success', msg: 'Photo updated!' });
      setTimeout(() => setPhotoBanner(null), 2500);
    } catch {
      setPhotoBanner({ type: 'error', msg: 'Failed to replace photo.' });
    } finally {
      setReplacingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!entry) return;
    setReplacingPhoto(true);
    setPhotoBanner(null);
    try {
      await updateEntry(entryId, { label_photo_url: null, label_photo_blurhash: null });
      setEntry({ ...entry, label_photo_url: null as unknown as string, label_photo_blurhash: null });
      setPhotoBanner({ type: 'success', msg: 'Photo removed.' });
      setTimeout(() => setPhotoBanner(null), 2500);
    } catch {
      setPhotoBanner({ type: 'error', msg: 'Failed to remove photo.' });
    } finally {
      setReplacingPhoto(false);
    }
  };

  useEffect(() => {
    if (cached !== null) return; // already have it, skip the fetch
    (async () => {
      const { data, error } = await getWineEntry(entryId);
      if (!error && data) {
        setEntry(data as WineEntry);
      }
      setLoading(false);
    })();
  }, [entryId]);

  const handleDelete = async () => {
    setDeleting(true);
    await removeEntry(entryId);
    navigation.goBack();
  };

  const handleEditEntry = () => {
    if (!entry) return;
    loadForEdit(entry, entry.id);
    navigation.navigate('Tabs', { screen: 'AddEntry' });
  };

  const handleShare = async () => {
    if (!entry) return;
    const text = buildShareText(entry);
    const title = `${entry.name || 'Wine'}${entry.vintage ? ` ${entry.vintage}` : ''}`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title, text });
        } catch {
          // user cancelled — do nothing
        }
      } else {
        try {
          await navigator.clipboard.writeText(text);
          setShareToast('Copied to clipboard!');
          setTimeout(() => setShareToast(''), 3000);
        } catch {
          setShareToast('Could not copy — please copy manually.');
          setTimeout(() => setShareToast(''), 3000);
        }
      }
    } else {
      try {
        await Share.share({ message: text, title });
      } catch {
        // user cancelled — do nothing
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Wine not found.</Text>
          <Button label="Go Back" onPress={() => navigation.goBack()} variant="secondary" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav Bar */}
      <View style={styles.navbar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹ Back</Text>
        </Pressable>

        <View style={styles.navRight}>
          {/* Edit button */}
          {!confirmDelete && (
            <Pressable onPress={handleEditEntry} style={styles.navBtn}>
              <Text style={styles.navBtnText}>Edit</Text>
            </Pressable>
          )}

          {/* Delete flow */}
          {confirmDelete ? (
            <View style={styles.deleteConfirmRow}>
              <Pressable onPress={() => setConfirmDelete(false)} style={styles.navBtn}>
                <Text style={styles.navBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleDelete} disabled={deleting} style={styles.navBtn}>
                <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Confirm Delete'}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)} style={styles.navBtn}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Clipboard toast (web fallback) */}
      {shareToast !== '' && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{shareToast}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, isWide && { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Date & location meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {new Date(entry.tasting_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {entry.location_name ? (
            <Pressable
              onPress={() => {
                if (entry.location_geo) {
                  const { lat, lng } = entry.location_geo;
                  const url = Platform.OS === 'ios'
                    ? `maps://?ll=${lat},${lng}&q=${encodeURIComponent(entry.location_name)}`
                    : `https://maps.google.com/?q=${lat},${lng}`;
                  Linking.openURL(url).catch(() => {});
                }
              }}
              disabled={!entry.location_geo}
            >
              <View style={styles.locationMetaRow}>
                <Text style={styles.metaText}>📍 {entry.location_name}</Text>
                {entry.location_geo ? (
                  <Text style={styles.locationGeoTag}>Map ↗</Text>
                ) : null}
              </View>
              {entry.location_geo ? (
                <Text style={styles.locationCoords}>
                  {entry.location_geo.lat.toFixed(5)}, {entry.location_geo.lng.toFixed(5)}
                </Text>
              ) : null}
            </Pressable>
          ) : null}
        </View>

        {/* Free-form notes */}
        <View style={styles.notesBlock}>
          <View style={styles.notesHeader}>
            <Text style={styles.notesLabel}>Tasting Notes</Text>
            {!editingNotes && (
              <Pressable onPress={handleEditNotes} hitSlop={8}>
                <Text style={styles.editLink}>{entry.free_notes ? 'Edit' : '+ Add notes'}</Text>
              </Pressable>
            )}
          </View>
          {notesBanner && (
            <Text style={notesBanner.type === 'success' ? styles.successBanner : styles.errorBanner}>
              {notesBanner.msg}
            </Text>
          )}
          {editingNotes ? (
            <View style={styles.notesEditWrap}>
              <TextInput
                style={styles.notesInput}
                value={notesText}
                onChangeText={setNotesText}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholder="Your tasting notes…"
                placeholderTextColor={Colors.inkFaint}
                autoFocus
              />
              <View style={styles.notesEditBtns}>
                <Pressable onPress={() => { setEditingNotes(false); setNotesBanner(null); }} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleSaveNotes} disabled={savingNotes} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>{savingNotes ? 'Saving…' : 'Save Notes'}</Text>
                </Pressable>
              </View>
            </View>
          ) : entry.free_notes ? (
            <Text style={styles.notesText}>{entry.free_notes}</Text>
          ) : (
            <Text style={styles.notesEmpty}>No tasting notes yet.</Text>
          )}
        </View>

        {/* Intelligence Card — radar chart layout */}
        <ProWineCard entry={entry} />

        {/* Technical Score Breakdown */}
        {(entry.technical_score ?? 0) > 0 && (
          <TechnicalScoreDisplay entry={entry} />
        )}

        {/* Original Wine Card */}
        <VivinoStyleCard entry={entry} />

        {/* Custom Aroma Tags */}
        {((entry.custom_aromas?.length ?? 0) > 0 || entry.aromas_other_note) && (
          <View style={styles.customAromasBlock}>
            <Text style={styles.customAromasHeading}>Personal Flavor Notes</Text>
            {(entry.custom_aromas?.length ?? 0) > 0 && (
              <View style={styles.customAromasChips}>
                {(entry.custom_aromas ?? []).map((tag) => (
                  <View key={tag} style={styles.customAromasChip}>
                    <Text style={styles.customAromasChipText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            {entry.aromas_other_note ? (
              <Text style={styles.aromasOtherNote}>{entry.aromas_other_note}</Text>
            ) : null}
          </View>
        )}

        {/* Price history + Log Another Visit */}
        <View style={styles.priceBlock}>
          <View style={styles.priceHeader}>
            <Text style={styles.priceLabel}>Price History</Text>
            <Pressable onPress={() => { setShowVisitForm((v) => !v); setVisitBanner(null); }} hitSlop={8}>
              <Text style={styles.editLink}>{showVisitForm ? 'Cancel' : '+ Log a visit'}</Text>
            </Pressable>
          </View>

          {(entry.price ?? []).length > 0 ? (entry.price ?? []).map((p, i) => (
            <View key={i} style={styles.priceRow}>
              <View style={styles.priceRowLeft}>
                <Text style={styles.priceType}>
                  {p.type === 'glass' ? '🥂 Per glass' : p.type === 'bottle' ? '🍾 Per bottle' : 'Price'}
                </Text>
                {p.location ? <Text style={styles.priceLocation}>📍 {p.location}</Text> : null}
                {p.date ? <Text style={styles.priceDate}>{new Date(p.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text> : null}
              </View>
              <Text style={styles.priceValue}>{getCurrencySymbol(p.currency)}{p.amount.toFixed(2)}</Text>
            </View>
          )) : (
            <Text style={styles.notesEmpty}>No price logged yet.</Text>
          )}

          {showVisitForm && (
            <View style={styles.visitForm}>
              <Text style={styles.visitFormTitle}>Log Another Visit</Text>

              {visitBanner && (
                <Text style={visitBanner.type === 'success' ? styles.successBanner : styles.errorBanner}>
                  {visitBanner.msg}
                </Text>
              )}

              {/* Date */}
              <DatePickerInput
                label="Date"
                value={visitDate}
                onChange={setVisitDate}
              />

              {/* Location */}
              <View style={styles.visitFieldWrap}>
                <Text style={styles.visitFieldLabel}>Location</Text>
                <TextInput
                  style={styles.visitTextInput}
                  value={visitLocation}
                  onChangeText={setVisitLocation}
                  placeholder="Restaurant, shop, etc."
                  placeholderTextColor={Colors.inkFaint}
                />
              </View>

              {/* Glass / Bottle toggle */}
              <View style={styles.visitFieldWrap}>
                <Text style={styles.visitFieldLabel}>Type</Text>
                <View style={styles.typeToggle}>
                  <Pressable
                    style={[styles.typeBtn, visitType === 'glass' && styles.typeBtnActive]}
                    onPress={() => setVisitType('glass')}
                  >
                    <Text style={[styles.typeBtnText, visitType === 'glass' && styles.typeBtnTextActive]}>🥂 Glass</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.typeBtn, visitType === 'bottle' && styles.typeBtnActive]}
                    onPress={() => setVisitType('bottle')}
                  >
                    <Text style={[styles.typeBtnText, visitType === 'bottle' && styles.typeBtnTextActive]}>🍾 Bottle</Text>
                  </Pressable>
                </View>
              </View>

              {/* Price + Currency */}
              <View style={styles.visitFieldWrap}>
                <Text style={styles.visitFieldLabel}>Price</Text>
                <View style={styles.priceInputRow}>
                  <CurrencyPicker
                    label=""
                    value={visitCurrency}
                    onChange={setVisitCurrency}
                    containerStyle={styles.currencyPickerWrap}
                  />
                  <TextInput
                    style={styles.amountInput}
                    value={visitAmount}
                    onChangeText={setVisitAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.inkFaint}
                    selectTextOnFocus
                  />
                </View>
              </View>

              <Pressable onPress={handleSaveVisit} disabled={savingVisit} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{savingVisit ? 'Saving…' : 'Save Visit'}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Grapes */}
        {entry.grapes.length > 0 && (
          <View style={styles.grapesBlock}>
            <Text style={styles.grapesLabel}>Grape Varieties</Text>
            <Text style={styles.grapesValue}>{entry.grapes.join(', ')}</Text>
          </View>
        )}

        {/* Label photo */}
        <View style={styles.labelPhotoBlock}>
          <View style={styles.labelPhotoHeader}>
            <Text style={styles.labelPhotoLabel}>Label Photo</Text>
            <View style={styles.labelPhotoActions}>
              {replacingPhoto ? (
                <ActivityIndicator size="small" color={Colors.gold} />
              ) : (
                <>
                  <Pressable onPress={handleReplacePhoto} hitSlop={8} disabled={replacingPhoto}>
                    <Text style={styles.editLink}>{entry.label_photo_url ? 'Replace' : '+ Add photo'}</Text>
                  </Pressable>
                  {entry.label_photo_url ? (
                    <Pressable onPress={handleRemovePhoto} hitSlop={8} disabled={replacingPhoto}>
                      <Text style={styles.removePhotoLink}>Remove</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          </View>
          {photoBanner ? (
            <Text style={photoBanner.type === 'success' ? styles.successBanner : styles.errorBanner}>
              {photoBanner.msg}
            </Text>
          ) : null}
          {entry.label_photo_url ? (
            <Pressable onPress={() => setPhotoModal(true)} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <Image
                source={{ uri: entry.label_photo_url }}
                style={styles.labelPhoto}
                contentFit="cover"
                cachePolicy="memory-disk"
                placeholder={entry.label_photo_blurhash ?? LABEL_PHOTO_PLACEHOLDER}
                placeholderContentFit="cover"
                transition={300}
              />
              <Text style={styles.labelPhotoHint}>tap to enlarge</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ height: Spacing.huge * 2 }} />
      </ScrollView>

      {/* Fixed bottom share bar */}
      <View style={[styles.bottomBar, { paddingBottom: Spacing.xl + insets.bottom }]}>
        <Pressable style={styles.bottomBarBtn} onPress={() => setShareSheetOpen(true)}>
          <Text style={styles.bottomBarBtnText}>⬆ Share</Text>
        </Pressable>
      </View>

      <ShareSheet
        visible={shareSheetOpen}
        onClose={() => setShareSheetOpen(false)}
        entry={entry}
        onShareText={handleShare}
        onShareWithMember={() => navigation.navigate('ShareCard', { entryId: entry.id })}
      />

      {/* Label photo lightbox */}
      {entry.label_photo_url && (() => {
        const photos: LabelPhoto[] = [
          { uri: entry.label_photo_url!, label: 'Front Label', blurhash: entry.label_photo_blurhash },
        ];
        if (entry.back_label_photo_url) {
          photos.push({ uri: entry.back_label_photo_url, label: 'Back Label' });
        }
        return (
          <LabelPhotoModal
            visible={photoModal}
            onClose={() => setPhotoModal(false)}
            photos={photos}
            wineName={entry.name || entry.producer || undefined}
          />
        );
      })()}
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
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  deleteConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 16,
    color: Colors.gold,
  },
  deleteText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 15,
    color: Colors.red,
  },
  toast: {
    backgroundColor: Colors.ink,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  toastText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.white,
  },
  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    flexWrap: 'wrap',
  },
  metaText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  locationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  locationGeoTag: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  locationCoords: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 10,
    color: Colors.inkFaint,
    letterSpacing: 0.2,
    marginTop: 1,
  },
  notesBlock: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  notesLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
    marginBottom: 6,
  },
  notesText: {
    fontFamily: Fonts.playfairItalic,
    fontSize: 14,
    color: Colors.inkMid,
    lineHeight: 21,
  },
  // Notes editing
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  editLink: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.gold,
  },
  notesEmpty: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkFaint,
    fontStyle: 'italic',
  },
  notesEditWrap: {
    gap: Spacing.sm,
    marginTop: 4,
  },
  notesInput: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.md,
    minHeight: 110,
    lineHeight: 21,
  },
  notesEditBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  saveBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold,
  },
  saveBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.ink,
  },
  successBanner: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.green,
    backgroundColor: 'rgba(46,107,69,0.08)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    textAlign: 'center',
  },
  errorBanner: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.red,
    backgroundColor: 'rgba(139,46,46,0.08)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    textAlign: 'center',
  },

  // Price history + visit form
  priceBlock: {
    gap: Spacing.sm,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  priceRowLeft: {
    gap: 2,
    flex: 1,
  },
  priceType: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.ink,
  },
  priceLocation: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
  },
  priceDate: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  priceValue: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 15,
    color: Colors.ink,
  },
  visitForm: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  visitFormTitle: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 15,
    color: Colors.ink,
  },
  visitFieldWrap: {
    gap: 6,
  },
  visitFieldLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  visitTextInput: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    height: 44,
  },
  typeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  typeBtnActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(196,132,122,0.12)',
  },
  typeBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  typeBtnTextActive: {
    fontFamily: Fonts.dmSansMedium,
    color: Colors.gold,
  },
  priceInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  currencyPickerWrap: {
    width: 132,
  },
  amountInput: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
    height: 44,
  },
  grapesBlock: {
    gap: 4,
  },
  grapesLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  grapesValue: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.inkMid,
  },
  labelPhotoBlock: {
    marginTop: Spacing.xl,
  },
  labelPhotoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  labelPhotoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  labelPhotoLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  removePhotoLink: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.red,
  },
  labelPhotoHint: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 11,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.6,
  },
  labelPhoto: {
    width: '100%',
    height: 220,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceAlt,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  bottomBarBtn: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  bottomBarBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 15,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  customAromasBlock: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 8,
  },
  customAromasHeading: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  customAromasChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  customAromasChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.ink + '10',
    borderWidth: 0.5,
    borderColor: Colors.inkMuted,
  },
  customAromasChipText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMid,
  },
  aromasOtherNote: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMid,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  errorText: {
    fontFamily: Fonts.playfair,
    fontSize: 18,
    color: Colors.inkMuted,
  },
});
