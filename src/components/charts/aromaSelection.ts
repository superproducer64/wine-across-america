// Pure selection logic for the aroma drill-down picker. Reads and writes the
// SAME fields the rest of the app already uses — `aromas_l1` (category ids)
// and `aromas_l2` (aroma names) on the entry draft / wine_entries row — so
// there is exactly one source of truth for a wine's selected aromas.
import { AromaCategory } from '../../types';

export type AromaSelection = { aromasL1: string[]; aromasL2: string[] };

function allNotes(cat: AromaCategory): string[] {
  return [...cat.subcategories, ...(cat.sommelierSubcategories ?? [])];
}

/** How many of a category's aromas are selected. */
export function categoryNoteCount(cat: AromaCategory, aromasL2: string[]): number {
  const notes = new Set(allNotes(cat));
  return aromasL2.filter(n => notes.has(n)).length;
}

/**
 * Toggle one aroma. Keeps `aromas_l1` in step: selecting the first aroma in a
 * category adds the category id; deselecting its last aroma removes it, so the
 * wine card (which gates the outer ring on aromas_l1) always matches.
 */
export function toggleAroma(
  sel: AromaSelection,
  cat: AromaCategory,
  note: string,
): AromaSelection {
  const on = sel.aromasL2.includes(note);
  const l2 = on ? sel.aromasL2.filter(n => n !== note) : [...sel.aromasL2, note];
  const remaining = categoryNoteCount(cat, l2);
  let l1 = sel.aromasL1;
  if (!on && !l1.includes(cat.id)) l1 = [...l1, cat.id];
  if (on && remaining === 0) l1 = l1.filter(id => id !== cat.id);
  return { aromasL1: l1, aromasL2: l2 };
}

/** Remove a category and every aroma selected under it. */
export function clearCategory(sel: AromaSelection, cat: AromaCategory): AromaSelection {
  const notes = new Set(allNotes(cat));
  return {
    aromasL1: sel.aromasL1.filter(id => id !== cat.id),
    aromasL2: sel.aromasL2.filter(n => !notes.has(n)),
  };
}
