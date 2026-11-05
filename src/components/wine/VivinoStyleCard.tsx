import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { InfoPopover } from '@/components/ui/InfoPopover';
import { LABEL_PHOTO_PLACEHOLDER } from '@/utils/imagePlaceholder';
import { Colors, Fonts, Radius, Spacing, Shadows } from '@/theme';
import { WineEntry } from '@/types';
import { getFoodPairings } from '@/utils/foodPairings';
import { getCurrencySymbol } from '@/utils/currency';

interface Props {
  entry: WineEntry;
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ score }: { score: number }) {
  // Convert 0-100 technical score to 0-5 stars
  const starValue = (score / 100) * 5;
  const rounded = Math.round(starValue * 2) / 2; // round to nearest 0.5
  const display = rounded.toFixed(1);
  const fillPercent = Math.min(Math.max((rounded / 5) * 100, 0), 100);

  return (
    <View style={starStyles.row}>
      <Text style={starStyles.number}>{display}</Text>
      <View style={starStyles.starsWrap}>
        <View style={starStyles.stars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Text key={s} style={starStyles.star}>☆</Text>
          ))}
        </View>
        <View style={[starStyles.starsOverlay, { width: `${fillPercent}%` }]}>
          <View style={starStyles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Text key={s} style={[starStyles.star, starStyles.starFilled]}>★</Text>
            ))}
          </View>
        </View>
      </View>
      <Text style={starStyles.outOf}>/ 5.0</Text>
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  number: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 28,
    color: Colors.ink,
    lineHeight: 32,
  },
  starsWrap: {
    position: 'relative',
    paddingTop: 2,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  starsOverlay: {
    position: 'absolute',
    top: 2,
    left: 0,
    overflow: 'hidden',
  },
  star: {
    fontSize: 18,
    color: Colors.border,
  },
  starFilled: {
    color: Colors.gold,
  },
  outOf: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    paddingTop: 4,
  },
});

// ─── Axis Slider ─────────────────────────────────────────────────────────────

const VIVINO_AXIS_DESCRIPTIONS: Record<string, string> = {
  'Dry|Sweet':
    'Perceived sweetness from residual sugar or very ripe fruit. A dry wine has little to no sugar; a sweet wine has noticeable sweetness on the finish.',
  'Light Body|Full Body':
    'Body is the weight and richness of the wine on your palate — think skim milk (light) vs whole milk (full). Driven by alcohol, extract, and ripeness.',
  'Soft|Tannic':
    'Tannins from grape skins, seeds, and oak create a drying, grippy sensation. Higher tannin = more structure and aging potential.',
  'Low Acid|High Acid':
    'Acidity gives wine its crispness, freshness, and structure. High-acid wines taste lively and pair well with food; low-acid wines feel rounder and softer.',
};

function AxisSlider({
  left,
  right,
  value,
  onPress,
}: {
  left: string;
  right: string;
  value: number;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={axisStyles.row} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Text style={axisStyles.label}>{left}</Text>
      <View style={axisStyles.track}>
        <View style={[axisStyles.dot, { left: `${Math.min(Math.max(value * 100, 4), 96)}%` as any }]} />
      </View>
      <Text style={[axisStyles.label, axisStyles.labelRight]}>{right}</Text>
      {onPress && (
        <View style={axisStyles.infoBtn}>
          <Text style={axisStyles.infoBtnText}>i</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const axisStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
    width: 58,
  },
  labelRight: {
    textAlign: 'right',
  },
  track: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.border,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.gold,
    top: -4,
    marginLeft: -5,
  },
  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    color: Colors.inkMid,
    lineHeight: 14,
  },
});

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={sectionStyles.label}>{label}</Text>;
}

const sectionStyles = StyleSheet.create({
  label: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
    marginBottom: 10,
  },
});

// ─── Divider ─────────────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 0.5, backgroundColor: Colors.border, marginVertical: Spacing.lg }} />;
}

// ─── Main Card ───────────────────────────────────────────────────────────────

