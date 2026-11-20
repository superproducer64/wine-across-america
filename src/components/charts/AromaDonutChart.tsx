import React, { useRef, useState, useEffect } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, PanResponder, Modal, Pressable, ScrollView, Platform } from 'react-native';
import Svg, { Path, Circle, Text as SvgText, G } from 'react-native-svg';
import { AROMA_CATEGORIES, getCategorySubcategories } from '@/types';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import {
  RING_GAP as GAP, CHAR_WIDTH_RATIO, buildCategoryRingSlots, computeOuterLabel, computeLabelSweeps,
} from './aromaRingLayout';

// ── Web-only portal overlay ──────────────────────────────────────────────────
// Renders directly into document.body so no RN stacking-context can trap it.
function WebAromaPopover({
  selected,
  onClose,
}: {
  selected: { color: string; title: string; subtitle?: string; items: string[] } | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || !selected || Platform.OS !== 'web') return null;

  let createPortal: (node: React.ReactNode, container: Element) => React.ReactPortal;
  try { createPortal = require('react-dom').createPortal; }
  catch { return null; }

  const accentRgb = selected.color;

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(31,21,24,0.58)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 32, zIndex: 99999, boxSizing: 'border-box',
  };
  const card: React.CSSProperties = {
    backgroundColor: '#FDFAF7', borderRadius: 20, overflow: 'hidden',
    maxWidth: 380, width: '100%',
    boxShadow: '0 12px 48px rgba(31,21,24,0.22)',
  };
  const header: React.CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '20px 20px 12px',
  };
  const pill: React.CSSProperties = {
    backgroundColor: accentRgb + '1E', borderRadius: 20,
    padding: '7px 14px', fontSize: 14, color: '#1F1518',
    fontFamily: 'system-ui, sans-serif',
  };
  const pillsWrap: React.CSSProperties = {
    display: 'flex', flexWrap: 'wrap', gap: 8,
    padding: '0 20px 16px', maxHeight: 240, overflowY: 'auto',
  };

  return createPortal(
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        {/* accent bar */}
        <div style={{ height: 5, backgroundColor: accentRgb }} />
        {/* header */}
        <div style={header}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Georgia,"Playfair Display",serif', fontSize: 20, color: '#1F1518', lineHeight: 1.35 }}>
              {selected.title}
            </div>
            {selected.subtitle ? (
              <div style={{ fontFamily: 'system-ui,sans-serif', fontSize: 13, color: '#9A8590', marginTop: 4 }}>
                {selected.subtitle}
              </div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 14, border: 'none',
              backgroundColor: '#F5EDE8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#9A8590', flexShrink: 0,
            }}
          >✕</button>
        </div>
        {/* divider */}
        <div style={{ height: 1, backgroundColor: accentRgb + '33', margin: '0 20px 12px' }} />
        {/* pills */}
        {selected.items.length > 0 && (
          <div style={pillsWrap}>
            {selected.items.map((item, i) => (
              <span key={i} style={pill}>{item}</span>
            ))}
          </div>
        )}
        {/* hint */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#C4B0B8', fontFamily: 'system-ui,sans-serif', paddingBottom: 14 }}>
          Click outside to close
        </div>
      </div>
    </div>,
    document.body,
  );
}

export interface AromaDonutChartProps {
  aromasL1: string[];
  aromasL2?: string[];
  size?: number;
  showLegend?: boolean;
  pinchable?: boolean;
}

// Module-level note→category lookup (built once)
const NOTE_TO_CATEGORY: Record<string, string> = {};
AROMA_CATEGORIES.forEach(cat => {
  [...cat.subcategories, ...(cat.sommelierSubcategories ?? [])].forEach(note => {
    NOTE_TO_CATEGORY[note.toLowerCase()] = cat.id;
  });
});

