// Pure geometry helpers for the aroma drill-down selector wheels. No React /
// react-native imports so they can be unit-tested with `tsx --test`.

export function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function arcPath(
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

// Text runs along the radius (spoke) and is flipped so it never reads
// upside-down.
export function spokeLabelRot(midAngle: number): number {
  let r = midAngle - 90;
  r = ((r % 360) + 360) % 360;
  if (r > 180) r -= 360;
  if (r > 90) r -= 180;
  if (r < -90) r += 180;
  return r;
}

export function lightenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${[r, g, b]
    .map(c => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0'))
    .join('')}`;
}

// Splits a label into at most two balanced lines. "Herbal / Green" →
// ["Herbal /", "Green"]; otherwise the word boundary that minimises the
// longer line.
export function splitLabelTwoLines(label: string): string[] {
  if (label.includes(' / ')) {
    const [a, b] = label.split(' / ');
    return [`${a} /`, b];
  }
  const words = label.split(' ');
  if (words.length < 2) return [label];
  let best = 1;
  let bestMax = Infinity;
  for (let i = 1; i < words.length; i++) {
    const m = Math.max(words.slice(0, i).join(' ').length, words.slice(i).join(' ').length);
    if (m < bestMax) { bestMax = m; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

const CHAR_WIDTH_RATIO = 0.56;

// Font size for a spoke label inside a sector: bounded by the radial band
// (length) and the sector's arc (stacked line thickness).
export function fitSectorLabel(
  lines: string[],
  band: number,
  arcLen: number,
  maxFont: number,
  minFont: number,
): number {
  const maxLen = Math.max(...lines.map(l => l.length), 1);
  const byBand = (band * 0.88) / (maxLen * CHAR_WIDTH_RATIO);
  const byArc = (arcLen * 0.8) / (lines.length * 1.15);
  return Math.max(minFont, Math.min(maxFont, byBand, byArc));
}

// Which of `n` equal sectors (0 = starting at 12 o'clock, clockwise) a point
// falls in, or null when it is inside the hole / outside the ring.
export function sectorIndexAt(
  lx: number, ly: number,
  cx: number, cy: number,
  innerR: number, outerR: number,
  n: number,
): number | null {
  const dx = lx - cx;
  const dy = ly - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r < innerR || r > outerR + 4 || n <= 0) return null;
  const a = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  return Math.min(n - 1, Math.floor(a / (360 / n)));
}
