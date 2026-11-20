import React, { useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, useWindowDimensions, LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AROMA_CATEGORIES, getCategorySubcategories } from '@/types';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { CAT_TO_COLOR } from './aromaRingLayout';
import {
  arcPath, polar, spokeLabelRot, lightenHex, splitLabelTwoLines, fitSectorLabel, sectorIndexAt,
} from './wheelGeometry';
import { categoryNoteCount, toggleAroma, clearCategory } from './aromaSelection';

// Drill-down aroma picker. Master wheel = the app's aroma categories
// (AROMA_CATEGORIES, the same list the wine-card wheel and the stored
// `aromas_l1` ids use); tapping one opens a full-screen wheel of just that
// category's aromas. Reads/writes the existing `aromas_l1` / `aromas_l2`
// fields via `onChange` — no separate state of its own beyond which category
// is open.

const SECTOR_GAP = 1.2;

type Sector = {
  key: string;
  label: string;
  fill: string;
  fillOpacity: number;
  textColor: string;
  badge?: string;
};

function SectorWheel({
  size, sectors, holeRatio, maxFont, centerTitle, centerSub, onPressSector,
}: {
  size: number;
  sectors: Sector[];
  holeRatio: number;
  maxFont: number;
  centerTitle: string;
  centerSub: string;
  onPressSector: (index: number) => void;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * holeRatio;
  const n = sectors.length;
  const step = 360 / n;
  const tr = (innerR + outerR) / 2;
  const arcLen = ((step - SECTOR_GAP) * Math.PI / 180) * tr;

  return (
    <Pressable
      style={{ width: size, height: size }}
      onPress={e => {
        const i = sectorIndexAt(e.nativeEvent.locationX, e.nativeEvent.locationY, cx, cy, innerR, outerR, n);
        if (i !== null) onPressSector(i);
      }}
    >
      <Svg width={size} height={size} pointerEvents="none">
        {sectors.map((s, i) => (
          <Path
            key={s.key}
            d={arcPath(cx, cy, outerR, innerR, i * step + SECTOR_GAP / 2, (i + 1) * step - SECTOR_GAP / 2)}
            fill={s.fill}
            fillOpacity={s.fillOpacity}
          />
        ))}
        <Circle cx={cx} cy={cy} r={innerR - 3} fill="white" />
        <SvgText
          x={cx} y={cy + innerR * 0.08} textAnchor="middle"
          fontSize={innerR * 0.62} fontFamily={Fonts.playfair} fill="#1F1518"
        >
          {centerTitle}
        </SvgText>
        <SvgText
          x={cx} y={cy + innerR * 0.5} textAnchor="middle"
          fontSize={Math.max(9, innerR * 0.2)} fontFamily={Fonts.dmSans} fill="#9A8590"
        >
          {centerSub}
        </SvgText>
        {sectors.map((s, i) => {
          const mid = i * step + step / 2;
          const pos = polar(cx, cy, tr - (s.badge ? 6 : 0), mid);
          const lines = splitLabelTwoLines(s.label);
          const font = fitSectorLabel(lines, outerR - innerR - (s.badge ? 20 : 0), arcLen, maxFont, 9);
          const lh = font * 1.15;
          return (
            <G key={`l${s.key}`}>
              <G transform={`translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) rotate(${spokeLabelRot(mid).toFixed(1)})`}>
                {lines.map((line, li) => (
                  <SvgText
                    key={li}
                    y={(li - (lines.length - 1) / 2) * lh}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontSize={font}
                    fontFamily={Fonts.dmSansMedium}
                    fill={s.textColor}
                  >
                    {line}
                  </SvgText>
                ))}
              </G>
              {s.badge ? (() => {
                const b = polar(cx, cy, outerR - 13, mid);
                return (
                  <G>
                    <Circle cx={b.x} cy={b.y} r={10} fill="white" />
                    <SvgText
                      x={b.x} y={b.y} textAnchor="middle" alignmentBaseline="central"
                      fontSize={11} fontFamily={Fonts.dmSansMedium} fill={s.fill}
                    >
                      {s.badge}
                    </SvgText>
                  </G>
                );
              })() : null}
            </G>
          );
        })}
      </Svg>
    </Pressable>
  );
}

export interface AromaDrilldownPickerProps {
  aromasL1: string[];
  aromasL2: string[];
  /** Sommelier profiles also get the s:true aromas, same as the old list. */
  isSommelier: boolean;
  /** Omit (or pass readOnly) to show the wheel as a display only. */
  onChange?: (aromasL1: string[], aromasL2: string[]) => void;
  /** Display only: tapping a category still opens it, but aromas can't be toggled. */
  readOnly?: boolean;
  /** Fixed wheel diameter; otherwise fits the container width (max 440). */
  size?: number;
}

export function AromaDrilldownPicker({ aromasL1, aromasL2, isSommelier, onChange, readOnly = false, size }: AromaDrilldownPickerProps) {
  const editable = !readOnly && !!onChange;
  const [openCatId, setOpenCatId] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const sel = { aromasL1, aromasL2 };
  const openCat = AROMA_CATEGORIES.find(c => c.id === openCatId) ?? null;
  const masterSize = size ?? Math.min(width || win.width - 2 * Spacing.xl, 440);

  const masterSectors: Sector[] = AROMA_CATEGORIES.map(cat => {
    const color = CAT_TO_COLOR[cat.id];
    const count = categoryNoteCount(cat, aromasL2);
    const active = count > 0 || aromasL1.includes(cat.id);
    return {
      key: cat.id,
      label: cat.label,
      fill: color,
      fillOpacity: active ? 1 : 0.22,
      textColor: active ? '#FFFFFF' : '#1F1518',
      badge: count > 0 ? String(count) : undefined,
    };
  });

  const detailSize = Math.max(240, Math.min(win.width - 2 * Spacing.lg, win.height - insets.top - insets.bottom - 190, 560));
  const detailNotes = openCat ? getCategorySubcategories(openCat, isSommelier) : [];
  const detailColor = openCat ? CAT_TO_COLOR[openCat.id] : Colors.gold;
  const detailSectors: Sector[] = detailNotes.map(note => {
    const on = aromasL2.includes(note);
    return {
      key: note,
      label: note,
      fill: on ? detailColor : lightenHex(detailColor, 0.72),
      fillOpacity: 1,
      textColor: on ? '#FFFFFF' : '#1F1518',
      badge: on ? '✓' : undefined,
    };
  });

  const close = () => setOpenCatId(null);

  return (
    <View
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <SectorWheel
        size={masterSize}
        sectors={masterSectors}
        holeRatio={0.28}
        maxFont={14}
        centerTitle={String(aromasL2.length)}
        centerSub={aromasL2.length === 1 ? 'aroma' : 'aromas'}
        onPressSector={i => setOpenCatId(AROMA_CATEGORIES[i].id)}
      />

      <Modal
        visible={openCat !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={close}
      >
        {openCat && (
          <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
              <Pressable onPress={close} hitSlop={10} style={styles.headerBtn}>
                <Text style={styles.backText}>‹ All categories</Text>
              </Pressable>
              {editable ? (
                <Pressable
                  onPress={() => {
                    const next = clearCategory(sel, openCat);
                    onChange!(next.aromasL1, next.aromasL2);
                  }}
                  hitSlop={10}
                  style={styles.headerBtn}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : <View />}
            </View>
            <Text style={[styles.title, { color: detailColor }]}>{openCat.emoji} {openCat.label}</Text>
            <Text style={styles.hint}>{editable ? 'Tap an aroma to select it. Tap again to remove.' : 'Highlighted aromas are the ones noted for this wine.'}</Text>
            <View style={styles.wheelWrap}>
              <SectorWheel
                size={detailSize}
                sectors={detailSectors}
                holeRatio={0.24}
                maxFont={16}
                centerTitle={String(categoryNoteCount(openCat, aromasL2))}
                centerSub="selected"
                onPressSector={i => {
                  if (!editable) return;
                  const next = toggleAroma(sel, openCat, detailNotes[i]);
                  onChange!(next.aromasL1, next.aromasL2);
                }}
              />
            </View>
            <Pressable style={[styles.doneBtn, { backgroundColor: detailColor }]} onPress={close}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', marginVertical: Spacing.md },
  modalRoot: { flex: 1, backgroundColor: Colors.surface, alignItems: 'center' },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerBtn: { paddingVertical: 6 },
  backText: { fontFamily: Fonts.dmSansMedium, fontSize: 15, color: Colors.ink },
  clearText: { fontFamily: Fonts.dmSansMedium, fontSize: 14, color: Colors.inkMuted },
  title: { fontFamily: Fonts.playfair, fontSize: 24, marginTop: Spacing.sm },
  hint: {
    fontFamily: Fonts.dmSans, fontSize: 12, color: Colors.inkMuted,
    marginTop: 2, marginBottom: Spacing.sm,
  },
  wheelWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneBtn: {
    alignSelf: 'stretch',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  doneText: { fontFamily: Fonts.dmSansMedium, fontSize: 15, color: '#FFFFFF' },
});