export function VivinoStyleCard({ entry }: Props) {
  const score = entry.technical_score ?? 0;
  const [activeAxis, setActiveAxis] = useState<{ title: string; description: string } | null>(null);

  const openAxis = (left: string, right: string) => {
    const key = `${left}|${right}`;
    const description = VIVINO_AXIS_DESCRIPTIONS[key] ?? '';
    setActiveAxis({ title: `${left} → ${right}`, description });
  };

  // Structure axes (convert 1-10 to 0-1)
  const norm = (v: number) => (v - 1) / 9;

  // Food pairings
  const pairings = getFoodPairings(entry);

  // Origin line
  const originParts = [entry.country, entry.region].filter(Boolean);
  const origin = originParts.join(' · ');

  // Price — use most recent entry
  const latestPrice = entry.price?.[entry.price.length - 1] ?? null;
  const priceDisplay = latestPrice && latestPrice.amount > 0
    ? `${getCurrencySymbol(latestPrice.currency)}${latestPrice.amount.toFixed(2)}`
    : null;

  // Grape blends — prefer detailed blend data, fall back to plain grapes array
  const hasBlends = entry.grape_blends && entry.grape_blends.length > 0;
  const blendTotal = hasBlends
    ? entry.grape_blends!.reduce((sum, g) => sum + (g.percentage ?? 0), 0)
    : 0;

  return (
    <View style={styles.card}>
      {/* ── Label Photo ── */}
      {entry.label_photo_url ? (
        <View style={styles.labelPhotoWrap}>
          <Image
            source={{ uri: entry.label_photo_url }}
            style={styles.labelPhoto}
            contentFit="cover"
            cachePolicy="memory-disk"
            placeholder={entry.label_photo_blurhash ?? LABEL_PHOTO_PLACEHOLDER}
            placeholderContentFit="cover"
            transition={300}
          />
          <View style={styles.labelPhotoOverlay} />
        </View>
      ) : (
        <View style={styles.colorBand} />
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Origin + vintage row */}
          <View style={styles.originRow}>
            {origin ? (
              <Text style={styles.originText}>{origin.toUpperCase()}</Text>
            ) : null}
            <View style={styles.originRight}>
              {entry.vintage ? (
                <View style={styles.vintagePill}>
                  <Text style={styles.vintageText}>{entry.vintage}</Text>
                </View>
              ) : null}
              {priceDisplay ? (
                <View style={styles.pricePill}>
                  <Text style={styles.priceText}>{priceDisplay}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Wine name */}
          <Text style={styles.wineName}>{entry.name || 'Untitled Wine'}</Text>

          {/* Producer */}
          {entry.producer ? (
            <Text style={styles.producer}>{entry.producer}</Text>
          ) : null}

          {/* Appellation */}
          {entry.appellation ? (
            <Text style={styles.appellation}>{entry.appellation}</Text>
          ) : null}

          {/* Star Rating */}
          {score > 0 && <StarRating score={score} />}

          {/* Technical score label */}
          {score > 0 && (
            <Text style={styles.scoreSub}>Technical Score {score}/100</Text>
          )}
        </View>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>

        <Divider />

        {/* Style Profile */}
        <View style={styles.section}>
          <SectionHeader label="Style" />
          <View style={{ gap: 12 }}>
            {/* sweetness is null on entries saved before migration 006 — omit the row rather than guess */}
            {entry.sweetness != null && (
              <AxisSlider left="Dry" right="Sweet" value={norm(entry.sweetness)} onPress={() => openAxis('Dry', 'Sweet')} />
            )}
            <AxisSlider left="Light Body" right="Full Body" value={norm(entry.body)} onPress={() => openAxis('Light Body', 'Full Body')} />
            <AxisSlider left="Soft" right="Tannic" value={norm(entry.tannin)} onPress={() => openAxis('Soft', 'Tannic')} />
            <AxisSlider left="Low Acid" right="High Acid" value={norm(entry.acidity)} onPress={() => openAxis('Low Acid', 'High Acid')} />          </View>
        </View>

        <InfoPopover
          visible={activeAxis !== null}
          onClose={() => setActiveAxis(null)}
          title={activeAxis?.title ?? ''}
        >
          <Text style={vivinoPopoverStyles.description}>{activeAxis?.description}</Text>
        </InfoPopover>

        {/* Food Pairings */}
        {pairings.length > 0 && (
          <>
            <Divider />
            <View style={styles.section}>
              <SectionHeader label="Pairs With" />
              <View style={styles.pairingsGrid}>
                {pairings.map((p) => (
                  <View key={p.label} style={styles.pairingItem}>
                    <Text style={styles.pairingEmoji}>{p.emoji}</Text>
                    <Text style={styles.pairingLabel}>{p.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Grapes — with blend percentages if available */}
        {(hasBlends || entry.grapes.length > 0) && (
          <>
            <Divider />
            <View style={styles.section}>
              <SectionHeader label="Grape Varieties" />
              {hasBlends ? (
                <View>
                  <View style={styles.blendList}>
                    {entry.grape_blends!.map((g) => (
                      <View key={g.name} style={styles.blendRow}>
                        <View style={styles.blendBarWrap}>
                          <Text style={styles.blendName}>{g.name}</Text>
                          {blendTotal > 0 && g.percentage != null && (
                            <View style={styles.blendTrack}>
                              <View
                                style={[
                                  styles.blendFill,
                                  { width: `${(g.percentage / blendTotal) * 100}%` as any },
                                ]}
                              />
                            </View>
                          )}
                        </View>
                        {g.percentage != null && (
                          <Text style={styles.blendPct}>{g.percentage}%</Text>
                        )}
                      </View>
                    ))}
                  </View>
                  {blendTotal > 0 && blendTotal !== 100 && (
                    <View style={styles.blendIncompleteRow}>
                      <Text style={styles.blendIncompleteText}>
                        ⚠️ Blend incomplete – adds up to {Math.round(blendTotal)}%
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.pillsRow}>
                  {entry.grapes.map((g) => (
                    <View key={g} style={styles.pill}>
                      <Text style={styles.pillText}>{g}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* Flags */}
        {(entry.want_another_glass || entry.want_to_buy) && (
          <>
            <Divider />
            <View style={[styles.section, styles.flagsRow]}>
              {entry.want_another_glass && (
                <View style={styles.flag}>
                  <Text style={styles.flagEmoji}>🥂</Text>
                  <Text style={styles.flagText}>Would have another glass</Text>
                </View>
              )}
              {entry.want_to_buy && (
                <View style={styles.flag}>
                  <Text style={styles.flagEmoji}>🛒</Text>
                  <Text style={styles.flagText}>Would buy a bottle</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Footer */}
        <Divider />
        <View style={styles.footer}>
          {entry.location_name ? (
            <Text style={styles.footerMeta}>📍 {entry.location_name}</Text>
          ) : null}
          <Text style={styles.footerMeta}>
            {new Date(entry.tasting_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text style={styles.watermark}>Pour Across America</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: Colors.border,
    ...Shadows.md,
  },

  // Label photo
  labelPhotoWrap: {
    width: '100%',
    height: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  labelPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surfaceAlt,
  },
  labelPhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Header
  header: {
    backgroundColor: Colors.white,
  },
  colorBand: {
    height: 8,
    backgroundColor: Colors.gold,
  },
  headerContent: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: 4,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  originRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  originText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.inkMuted,
    flex: 1,
  },
  vintagePill: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  vintageText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  pricePill: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  priceText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  wineName: {
    fontFamily: Fonts.playfair,
    fontSize: 26,
    color: Colors.ink,
    lineHeight: 32,
  },
  producer: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.inkMuted,
  },
  appellation: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  scoreSub: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
    marginTop: 2,
  },

  // Body sections
  body: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 0,
  },

  // Pills
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pill: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  pillText: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMid,
  },

  // Pairings
  pairingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  pairingItem: {
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  pairingEmoji: {
    fontSize: 26,
  },
  pairingLabel: {
    fontFamily: Fonts.dmSans,
    fontSize: 10,
    color: Colors.inkMuted,
    textAlign: 'center',
  },

  // Flags
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  flagEmoji: { fontSize: 14 },
  flagText: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
  },

  // Grape blend list
  blendList: {
    gap: 10,
  },
  blendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  blendBarWrap: {
    flex: 1,
    gap: 4,
  },
  blendName: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.ink,
  },
  blendTrack: {
    height: 5,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  blendFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
  },
  blendPct: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.gold,
    width: 38,
    textAlign: 'right',
  },
  blendIncompleteRow: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.redLight,
    borderRadius: Radius.sm,
  },
  blendIncompleteText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.red,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: 4,
    alignItems: 'center',
  },
  footerMeta: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  watermark: {
    fontFamily: Fonts.playfairItalic,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 0.5,
    marginTop: 6,
  },
});

const vivinoPopoverStyles = StyleSheet.create({
  description: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.inkMid,
    lineHeight: 21,
  },
});
