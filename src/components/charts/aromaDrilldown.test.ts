import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AROMA_CATEGORIES } from '../../types';
import { toggleAroma, clearCategory, categoryNoteCount } from './aromaSelection';
import { sectorIndexAt, splitLabelTwoLines } from './wheelGeometry';
import { computeLabelSweeps, computeOuterLabel, RING_GAP } from './aromaRingLayout';

const citrus = AROMA_CATEGORIES.find(c => c.id === 'citrus')!;
const floral = AROMA_CATEGORIES.find(c => c.id === 'floral')!;

test('first aroma adds the category id to aromas_l1; last removal drops it', () => {
  let sel = { aromasL1: [] as string[], aromasL2: [] as string[] };
  sel = toggleAroma(sel, citrus, 'Lemon');
  assert.deepEqual(sel, { aromasL1: ['citrus'], aromasL2: ['Lemon'] });
  sel = toggleAroma(sel, citrus, 'Lime');
  assert.deepEqual(sel.aromasL1, ['citrus']);
  sel = toggleAroma(sel, citrus, 'Lemon');
  assert.deepEqual(sel, { aromasL1: ['citrus'], aromasL2: ['Lime'] });
  sel = toggleAroma(sel, citrus, 'Lime');
  assert.deepEqual(sel, { aromasL1: [], aromasL2: [] });
});

test('toggling in one category never touches another', () => {
  let sel = { aromasL1: ['floral'], aromasL2: ['Rose'] };
  sel = toggleAroma(sel, citrus, 'Lemon');
  assert.deepEqual(sel.aromasL1.sort(), ['citrus', 'floral']);
  assert.equal(categoryNoteCount(floral, sel.aromasL2), 1);
  assert.equal(categoryNoteCount(citrus, sel.aromasL2), 1);
});

test('clearCategory removes the id and only that category\'s aromas', () => {
  const sel = clearCategory({ aromasL1: ['citrus', 'floral'], aromasL2: ['Lemon', 'Rose'] }, citrus);
  assert.deepEqual(sel, { aromasL1: ['floral'], aromasL2: ['Rose'] });
});

test('sectorIndexAt maps angle/radius to sector, null in hole or outside', () => {
  // centre (100,100), ring 30..90, 4 sectors → 0 = top-right quadrant start at 12 o'clock
  assert.equal(sectorIndexAt(100, 40, 100, 100, 30, 90, 4), 0);   // straight up, just clockwise-of-0 → sector 0
  assert.equal(sectorIndexAt(160, 100, 100, 100, 30, 90, 4), 1);  // right
  assert.equal(sectorIndexAt(100, 160, 100, 100, 30, 90, 4), 2);  // down
  assert.equal(sectorIndexAt(40, 100, 100, 100, 30, 90, 4), 3);    // left
  assert.equal(sectorIndexAt(100, 100, 100, 100, 30, 90, 4), null); // hole
  assert.equal(sectorIndexAt(100, 300, 100, 100, 30, 90, 4), null); // outside
});

test('splitLabelTwoLines balances words', () => {
  assert.deepEqual(splitLabelTwoLines('Herbal / Green'), ['Herbal /', 'Green']);
  assert.deepEqual(splitLabelTwoLines('Starfruit (carambola)'), ['Starfruit', '(carambola)']);
  assert.deepEqual(splitLabelTwoLines('Lemon'), ['Lemon']);
});

test('label room: lone selected aroma gets the whole free run; adjacent ones split it', () => {
  const per = 2;
  const lone = computeLabelSweeps([false, false, false, true, false, false, false], per, RING_GAP);
  assert.ok(lone[3] > per * 5, 'centred lone label borrows 3 free slots each side');
  const pair = computeLabelSweeps([true, false, false, false, true], per, RING_GAP);
  // 3 free slots between two selected → each may use half (1.5 slots) on that side,
  // and its other side is the category edge (0 free) → symmetric ext = 0.
  assert.equal(pair[0], per);
  assert.equal(pair[4], per);
  const mid = computeLabelSweeps([false, true, false, false, false, true, false], per, RING_GAP);
  assert.ok(mid[1] > per && mid[5] > per, 'edge-adjacent room is shared, never double-claimed');
  assert.ok(mid[1] <= per + 2 * 1.5 * (per + RING_GAP) + 1e-9);
});

test('computeOuterLabel drops text (not font) when tangential room is below MIN_OUTER_FONT', () => {
  const tight = computeOuterLabel(7, 'Blackcurrant', 1, 50, 30);
  assert.equal(tight.text, null);
  const roomy = computeOuterLabel(7, 'Blackcurrant', 30, 50, 60);
  assert.equal(typeof roomy.text, 'string');
  assert.ok(roomy.fontSize >= 5.5);
});

test('every aroma name belongs to exactly one category (count/derivation is unambiguous)', () => {
  const seen = new Map<string, string>();
  for (const c of AROMA_CATEGORIES) {
    for (const n of [...c.subcategories, ...(c.sommelierSubcategories ?? [])]) {
      assert.ok(!seen.has(n), `${n} appears in ${seen.get(n)} and ${c.id}`);
      seen.set(n, c.id);
    }
  }
});
