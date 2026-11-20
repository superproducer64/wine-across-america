// Pure inner-ring layout math for AromaDonutChart, split out from the
// component so the "inner ring always renders all 14 fixed categories,
// never reflowing to fewer wedges" invariant can be unit-tested without
// rendering SVG/React Native.
import { AROMA_CATEGORIES } from '../../types';
import { Colors } from '../../theme';

// Angular gap (degrees) between adjacent wedges on both rings.
export const RING_GAP = 0.8;

// Curated per-category accent colors — each of the 14 categories gets its
// own distinct hue (not shared across a parent group) so adjacent wedges,
// including the Other → Citrus wrap, never read as the same color. Outer-
// ring items are tints of their category's color, which keeps the grouping
// cue intact.
export const CAT_TO_COLOR: Record<string, string> = {
  'citrus':          '#B89B3D',
  'orchard-fruit':   '#739442',
  'stone-fruit':     '#CB804D',
  'tropical-fruit':  '#A0B54A',
  'red-fruit':       '#B83D52',
  'black-fruit':     '#59346F',
  'floral':          '#BA6DA1',
  'herbal-green':    '#5A8943',
  'spice':           '#9F4C38',
  'oak-toast':       '#7D693B',
  'earthy':          '#4D5738',
  'mineral':         '#5C8099',
  'sweet-ripe':      '#B86176',
  'other':           '#938776',
};

export type CategoryRingSlot = {
  catId: string;
  label: string;
  emoji: string;
  color: string;
  selected: boolean;
  mid: number;
  sweep: number;
};

// Builds the inner ring's 14 fixed category slots, always all 14 in
// Appendix I order, at fixed equal-width angular positions. `aromasL1` only
// determines each slot's `selected` flag — it never changes how many slots
// exist or how wide any of them are, so `sweep` (and therefore every slot's
// position) is identical no matter which or how many categories are
// selected, including zero.
export function buildCategoryRingSlots(aromasL1: string[]): CategoryRingSlot[] {
  const totalCats = AROMA_CATEGORIES.length;
  const dataSpan = 360 - RING_GAP * totalCats;
  const sweep = totalCats > 0 ? dataSpan / totalCats : 0;
  let angle = 0;
  return AROMA_CATEGORIES.map(cat => {
    const mid = angle + sweep / 2;
    angle += sweep + RING_GAP;
    return {
      catId: cat.id,
      label: cat.label,
      emoji: cat.emoji,
      color: CAT_TO_COLOR[cat.id] ?? Colors.gold,
      selected: aromasL1.includes(cat.id),
      mid,
      sweep,
    };
  });
}

// ─── Outer-ring (aroma) label sizing ──────────────────────────────────────────
// Pure so the "drop the text rather than render illegible text" fallback can
// be unit-tested without rendering SVG.

// Average glyph advance for DM Sans, as a fraction of font size — used to
// estimate a line's rendered width from character count alone.
export const CHAR_WIDTH_RATIO = 0.56;

// Minimum legible font size for outer-ring aroma labels. If a selected
// label's tangential room would force it below this, its TEXT is dropped
// (the wedge itself stays visible/coloured).
export const MIN_OUTER_FONT = 5.5;

// Hard-truncates a label to `maxChars`, replacing the tail with an ellipsis.
export function truncateLabel(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label;
  if (maxChars <= 1) return `${label.slice(0, 1)}…`;
  return `${label.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Tangential room (degrees) each slot's label may use. `flags[i]` = aroma i
 * of a category is selected. A selected label may extend symmetrically into
 * its unselected neighbours: all of the free run up to the category edge, but
 * only HALF of the free run toward another selected aroma (the other half
 * belongs to that neighbour), so two labels can never claim the same wedge.
 * Unselected slots just return their own width.
 */
export function computeLabelSweeps(flags: boolean[], perNote: number, gap: number): number[] {
  const n = flags.length;
  return flags.map((on, i) => {
    if (!on) return perNote;
    const side = (dir: 1 | -1): number => {
      let free = 0;
      let j = i + dir;
      while (j >= 0 && j < n && !flags[j]) { free++; j += dir; }
      const bounded = j >= 0 && j < n; // stopped at another selected aroma
      return bounded ? free / 2 : free;
    };
    const ext = Math.min(side(1), side(-1));
    return perNote + 2 * ext * (perNote + gap);
  });
}

/**
 * Font size + text for one selected aroma label. Returns `text: null` when
 * its tangential room would force the font below MIN_OUTER_FONT — the caller
 * then draws the wedge with no label. Length-driven shrinking never drops a
 * label; if the label is too long for the radial band it is truncated.
 */
export function computeOuterLabel(
  base: number,
  label: string,
  sweepDeg: number,
  radius: number,
  radialBand: number,
): { fontSize: number; text: string | null } {
  let scale = 1;
  if (label.length > 16) scale = 0.72;
  else if (label.length > 11) scale = 0.86;

  const lineHeight = base * scale * 1.15;
  const tangentialAvailable = (sweepDeg * Math.PI / 180) * radius * 0.82;
  if (lineHeight > tangentialAvailable) {
    scale *= tangentialAvailable / lineHeight;
    if (base * scale < MIN_OUTER_FONT) {
      return { fontSize: MIN_OUTER_FONT, text: null };
    }
  }

  const fontSize = Math.max(MIN_OUTER_FONT, base * scale);
  const radialAvailable = radialBand * 0.86;
  const maxChars = Math.max(3, Math.floor(radialAvailable / (fontSize * CHAR_WIDTH_RATIO)));
  return { fontSize, text: truncateLabel(label, maxChars) };
}
