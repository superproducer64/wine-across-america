import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LABEL_PHOTO_PLACEHOLDER } from '@/utils/imagePlaceholder';
import { Colors, Fonts, Radius, Spacing, Shadows } from '@/theme';
import { WineEntry } from '@/types';
import { RadarChart } from '@/components/charts/RadarChart';
import { AromaDrilldownPicker } from '@/components/charts/AromaDrilldownPicker';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { LabelPhotoModal, LabelPhoto } from '@/components/wine/LabelPhotoModal';

interface Props {
  entry: WineEntry;
  compact?: boolean;
}

// ─── Score Circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score, compact }: { score: number; compact?: boolean }) {
  const size = compact ? 52 : 68;
  const fontSize = compact ? 20 : 28;
  return (
    <View style={[scoreStyles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[scoreStyles.number, { fontSize }]}>{score}</Text>
      <Text style={scoreStyles.stars}>★★★</Text>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  circle: {
    borderWidth: 2,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  number: {
    fontFamily: Fonts.playfairSemiBold,
    color: Colors.ink,
    lineHeight: undefined,
  },
  stars: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 7,
    color: Colors.inkMuted,
    letterSpacing: 1,
  },
});

// ─── Main Card ────────────────────────────────────────────────────────────────

const RADAR_AXES = [
  { label: 'Sweetness', key: 'sweetness' as const, fallback: 5 },
  { label: 'Acidity', key: 'acidity' as const, fallback: 5 },
  { label: 'Body', key: 'body' as const, fallback: 5 },
  { label: 'Alcohol', key: 'alcohol' as const, fallback: 5 },
  { label: 'Tannin', key: 'tannin' as const, fallback: 5 },
  { label: 'Intensity', key: 'intensity' as const, fallback: 5 },
  { label: 'Finish', key: 'finish_length' as const, fallback: 5 },
];

