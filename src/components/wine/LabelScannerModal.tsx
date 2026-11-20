import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Fonts, Radius, Spacing, Shadows } from '@/theme';
import { TextInput } from '@/components/ui/TextInput';
import { analyzeWineLabelWithAI, WineLabelData } from '@/utils/wineOcr';
import { uploadLabelPhoto } from '@/lib/supabase';
import { getCurrencySymbol } from '@/utils/currency';
import { computeLabelPhotoPlaceholder } from '@/utils/imagePlaceholder';
import { useWineStore } from '@/stores/wineStore';
import { WineEntry } from '@/types';
import type { MainStackParamList } from '@/navigation/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onApply: (data: Partial<WineLabelData> & { photoUrl?: string; photoBlurHash?: string; backPhotoUrl?: string }) => void;
  userId: string;
}

type Phase = 'pick_front' | 'pick_back' | 'uploading' | 'recognition' | 'review' | 'error';

interface WineMatch {
  entry: WineEntry;
  matchType: 'exact' | 'same_winery';
}

function formatMatchDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function findMatches(entries: WineEntry[], producer: string, vintageStr: string): WineMatch[] {
  const producerLower = producer.trim().toLowerCase();
  if (!producerLower) return [];
  const vintage = vintageStr ? parseInt(vintageStr) : null;
  const matches: WineMatch[] = [];

  for (const entry of entries) {
    const entryProducer = (entry.producer || entry.name || '').toLowerCase();
    if (!entryProducer.includes(producerLower) && !producerLower.includes(entryProducer)) continue;
    const isExact = vintage !== null && entry.vintage === vintage;
    matches.push({ entry, matchType: isExact ? 'exact' : 'same_winery' });
  }

  matches.sort((a, b) => {
    if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
    if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
    return new Date(b.entry.tasting_date).getTime() - new Date(a.entry.tasting_date).getTime();
  });

  return matches.slice(0, 3);
}

interface PickedImage {
  uri: string;       // file:// URI — used for preview display
  dataUri: string;   // data: URI  — used for AI analysis (works on native + web)
}

async function pickImage(source: 'camera' | 'gallery'): Promise<PickedImage | null> {
  const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, base64: true } as const;

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return null;
    result = await ImagePicker.launchCameraAsync(opts);
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return null;
    result = await ImagePicker.launchImageLibraryAsync(opts);
  }

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  const dataUri = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
  return { uri: asset.uri, dataUri };
}