// Notes that only a Sommelier profile can select (the `s: true` items in
// AROMA_WHEEL) — presence of any one of these in an entry's aromas_l2 proves
// the entrant had Sommelier access when the wine was logged, since Explorer
// users are never shown these options at entry time (see Step3Aromas).
const SOMMELIER_ONLY_NOTES = new Set<string>();
AROMA_CATEGORIES.forEach(cat => {
  (cat.sommelierSubcategories ?? []).forEach(note => SOMMELIER_ONLY_NOTES.add(note.toLowerCase()));
});

function lightenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${[r, g, b]
    .map(c => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0'))
    .join('')}`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  start: number, end: number,
): string {
  if (end - start < 0.1) return '';
  const s1 = polar(cx, cy, outerR, start);
  const e1 = polar(cx, cy, outerR, end);
  const s2 = polar(cx, cy, innerR, end);
  const e2 = polar(cx, cy, innerR, start);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x.toFixed(2)} ${e1.y.toFixed(2)}`,
    `L ${s2.x.toFixed(2)} ${s2.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${e2.x.toFixed(2)} ${e2.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// Radial ("spoke") rotation — text runs along the radius, in/out from
// center, instead of curving along the arc. Used by both rings so a
// label's readable length is bound by the ring's radial WIDTH rather than
// the (often much narrower, and wedge-count-dependent) arc length of an
// individual wedge — this is what keeps category labels from colliding
// with their neighbors as more categories get selected.
function spokeLabelRot(midAngle: number): number {
  let r = midAngle - 90;
  r = ((r % 360) + 360) % 360;
  if (r > 180) r -= 360;
  if (r > 90) r -= 180;
  if (r < -90) r += 180;
  return r;
}

// Splits a category label into spoke-stacked lines instead of abbreviating.
// "Herbal / Green" → ["Herbal /", "Green"]; two-word labels split on the
// space ("Orchard Fruit" → ["Orchard", "Fruit"]); single-word labels are
// left on one line.
function splitCategoryLabel(label: string): string[] {
  if (label.includes(' / ')) {
    const [a, b] = label.split(' / ');
    return [`${a} /`, b];
  }
  const words = label.split(' ');
  if (words.length > 1) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  return [label];
}

// Per-category label font size. Labels read radially (outward from center),
// so a line's rendered LENGTH must fit the ring's radial band (catEdge -
// holeR) — that's what `radialBand` checks below, and it's the actual
// binding constraint for a long single-word label like "Mineral": the ring
// gives every category the same angular wedge (see `perCat` above, which
// has no dependence on item count), so a 7-letter unsplit word needs more
// radial room than a 6-letter one even after the coarse length-based scale,
// and nothing previously measured that directly. Two-line labels are also
// checked tangentially (how much arc the wedge itself gives before the
// stacked lines bleed into a neighbor) — only over either limit does a
// label shrink, and only that one label, not the whole ring.
function categoryLabelFontSize(base: number, lines: string[], sweepDeg: number, radius: number, radialBand: number): number {
  const maxLineLen = Math.max(...lines.map(l => l.length));
  let scale = 1;
  if (maxLineLen > 7) scale = 0.80;
  else if (maxLineLen > 6) scale = 0.90;

  const lineHeight = base * scale * 1.15;
  const stackNeeded = lines.length * lineHeight;
  const stackAvailable = (sweepDeg * Math.PI / 180) * radius * 0.82;
  if (stackNeeded > stackAvailable) scale *= Math.max(stackAvailable / stackNeeded, 0.6);

  const radialAvailable = radialBand * 0.86;
  const radialNeeded = maxLineLen * base * scale * CHAR_WIDTH_RATIO;
  if (radialNeeded > radialAvailable) scale *= Math.max(radialAvailable / radialNeeded, 0.55);

  return Math.max(6, base * scale);
}

type SelectedInfo = {
  color: string;
  title: string;
  subtitle?: string;
  items: string[];
} | null;

export function AromaDonutChart({
  aromasL1,
  aromasL2 = [],
  size = 260,
  showLegend = true,
  pinchable = false,
}: AromaDonutChartProps) {
  const [selected, setSelected] = useState<SelectedInfo>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scaleRef = useRef(1);
  const panAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panRef = useRef({ x: 0, y: 0 });
  const lastDistRef = useRef<number | null>(null);
  const lastSingleRef = useRef<{ x: number; y: number } | null>(null);

  if (!aromasL1.length) return null;

  const cx = size / 2;
  const cy = size / 2;
  // Margin beyond the ring's outer edge — radial outer-ring labels extend
  // outward past outerR into this space, so it needs to be generous enough
  // that long names don't get clipped by the SVG canvas edge.
  const margin = Math.max(16, size * 0.1);
  const outerR = size / 2 - margin;

  // Determine valid L2 notes (must match a selected L1 category)
  const noteToCat: Record<string, string> = {};
  aromasL2.forEach(note => {
    const catId = NOTE_TO_CATEGORY[note.toLowerCase()];
    if (catId && aromasL1.includes(catId)) noteToCat[note] = catId;
  });
  const showItems = size >= 120;

  // Whether this entry was logged under a Sommelier profile — determines
  // which fixed descriptor list (and therefore slot count) each category's
  // outer ring divides into. See SOMMELIER_ONLY_NOTES above.
  const isSommelierEntry = Object.keys(noteToCat).some(
    note => SOMMELIER_ONLY_NOTES.has(note.toLowerCase())
  );

  // Ring boundary radii — center hole, category ring, items ring
  const holeR    = outerR * (showItems ? 0.30 : 0.40);
  const catEdge  = showItems ? outerR * 0.58 : outerR;

  // Inner ring always renders all 14 fixed categories (Appendix I order) at
  // their fixed positions, regardless of selection — it must never reflow to
  // fewer wedges, and every wedge renders identically (full color, full
  // label) whether or not it has selections. `selected` only gates what
  // shows up on the OUTER ring and in the legend/center count — it has no
  // effect on the inner ring's own appearance.
  // `ringSlots` is the fixed, selection-independent geometry (always 14
  // slots, same order, same width) — see aromaRingLayout.ts. It's index-
  // aligned with AROMA_CATEGORIES, so category objects (needed below for
  // getCategorySubcategories) are looked up by position, not by filtering.
  const ringSlots = buildCategoryRingSlots(aromasL1);
  type CatData = { cat: typeof AROMA_CATEGORIES[0]; notes: string[]; color: string; selected: boolean; mid: number; sweep: number };
  const catDatas: CatData[] = ringSlots.map((slot, i) => ({
    cat: AROMA_CATEGORIES[i],
    notes: aromasL2.filter(n => noteToCat[n] === slot.catId),
    color: slot.color,
    selected: slot.selected,
    mid: slot.mid,
    sweep: slot.sweep,
  }));
  const selectedCatDatas = catDatas.filter(cd => cd.selected);

  // Segment types — rMin/rMax enable coordinate-based hit testing
  type CatSeg   = { path: string; color: string; mid: number; sweep: number; rMin: number; rMax: number; catId: string; label: string; emoji: string; notes: string[] };
  type ItemSeg  = { path: string; color: string; mid: number; sweep: number; labelSweep: number; selected: boolean; rMin: number; rMax: number; note: string; catId: string };

  const catSegs: CatSeg[] = [];
  const itemSegs: ItemSeg[] = [];

  catDatas.forEach(cd => {
    const cStart = cd.mid - cd.sweep / 2;
    const cEnd = cd.mid + cd.sweep / 2;

    catSegs.push({
      path: arcPath(cx, cy, catEdge, holeR, cStart, cEnd),
      color: cd.color,
      mid: cd.mid,
      sweep: cd.sweep,
      rMin: holeR, rMax: catEdge,
      catId: cd.cat.id,
      label: cd.cat.label,
      emoji: cd.cat.emoji,
      notes: cd.notes,
    });

    if (showItems && cd.selected) {
      // Fixed, ordered list of every descriptor this category can possibly
      // have — the outer ring always divides into this many slots, not
      // however many happen to be selected. EVERY slot draws its wedge in the
      // category's color (so the wheel reads as a full wheel), but only the
      // aromas actually selected on this wine are emphasised, tappable and
      // labelled — unselected wedges stay a pale, label-less tint.
      const allSlots = getCategorySubcategories(cd.cat, isSommelierEntry);
      const noteSpan = cd.sweep - GAP * allSlots.length;
      const perNote = noteSpan / allSlots.length;
      const flags = allSlots.map(note => cd.notes.includes(note));
      // A selected label may borrow room from unselected neighbours.
      const labelSweeps = computeLabelSweeps(flags, perNote, GAP);
      let nAngle = cStart;
      allSlots.forEach((note, si) => {
        const on = flags[si];
        itemSegs.push({
          path: arcPath(cx, cy, outerR, catEdge + 1, nAngle, nAngle + perNote),
          color: on
            ? (si % 2 === 0 ? lightenHex(cd.color, 0.30) : lightenHex(cd.color, 0.16))
            : lightenHex(cd.color, 0.78),
          mid: nAngle + perNote / 2,
          sweep: perNote,
          labelSweep: labelSweeps[si],
          selected: on,
          rMin: catEdge + 1, rMax: outerR,
          note,
          catId: cd.cat.id,
        });
        nAngle += perNote + GAP;
      });
    }
  });

  const catFontSize   = Math.max(7, Math.min(11, size * 0.042));
  const itemFontSize  = Math.max(6, Math.min(9,  size * 0.034));
  const centerLabel    = `${selectedCatDatas.length} aroma${selectedCatDatas.length !== 1 ? 's' : ''}`;

  // ── Coordinate-based tap detection ────────────────────────────────────────
  // Works on all platforms including mobile Safari (SVG onPress is unreliable
  // on iOS browser). We put a single Pressable over the wheel and use
  // angle + radius math to identify which segment was tapped.
  const inSweep = (angle: number, mid: number, sweep: number) => {
    const half  = sweep / 2;
    const start = ((mid - half) % 360 + 360) % 360;
    const end   = ((mid + half) % 360 + 360) % 360;
    const a     = ((angle)      % 360 + 360) % 360;
    return start <= end ? a >= start && a <= end : a >= start || a <= end;
  };

  const handleSvgTap = (lx: number, ly: number) => {
    const dx = lx - cx;
    const dy = ly - cy;
    const r  = Math.sqrt(dx * dx + dy * dy);
    if (r < holeR || r > outerR + 4) return; // inside hole or outside wheel
    // Convert to 0=top, clockwise angle matching our polar() convention
    const a = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;

    // Items ring (most specific — check first)
    if (showItems) {
      const hit = itemSegs.find(s => s.selected && r >= s.rMin && r <= s.rMax && inSweep(a, s.mid, s.sweep));
      if (hit) {
        const cat = AROMA_CATEGORIES.find(x => x.id === hit.catId);
        setSelected({ color: hit.color, title: `${cat?.emoji ?? ''} ${cat?.label ?? ''}`, items: [hit.note] });
        return;
      }
    }
    // Category ring
    const hitCat = catSegs.find(s => r >= s.rMin && r <= s.rMax && inSweep(a, s.mid, s.sweep));
    if (hitCat) {
      setSelected({ color: hitCat.color, title: `${hitCat.emoji} ${hitCat.label}`, items: hitCat.notes });
    }
  };

  // Pinch-to-zoom + 1-finger pan (native only)
  const panResponder = pinchable ? PanResponder.create({
    // Immediately claim 2-finger touches; let taps pass through on start
    onStartShouldSetPanResponder: e => e.nativeEvent.touches.length === 2,
    // Claim 1-finger moves only when already zoomed in
    onMoveShouldSetPanResponder: e => {
      const t = e.nativeEvent.touches;
      return t.length === 2 || (t.length === 1 && scaleRef.current > 1.05);
    },
    onPanResponderMove: e => {
      const t = e.nativeEvent.touches;
      if (t.length === 2) {
        // Pinch — update scale
        const dx = t[0].pageX - t[1].pageX;
        const dy = t[0].pageY - t[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastDistRef.current !== null) {
          scaleRef.current = Math.min(Math.max(scaleRef.current * (dist / lastDistRef.current), 0.7), 3.5);
          scaleAnim.setValue(scaleRef.current);
          // Reset translation when zoomed fully back out
          if (scaleRef.current <= 1) {
            panRef.current = { x: 0, y: 0 };
            panAnim.setValue({ x: 0, y: 0 });
          }
        }
        lastDistRef.current = dist;
        lastSingleRef.current = null;
      } else if (t.length === 1 && scaleRef.current > 1.05) {
        // 1-finger pan — only when zoomed in
        const touch = { x: t[0].pageX, y: t[0].pageY };
        if (lastSingleRef.current !== null) {
          panRef.current = {
            x: panRef.current.x + (touch.x - lastSingleRef.current.x),
            y: panRef.current.y + (touch.y - lastSingleRef.current.y),
          };
          panAnim.setValue(panRef.current);
        }
        lastSingleRef.current = touch;
      }
    },
    onPanResponderRelease: () => {
      lastDistRef.current = null;
      lastSingleRef.current = null;
    },
    onPanResponderTerminate: () => {
      lastDistRef.current = null;
      lastSingleRef.current = null;
    },
  }) : { panHandlers: {} };

  return (
    <View style={styles.wrapper}>
      {/* ── Wheel ── */}
      <Animated.View
        {...(pinchable ? panResponder.panHandlers : {})}
        style={{ transform: [{ scale: scaleAnim }, { translateX: panAnim.x }, { translateY: panAnim.y }] }}
      >
        {/* Single Pressable over the whole wheel — coordinate hit-testing handles
            which segment was tapped. This is the only reliable approach on
            mobile Safari where SVG path onPress events are not fired. */}
        <Pressable
          onPress={e => handleSvgTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          style={{ width: size, height: size }}
        >
        <Svg width={size} height={size} pointerEvents="none">
          {/* Outer ring — specific notes actually selected (L2) */}
          {itemSegs.map((s, i) => (
            <Path
              key={`n${i}`}
              d={s.path}
              fill={s.color}
            />
          ))}

          {/* Inner ring — all 14 fixed categories (L1), rendered identically
               regardless of selection. */}
          {catSegs.map((s, i) => (
            <Path
              key={`c${i}`}
              d={s.path}
              fill={s.color}
            />
          ))}

          {/* Center hole */}
          <Circle cx={cx} cy={cy} r={holeR - 2} fill="white" />
          <SvgText
            x={cx} y={cy - holeR * 0.06}
            textAnchor="middle"
            fontSize={holeR * 0.62}
            fill="#1F1518"
          >
            🍷
          </SvgText>
          <SvgText
            x={cx} y={cy + holeR * 0.44}
            textAnchor="middle"
            fontSize={Math.max(6, holeR * 0.26)}
            fontFamily={Fonts.dmSans}
            fill="#9A8590"
          >
            {centerLabel}
          </SvgText>

          {/* Category ring text labels — radial/spoke orientation, matching
               the outer ring. Full names, wrapped to two lines rather than
               abbreviated; font size only shrinks for a wedge too narrow to
               fit two lines at the shared size. */}
          {catSegs.map((s, i) => {
            if (s.sweep < 10) return null;
            const tr = (holeR + catEdge) / 2;
            const pos = polar(cx, cy, tr, s.mid);
            const rot = spokeLabelRot(s.mid);
            const lines = splitCategoryLabel(s.label);
            const fontSize = categoryLabelFontSize(catFontSize, lines, s.sweep, tr, catEdge - holeR);
            const lineHeight = fontSize * 1.15;
            return (
              <G key={`cl${i}`} transform={`translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) rotate(${rot})`}>
                {lines.map((line, li) => (
                  <SvgText
                    key={li}
                    y={(li - (lines.length - 1) / 2) * lineHeight}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontSize={fontSize}
                    fontFamily={Fonts.dmSansMedium}
                    fill="white"
                    fillOpacity={0.95}
                  >
                    {line}
                  </SvgText>
                ))}
              </G>
            );
          })}

          {/* Items ring text labels — ONLY for aromas actually selected on this
               wine. Unselected wedges carry no text. If a selected label still
               can't fit at MIN_OUTER_FONT, its text is dropped (wedge stays). */}
          {showItems && itemSegs.map((s, i) => {
            if (!s.selected || s.sweep < 2) return null;
            const tr = (catEdge + outerR) / 2;
            const pos = polar(cx, cy, tr, s.mid);
            const rot = spokeLabelRot(s.mid);
            const { fontSize, text } = computeOuterLabel(itemFontSize, s.note, s.labelSweep, tr, outerR - catEdge);
            if (text === null) return null;
            return (
              <G key={`il${i}`} transform={`translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) rotate(${rot})`}>
                <SvgText
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontSize={fontSize}
                  fontFamily={Fonts.dmSans}
                  fill="#1F1518"
                  fillOpacity={0.85}
                >
                  {text}
                </SvgText>
              </G>
            );
          })}
        </Svg>
        </Pressable>
      </Animated.View>

      {/* ── Segment Detail Popover ── */}
      {/* Web: portal renders at document.body — escapes all RN stacking contexts */}
      {Platform.OS === 'web' && (
        <WebAromaPopover selected={selected} onClose={() => setSelected(null)} />
      )}
      {/* Native: true Modal overlay */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={selected !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setSelected(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
            <Pressable style={styles.popover} onPress={() => {}}>
              <View style={[styles.accentBar, { backgroundColor: selected?.color ?? Colors.gold }]} />
              <View style={styles.popoverHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.popoverTitle}>{selected?.title}</Text>
                  {selected?.subtitle ? <Text style={styles.popoverSub}>{selected.subtitle}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={styles.popoverClose} hitSlop={8}>
                  <Text style={styles.popoverCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.popoverDivider, { backgroundColor: selected?.color ? selected.color + '30' : Colors.border }]} />
              {(selected?.items ?? []).length > 0 && (
                <ScrollView style={styles.popoverScroll} showsVerticalScrollIndicator={false} bounces={false}>
                  <View style={styles.popoverPills}>
                    {(selected?.items ?? []).map((item, i) => (
                      <View key={i} style={[styles.popoverPill, { backgroundColor: selected?.color ? selected.color + '18' : Colors.goldPale }]}>
                        <Text style={styles.popoverPillText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
              <Text style={styles.popoverHint}>Tap outside to close</Text>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Legend ── */}
      {showLegend && (
        <View style={styles.legend}>
          {selectedCatDatas.map(cd => (
            <View key={cd.cat.id} style={styles.legendCatRow}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: cd.color }]} />
                <Text style={[styles.legendCatName, { color: cd.color }]}>
                  {cd.cat.emoji} {cd.cat.label}
                </Text>
              </View>
              {cd.notes.length > 0 && (
                <Text style={styles.legendSubcats}>{cd.notes.join(' · ')}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 12,
  },

  // Segment detail popover
  webBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31,21,24,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    zIndex: 9999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(31,21,24,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  popover: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: Colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  accentBar: {
    height: 5,
    width: '100%',
  },
  popoverHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 10,
  },
  popoverTitle: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 20,
    color: Colors.ink,
    lineHeight: 26,
  },
  popoverSub: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMuted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  popoverClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  popoverCloseText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.inkMuted,
  },
  popoverDivider: {
    height: 1,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  popoverScroll: {
    maxHeight: 220,
    paddingHorizontal: Spacing.lg,
  },
  popoverPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: Spacing.md,
  },
  popoverPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  popoverPillText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
    letterSpacing: 0.1,
  },
  popoverHint: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 11,
    color: Colors.inkFaint,
    textAlign: 'center',
    paddingBottom: Spacing.md,
    paddingTop: 2,
  },

  // Legend
  legend: {
    width: '100%',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendCatRow: {
    gap: 1,
  },
  legendCatName: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
  },
  legendSubcats: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 10,
    color: Colors.inkMuted,
    paddingLeft: 14,
    lineHeight: 15,
  },
});