export function ProWineCard({ entry, compact = false }: Props) {
  const score = entry.technical_score ?? 0;
  const colSize = compact ? 130 : 150;
  const [wheelOpen, setWheelOpen] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const [photoModal, setPhotoModal] = useState(false);
  const [photoModalIdx, setPhotoModalIdx] = useState(0);
  const { width: screenW, height: screenH } = useWindowDimensions();
  // Popover's own footprint (matches the `popover` style below) minus the
  // tighter gutter around the wheel (`popoverScroll`, not the full
  // Spacing.lg used by the header/subtitle) — this is the actual room the
  // wheel has to work with, so labels get real physical space instead of
  // being sized against a number that ignores the modal's padding.
  const popoverWidth = Math.min(screenW * 0.97, 520);
  const popoverSize = Math.min(popoverWidth - Spacing.xs * 2, screenH * 0.64, 460);

  const origin = [entry.subregion, entry.region, entry.country].filter(Boolean).join(', ');
  const wineTitle = [entry.name, entry.vintage].filter(Boolean).join(' ');

  const isBestValue = !!entry.want_to_buy && score >= 80;
  const hasAromas = entry.aromas_l1.length > 0;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        {(entry.label_photo_url || entry.back_label_photo_url) ? (
          <View style={styles.photoRow}>
            {entry.label_photo_url ? (
              <TouchableOpacity
                onPress={() => { setPhotoModalIdx(0); setPhotoModal(true); }}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: entry.label_photo_url }}
                  style={[
                    styles.headerThumbnail,
                    compact && styles.headerThumbnailCompact,
                    entry.back_label_photo_url ? styles.headerThumbnailDuo : undefined,
                  ]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  placeholder={entry.label_photo_blurhash ?? LABEL_PHOTO_PLACEHOLDER}
                  placeholderContentFit="cover"
                  transition={300}
                />
              </TouchableOpacity>
            ) : null}
            {entry.back_label_photo_url ? (
              <TouchableOpacity
                onPress={() => { setPhotoModalIdx(1); setPhotoModal(true); }}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: entry.back_label_photo_url }}
                  style={[
                    styles.headerThumbnail,
                    compact && styles.headerThumbnailCompact,
                    styles.headerThumbnailDuo,
                  ]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={300}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <Text style={[styles.producer, compact && styles.producerCompact]} numberOfLines={2}>
          {entry.producer || entry.name || 'Unknown Producer'}
        </Text>
        <Text style={[styles.wineName, compact && styles.wineNameCompact]} numberOfLines={2}>
          {entry.producer ? wineTitle : ''}
        </Text>
        <View style={styles.divider} />
        {origin ? (
          <Text style={[styles.origin, compact && styles.originCompact]}>{origin}</Text>
        ) : null}
        <View style={styles.divider} />
      </View>

      {/* ── Body: Radar (left) + Flavor Wheel (right) ── */}
      <View style={styles.body}>
        {/* Left: PROFILE label + Radar + notes (tap spoke to highlight; button expands) */}
        <View style={styles.leftCol}>
          <View style={styles.wheelTouchable}>
            <Text style={[styles.colLabel, compact && styles.smallLabel]}>Profile</Text>
            <RadarChart
              scores={{
                sweetness: entry.sweetness ?? 5,
                acidity: entry.acidity,
                body: entry.body,
                alcohol: entry.alcohol,
                tannin: entry.tannin,
                intensity: entry.intensity,
                finish_length: entry.finish_length ?? 5,
              }}
              size={colSize}
              color={Colors.ink}
            />
            <TouchableOpacity
              onPress={() => setRadarOpen(true)}
              activeOpacity={0.75}
            >
              <View style={styles.expandBtn}>
                <Text style={styles.expandBtnText}>⊕ Expand chart</Text>
              </View>
            </TouchableOpacity>
          </View>
          {entry.free_notes ? (
            <Text
              style={[styles.profileText, compact && styles.profileTextCompact]}
              numberOfLines={compact ? 2 : 4}
            >
              {entry.free_notes}
            </Text>
          ) : null}
        </View>

        {/* Right: AROMA PROFILE label + Flavor Wheel (tap to expand) */}
        <View style={styles.rightCol}>
          {hasAromas ? (
            <TouchableOpacity
              onPress={() => setWheelOpen(true)}
              activeOpacity={0.72}
              style={styles.wheelTouchable}
            >
              <Text style={[styles.colLabel, compact && styles.smallLabel]}>Aroma Profile</Text>
              <AromaDrilldownPicker
                aromasL1={entry.aromas_l1}
                aromasL2={entry.aromas_l2}
                isSommelier
                readOnly
                interactive={false}
                size={colSize}
              />
              <View style={styles.expandBtn}>
                <Text style={styles.expandBtnText}>⊕ Expand wheel</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Score + Footer row ── */}
      <View style={styles.footer}>
        {score > 0 && <ScoreCircle score={score} compact={compact} />}
        {isBestValue && (
          <View style={styles.bestValueBadge}>
            <Text style={[styles.bestValueText, compact && styles.bestValueTextCompact]}>
              Best Value ✓
            </Text>
          </View>
        )}
        <Text style={[styles.buyAgain, compact && styles.buyAgainCompact]}>
          Would I buy again?{' '}
          <Text style={entry.want_to_buy ? styles.yesText : styles.noText}>
            {entry.want_to_buy ? '✓ YES' : '✗ NO'}
          </Text>
        </Text>
      </View>

      {/* ── Radar Profile Popover ── */}
      <InfoPopover
        visible={radarOpen}
        onClose={() => setRadarOpen(false)}
        title="Structure Profile"
      >
        <Text style={radarPopoverStyles.subtitle} numberOfLines={1}>
          {entry.producer || entry.name || ''}
          {entry.vintage ? `  ·  ${entry.vintage}` : ''}
        </Text>
        <RadarChart
          scores={{
            sweetness: entry.sweetness ?? 5,
            acidity: entry.acidity,
            body: entry.body,
            alcohol: entry.alcohol,
            tannin: entry.tannin,
            intensity: entry.intensity,
            finish_length: entry.finish_length ?? 5,
          }}
          size={Math.min(popoverSize, 260)}
          color={Colors.ink}
        />
        <View style={radarPopoverStyles.table}>
          {RADAR_AXES.map(({ label, key, fallback }) => {
            const val: number = (entry[key] as number | undefined) ?? fallback;
            return (
              <View key={key} style={radarPopoverStyles.tableRow}>
                <Text style={radarPopoverStyles.tableLabel}>{label}</Text>
                <View style={radarPopoverStyles.tableTrack}>
                  <View style={[radarPopoverStyles.tableFill, { width: `${(val / 10) * 100}%` as any }]} />
                </View>
                <Text style={radarPopoverStyles.tableVal}>{val}<Text style={radarPopoverStyles.tableMax}>/10</Text></Text>
              </View>
            );
          })}
        </View>
      </InfoPopover>

      {/* ── Aroma Wheel Popover ── */}
      {hasAromas && (
        <Modal
          visible={wheelOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setWheelOpen(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.overlay} onPress={() => setWheelOpen(false)}>
            <Pressable style={[styles.popover, { maxHeight: screenH * 0.9 }]} onPress={() => {}}>
              {/* Title row */}
              <View style={styles.popoverHeader}>
                <Text style={styles.popoverTitle}>Aroma Wheel</Text>
                <TouchableOpacity onPress={() => setWheelOpen(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Wine name sub-label */}
              <Text style={styles.popoverSubtitle} numberOfLines={1}>
                {entry.producer || entry.name || ''}
                {entry.vintage ? `  ·  ${entry.vintage}` : ''}
              </Text>

              {/* Scrollable wheel + legend */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.popoverScroll}
              >
                {/* Drill-down wheel (display only) — driven by the aromas picked in
                    Step 2's list. Tap a category to see its aromas. */}
                <AromaDrilldownPicker
                  aromasL1={entry.aromas_l1}
                  aromasL2={entry.aromas_l2}
                  isSommelier
                  readOnly
                  size={popoverSize}
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Label Photo Lightbox ── */}
      {!!(entry.label_photo_url || entry.back_label_photo_url) && (() => {
        const photos: LabelPhoto[] = [];
        if (entry.label_photo_url) photos.push({ uri: entry.label_photo_url, label: 'Front Label', blurhash: entry.label_photo_blurhash });
        if (entry.back_label_photo_url) photos.push({ uri: entry.back_label_photo_url, label: 'Back Label' });
        return (
          <LabelPhotoModal
            visible={photoModal}
            onClose={() => setPhotoModal(false)}
            photos={photos}
            wineName={entry.name || entry.producer || undefined}
            initialIndex={photoModalIdx}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.md,
  },
  cardCompact: {
    borderRadius: Radius.md,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 4,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 4,
  },
  headerThumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
  },
  headerThumbnailCompact: {
    width: 40,
    height: 40,
  },
  headerThumbnailDuo: {
    width: 48,
    height: 48,
  },
  producer: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 22,
    color: Colors.ink,
    textAlign: 'center',
    lineHeight: 28,
  },
  producerCompact: { fontSize: 14, lineHeight: 18 },
  wineName: {
    fontFamily: Fonts.playfair,
    fontSize: 14,
    color: Colors.inkMid,
    textAlign: 'center',
    lineHeight: 20,
  },
  wineNameCompact: { fontSize: 10, lineHeight: 14 },
  divider: {
    height: 0.5,
    width: '60%',
    backgroundColor: Colors.inkMuted,
    opacity: 0.4,
    marginVertical: 2,
  },
  origin: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMid,
    textAlign: 'center',
  },
  originCompact: { fontSize: 9 },

  // Body
  body: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs ?? 4,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  leftCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  rightCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },

  // Column section label (PROFILE / AROMA PROFILE)
  colLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
    alignSelf: 'center',
  },

  // Profile free-text note under radar
  profileText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 10,
    color: Colors.inkMid,
    lineHeight: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  profileTextCompact: { fontSize: 8, lineHeight: 12 },

  // Score + Best Value badge
  bestValueBadge: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestValueText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    color: Colors.white,
    letterSpacing: 0.3,
  },
  bestValueTextCompact: { fontSize: 8 },

  // Footer row: score + best value + "Would I buy again?"
  footer: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  buyAgain: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMid,
    flex: 1,
    textAlign: 'right',
  },
  buyAgainCompact: { fontSize: 9 },
  yesText: {
    fontFamily: Fonts.dmSansMedium,
    color: Colors.ink,
  },
  noText: {
    fontFamily: Fonts.dmSansMedium,
    color: Colors.inkMuted,
  },

  // Wheel touchable + expand button
  wheelTouchable: {
    alignItems: 'center',
    gap: 4,
  },
  expandBtn: {
    marginTop: 6,
    backgroundColor: Colors.ink,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  expandBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    color: Colors.white,
    letterSpacing: 0.2,
  },

  // Popover modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 10, 12, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popover: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.lg,
    maxWidth: 520,
    width: '97%',
  },
  popoverScroll: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.lg,
  },
  popoverTitle: {
    flex: 1,
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 18,
    color: Colors.ink,
  },
  popoverSubtitle: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMid,
    alignSelf: 'flex-start',
    fontStyle: 'italic',
    paddingHorizontal: Spacing.lg,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.inkMid,
  },

  // Shared small label
  smallLabel: { fontSize: 9 },
});

const radarPopoverStyles = StyleSheet.create({
  subtitle: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMid,
    fontStyle: 'italic',
    alignSelf: 'flex-start',
    marginTop: -4,
  },
  table: {
    width: '100%',
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableLabel: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMid,
    width: 72,
  },
  tableTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  tableFill: {
    height: '100%',
    backgroundColor: Colors.ink,
    borderRadius: Radius.full,
  },
  tableVal: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 14,
    color: Colors.ink,
    width: 42,
    textAlign: 'right',
  },
  tableMax: {
    fontFamily: Fonts.dmSans,
    fontSize: 10,
    color: Colors.inkMuted,
  },
});