export function LabelScannerModal({ visible, onClose, onApply, userId }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { entries } = useWineStore();

  const [phase, setPhase] = useState<Phase>('pick_front');
  const [frontUri, setFrontUri] = useState<string | null>(null);       // file URI — display only
  const [frontDataUri, setFrontDataUri] = useState<string | null>(null); // data URI — AI input
  const [backUri, setBackUri] = useState<string | null>(null);
  const [backDataUri, setBackDataUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [matches, setMatches] = useState<WineMatch[]>([]);

  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintageStr, setVintageStr] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [appellation, setAppellation] = useState('');
  const [grapes, setGrapes] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [backPhotoUrl, setBackPhotoUrl] = useState<string | null>(null);
  const [photoBlurHash, setPhotoBlurHash] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState(false);

  const reset = () => {
    setPhase('pick_front');
    setFrontUri(null);
    setFrontDataUri(null);
    setBackUri(null);
    setBackDataUri(null);
    setErrorMsg('');
    setName('');
    setProducer('');
    setVintageStr('');
    setCountry('');
    setRegion('');
    setAppellation('');
    setGrapes([]);
    setPhotoUrl(null);
    setBackPhotoUrl(null);
    setPhotoBlurHash(null);
    setAiSuccess(false);
    setMatches([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processImages = async (
    front: string, back: string | null,
    frontData: string, backData: string | null
  ) => {
    setPhase('uploading');

    try {
      const tasks: Promise<unknown>[] = [
        uploadLabelPhoto(userId, front),
        analyzeWineLabelWithAI(frontData, backData),
        computeLabelPhotoPlaceholder(front),
      ];
      if (back) tasks.push(uploadLabelPhoto(userId, back));

      const results = await Promise.all(tasks);
      const uploadResult = results[0] as Awaited<ReturnType<typeof uploadLabelPhoto>>;
      const extracted = results[1] as WineLabelData;
      const blurHash = results[2] as string;
      const backUploadResult = back ? (results[3] as Awaited<ReturnType<typeof uploadLabelPhoto>>) : null;

      setPhotoUrl(uploadResult.url);
      setPhotoBlurHash(blurHash);
      if (backUploadResult?.url) setBackPhotoUrl(backUploadResult.url);

      const hasData = !!(extracted.name || extracted.producer || extracted.country || extracted.vintage);
      setAiSuccess(hasData);

      setName(extracted.name);
      setProducer(extracted.producer);
      setVintageStr(extracted.vintage ? String(extracted.vintage) : '');
      setCountry(extracted.country);
      setRegion(extracted.region);
      setAppellation(extracted.appellation);
      setGrapes(extracted.grapes ?? []);

      const found = findMatches(entries, extracted.producer, extracted.vintage ? String(extracted.vintage) : '');
      setMatches(found);
      setPhase(found.length > 0 ? 'recognition' : 'review');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMsg(msg || 'Something went wrong processing the image. Please try again.');
      setPhase('error');
    }
  };

  const handlePickFront = async (source: 'camera' | 'gallery') => {
    const picked = await pickImage(source);
    if (!picked) {
      if (source === 'camera') { setErrorMsg('Camera permission denied.'); setPhase('error'); }
      return;
    }
    setFrontUri(picked.uri);
    setFrontDataUri(picked.dataUri);
    setPhase('pick_back');
  };

  const handlePickBack = async (source: 'camera' | 'gallery') => {
    const picked = await pickImage(source);
    if (!picked) return;
    setBackUri(picked.uri);
    setBackDataUri(picked.dataUri);
    await processImages(frontUri!, picked.uri, frontDataUri!, picked.dataUri);
  };

  const handleSkipBack = async () => {
    await processImages(frontUri!, null, frontDataUri!, null);
  };

  const handleApply = () => {
    onApply({
      name: name.trim() || undefined,
      producer: producer.trim() || undefined,
      vintage: vintageStr ? parseInt(vintageStr) || null : null,
      country: country.trim() || undefined,
      region: region.trim() || undefined,
      appellation: appellation.trim() || undefined,
      grapes: grapes.length > 0 ? grapes : undefined,
      photoUrl: photoUrl ?? undefined,
      photoBlurHash: photoBlurHash ?? undefined,
      backPhotoUrl: backPhotoUrl ?? undefined,
    });
    reset();
    onClose();
  };

  const handleLogVisit = (entryId: string) => {
    reset();
    onClose();
    navigation.navigate('WineDetail', { entryId });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {phase === 'pick_front' ? 'Scan Front Label' :
               phase === 'pick_back' ? 'Add Back Label' :
               'Scan Wine Label'}
            </Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Step indicator */}
          {(phase === 'pick_front' || phase === 'pick_back') && (
            <View style={styles.stepRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, styles.stepDotActive]} />
                <Text style={[styles.stepLabel, styles.stepLabelActive]}>Front</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, phase === 'pick_back' && styles.stepDotActive]} />
                <Text style={[styles.stepLabel, phase === 'pick_back' && styles.stepLabelActive]}>Back</Text>
              </View>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Phase: pick_front ── */}
            {phase === 'pick_front' && (
              <View style={styles.pickPhase}>
                <Text style={styles.pickIcon}>📸</Text>
                <Text style={styles.pickTitle}>Front Label</Text>
                <Text style={styles.pickSubtitle}>
                  Take a photo of the front label. AI will identify the wine, winery, vintage, and region.
                </Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>✨ Powered by GPT-4o Vision</Text>
                </View>
                <View style={styles.pickButtons}>
                  <Pressable style={styles.pickBtn} onPress={() => handlePickFront('camera')}>
                    <Text style={styles.pickBtnIcon}>📷</Text>
                    <Text style={styles.pickBtnText}>Camera</Text>
                  </Pressable>
                  <Pressable style={styles.pickBtn} onPress={() => handlePickFront('gallery')}>
                    <Text style={styles.pickBtnIcon}>🖼️</Text>
                    <Text style={styles.pickBtnText}>Gallery</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Phase: pick_back ── */}
            {phase === 'pick_back' && (
              <View style={styles.pickBackPhase}>
                {/* Front photo thumbnail */}
                {!!frontUri && (
                  <View style={styles.frontThumbWrap}>
                    <Image source={{ uri: frontUri }} style={styles.frontThumb} />
                    <View style={styles.frontThumbBadge}>
                      <Text style={styles.frontThumbBadgeText}>✓ Front captured</Text>
                    </View>
                  </View>
                )}

                <Text style={styles.pickTitle}>Back Label</Text>
                <Text style={styles.pickSubtitle}>
                  Adding the back label helps AI find grape varieties, alcohol %, and tasting notes.
                </Text>

                <View style={styles.pickButtons}>
                  <Pressable style={styles.pickBtn} onPress={() => handlePickBack('camera')}>
                    <Text style={styles.pickBtnIcon}>📷</Text>
                    <Text style={styles.pickBtnText}>Camera</Text>
                  </Pressable>
                  <Pressable style={styles.pickBtn} onPress={() => handlePickBack('gallery')}>
                    <Text style={styles.pickBtnIcon}>🖼️</Text>
                    <Text style={styles.pickBtnText}>Gallery</Text>
                  </Pressable>
                </View>

                <Pressable style={styles.skipBtn} onPress={handleSkipBack}>
                  <Text style={styles.skipBtnText}>Skip — use front label only</Text>
                </Pressable>
              </View>
            )}

            {/* ── Phase: uploading ── */}
            {phase === 'uploading' && (
              <View style={styles.loadingPhase}>
                <View style={styles.photoRow}>
                  {!!frontUri && (
                    <Image source={{ uri: frontUri }} style={[styles.previewImage, backUri ? styles.previewImageHalf : undefined]} />
                  )}
                  {!!backUri && (
                    <Image source={{ uri: backUri }} style={[styles.previewImage, styles.previewImageHalf]} />
                  )}
                </View>
                <ActivityIndicator color={Colors.gold} size="large" style={{ marginTop: 24 }} />
                <Text style={styles.loadingText}>Analyzing label with AI…</Text>
                <Text style={styles.loadingSubtext}>
                  {backUri ? 'Reading front and back labels with GPT-4o' : 'GPT-4o Vision is reading your wine label'}
                </Text>
              </View>
            )}

            {/* ── Phase: recognition ── */}
            {phase === 'recognition' && (
              <View style={styles.recognitionPhase}>
                <View style={styles.photoRow}>
                  {!!frontUri && (
                    <Image source={{ uri: frontUri }} style={[styles.recognitionImage, backUri ? styles.recognitionImageHalf : undefined]} />
                  )}
                  {!!backUri && (
                    <Image source={{ uri: backUri }} style={[styles.recognitionImage, styles.recognitionImageHalf]} />
                  )}
                </View>

                <View style={styles.recognitionHeader}>
                  <Text style={styles.recognitionIcon}>🍷</Text>
                  <Text style={styles.recognitionTitle}>We know this wine!</Text>
                  <Text style={styles.recognitionSubtitle}>
                    {matches[0]?.matchType === 'exact'
                      ? `You've had this exact vintage before.`
                      : `You've had wine from this winery before.`}
                  </Text>
                </View>

                {matches.map((match) => {
                  const e = match.entry;
                  const lastPrice = e.price.length > 0 ? e.price[e.price.length - 1] : null;
                  return (
                    <View key={e.id} style={styles.matchCard}>
                      <View style={styles.matchCardTop}>
                        <View style={styles.matchBadge}>
                          <Text style={styles.matchBadgeText}>
                            {match.matchType === 'exact' ? '✓ Same vintage' : '🔄 Different vintage'}
                          </Text>
                        </View>
                        {e.technical_score > 0 && (
                          <View style={styles.scorePill}>
                            <Text style={styles.scorePillText}>{e.technical_score}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.matchName}>
                        {e.name || e.producer}{e.vintage ? ` ${e.vintage}` : ''}
                      </Text>
                      {match.matchType === 'same_winery' && e.vintage ? (
                        <Text style={styles.matchVintageDiff}>
                          You had the {e.vintage} vintage — this label shows {vintageStr || 'a different vintage'}
                        </Text>
                      ) : null}
                      <View style={styles.matchMeta}>
                        {e.tasting_date ? (
                          <Text style={styles.matchMetaText}>🗓 {formatMatchDate(e.tasting_date)}</Text>
                        ) : null}
                        {e.location_name ? (
                          <Text style={styles.matchMetaText}>📍 {e.location_name}</Text>
                        ) : null}
                        {lastPrice ? (
                          <Text style={styles.matchMetaText}>
                            {lastPrice.type === 'glass' ? '🥂' : '🍾'} {getCurrencySymbol(lastPrice.currency)}{lastPrice.amount.toFixed(2)}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable style={styles.logVisitBtn} onPress={() => handleLogVisit(e.id)}>
                        <Text style={styles.logVisitBtnText}>Log a visit to this wine →</Text>
                      </Pressable>
                    </View>
                  );
                })}

                <View style={styles.recognitionDivider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable style={styles.newEntryBtn} onPress={() => setPhase('review')}>
                  <Text style={styles.newEntryBtnText}>Add as a new entry</Text>
                </Pressable>
                <Text style={styles.newEntryHint}>
                  Creates a separate log — useful for tracking different vintages or tastings side by side.
                </Text>
              </View>
            )}

            {/* ── Phase: review ── */}
            {phase === 'review' && (
              <View style={styles.reviewPhase}>
                {/* Photo previews */}
                <View style={styles.photoRow}>
                  {!!frontUri && (
                    <View style={[styles.photoPreviewWrap, backUri ? styles.photoPreviewHalf : undefined]}>
                      <Image source={{ uri: frontUri }} style={styles.reviewImage} />
                      <Text style={styles.photoLabel}>Front</Text>
                      {!!photoUrl && !backUri && (
                        <View style={styles.savedBadge}>
                          <Text style={styles.savedBadgeText}>📎 Photo saved</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {!!backUri && (
                    <View style={[styles.photoPreviewWrap, styles.photoPreviewHalf]}>
                      <Image source={{ uri: backUri }} style={styles.reviewImage} />
                      <Text style={styles.photoLabel}>Back</Text>
                    </View>
                  )}
                </View>
                {!!(photoUrl || backPhotoUrl) && (
                  <View style={styles.savedBadge}>
                    <Text style={styles.savedBadgeText}>📎 {backPhotoUrl ? 'Both photos saved' : 'Photo saved'}</Text>
                  </View>
                )}

                {aiSuccess ? (
                  <View style={styles.aiSuccessBanner}>
                    <Text style={styles.aiSuccessText}>
                      ✨ AI identified this wine{backUri ? ' using both labels' : ''} — review and confirm below
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.reviewHint}>
                    AI couldn't confidently read this label. Fill in what you can.
                  </Text>
                )}

                <TextInput label="Wine Name" value={name} onChangeText={setName} placeholder="e.g., Château Margaux" />
                <TextInput label="Producer / Winery" value={producer} onChangeText={setProducer} placeholder="e.g., Château Margaux" />
                <TextInput label="Vintage" value={vintageStr} onChangeText={setVintageStr} keyboardType="number-pad" placeholder="e.g., 2019" />
                <TextInput label="Country" value={country} onChangeText={setCountry} placeholder="e.g., France" />
                <TextInput label="Region" value={region} onChangeText={setRegion} placeholder="e.g., Bordeaux" />
                <TextInput label="Appellation" value={appellation} onChangeText={setAppellation} placeholder="e.g., Margaux" />

                {grapes.length > 0 && (
                  <View style={styles.grapesWrap}>
                    <Text style={styles.grapesLabel}>Grape Varieties Detected</Text>
                    <View style={styles.grapeChips}>
                      {grapes.map((g) => (
                        <View key={g} style={styles.grapeChip}>
                          <Text style={styles.grapeChipText}>{g}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.grapesHint}>These will be added to the grape blends section</Text>
                  </View>
                )}

                <View style={styles.reviewActions}>
                  <Pressable style={styles.applyBtn} onPress={handleApply}>
                    <Text style={styles.applyBtnText}>Apply to Entry</Text>
                  </Pressable>
                  <Pressable style={styles.retakeBtn} onPress={() => { setFrontUri(null); setBackUri(null); setPhase('pick_front'); }}>
                    <Text style={styles.retakeBtnText}>Retake</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Phase: error ── */}
            {phase === 'error' && (
              <View style={styles.errorPhase}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorMsg}>{errorMsg}</Text>
                <Pressable style={styles.retakeBtn} onPress={() => setPhase('pick_front')}>
                  <Text style={styles.retakeBtnText}>Try Again</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
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
  title: {
    fontFamily: Fonts.playfair,
    fontSize: 20,
    color: Colors.ink,
  },
  closeBtn: { padding: Spacing.sm },
  closeBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 16,
    color: Colors.inkMuted,
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.gold,
  },
  stepLine: {
    width: 40,
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 14,
  },
  stepLabel: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkFaint,
  },
  stepLabelActive: {
    color: Colors.gold,
    fontFamily: Fonts.dmSansMedium,
  },

  body: {
    padding: Spacing.xl,
    flexGrow: 1,
  },

  // Pick phases
  pickPhase: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  pickBackPhase: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  pickIcon: { fontSize: 52 },
  pickTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 22,
    color: Colors.ink,
    textAlign: 'center',
  },
  pickSubtitle: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.inkMuted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  aiBadge: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  aiBadgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.inkMuted,
  },
  pickButtons: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  pickBtn: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 110,
    ...Shadows.md,
  },
  pickBtnIcon: { fontSize: 28 },
  pickBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.gold,
  },
  skipBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  skipBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMuted,
    textDecorationLine: 'underline',
  },

  // Front thumb in pick_back
  frontThumbWrap: {
    position: 'relative',
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  frontThumb: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  frontThumbBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  frontThumbBadgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.gold,
  },

  // Shared photo row (side-by-side for front+back)
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },

  // Loading phase
  loadingPhase: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  previewImage: {
    flex: 1,
    height: 220,
    borderRadius: Radius.lg,
    resizeMode: 'cover',
  },
  previewImageHalf: {
    height: 220,
  },
  loadingText: {
    fontFamily: Fonts.playfair,
    fontSize: 18,
    color: Colors.ink,
    marginTop: Spacing.lg,
  },
  loadingSubtext: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    marginTop: 4,
    textAlign: 'center',
  },

  // Recognition phase
  recognitionPhase: {
    gap: Spacing.lg,
  },
  recognitionImage: {
    flex: 1,
    height: 140,
    borderRadius: Radius.lg,
    resizeMode: 'cover',
  },
  recognitionImageHalf: {
    height: 140,
  },
  recognitionHeader: {
    alignItems: 'center',
    gap: 6,
  },
  recognitionIcon: { fontSize: 36 },
  recognitionTitle: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 22,
    color: Colors.ink,
    textAlign: 'center',
  },
  recognitionSubtitle: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  matchCard: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  matchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchBadge: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  matchBadgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  scorePill: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  scorePillText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.ink,
  },
  matchName: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 17,
    color: Colors.ink,
    lineHeight: 23,
  },
  matchVintageDiff: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  matchMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  matchMetaText: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
  },
  logVisitBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  logVisitBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
  },
  recognitionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  newEntryBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  newEntryBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
  },
  newEntryHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Review phase
  reviewPhase: {
    gap: Spacing.sm,
  },
  photoPreviewWrap: {
    flex: 1,
    position: 'relative',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  photoPreviewHalf: {
    flex: 1,
  },
  reviewImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    borderRadius: Radius.lg,
  },
  photoLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  savedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    marginBottom: Spacing.sm,
  },
  savedBadgeText: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  aiSuccessBanner: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    marginBottom: Spacing.sm,
  },
  aiSuccessText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.ink,
    textAlign: 'center',
  },
  reviewHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 19,
  },
  grapesWrap: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  grapesLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.inkMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  grapeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  grapeChip: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  grapeChipText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.gold,
  },
  grapesHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
    fontStyle: 'italic',
  },
  reviewActions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  applyBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  applyBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 15,
    color: Colors.ink,
  },
  retakeBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  retakeBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.inkMuted,
  },

  // Error phase
  errorPhase: {
    alignItems: 'center',
    paddingTop: Spacing.huge,
    gap: Spacing.lg,
  },
  errorIcon: { fontSize: 40 },
  errorMsg: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.red,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
