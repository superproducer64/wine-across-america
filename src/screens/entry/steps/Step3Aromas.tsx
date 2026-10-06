import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput as RNTextInput,
} from 'react-native';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { useEntryDraftStore } from '@/stores/entryDraftStore';
import { useAuthStore } from '@/stores/authStore';
import {
  AROMA_CATEGORIES,
  AROMA_GROUPS,
  WINE_SHORTCUTS,
  WineShortcut,
  getCategorySubcategories,
} from '@/types';

import { useResponsive } from '@/hooks/useResponsive';

const CAT_TO_GROUP: Record<string, typeof AROMA_GROUPS[0]> = {};
AROMA_GROUPS.forEach(g => g.categoryIds.forEach(cid => { CAT_TO_GROUP[cid] = g; }));

const MAX_CUSTOM_TAGS = 20;
const MAX_TAG_LENGTH = 40;

export function Step3Aromas() {
  const {
    draft,
    setAromas,
    setAromasOtherNote,
    setCustomAromas,
    applyWineShortcut,
  } = useEntryDraftStore();
  const { profile } = useAuthStore();
  const { isWide } = useResponsive();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [activeShortcutId, setActiveShortcutId] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');

  // s:true aroma items are hidden from Explorer (enthusiast) and shown to
  // every Sommelier, regardless of application-approval status.
  const isSommelier = profile?.user_role === 'sommelier' && profile?.sommelier_status === 'approved';

  const addCustomTag = () => {
    const tag = customInput.trim();
    if (!tag || draft.custom_aromas.includes(tag) || draft.custom_aromas.length >= MAX_CUSTOM_TAGS) return;
    setCustomAromas([...draft.custom_aromas, tag.slice(0, MAX_TAG_LENGTH)]);
    setCustomInput('');
  };

  const removeCustomTag = (tag: string) => {
    setCustomAromas(draft.custom_aromas.filter((t) => t !== tag));
  };

  const toggleL1 = (id: string) => {
    const current = draft.aromas_l1;
    if (current.includes(id)) {
      const category = AROMA_CATEGORIES.find((c) => c.id === id);
      const allSubs = category ? getCategorySubcategories(category, true) : [];
      const l2Next = draft.aromas_l2.filter((a) => !allSubs.includes(a));
      setAromas(current.filter((a) => a !== id), l2Next);
      if (expandedCategory === id) setExpandedCategory(null);
      return;
    }
    setAromas([...current, id], draft.aromas_l2);
    setExpandedCategory(id);
    setActiveShortcutId(null);
  };

  const toggleL2 = (aroma: string) => {
    const current = draft.aromas_l2;
    setAromas(
      draft.aromas_l1,
      current.includes(aroma) ? current.filter((a) => a !== aroma) : [...current, aroma]
    );
    setActiveShortcutId(null);
  };

  const handleShortcut = (shortcut: WineShortcut) => {
    if (activeShortcutId === shortcut.id) {
      setAromas([], []);
      setActiveShortcutId(null);
    } else {
      applyWineShortcut(shortcut);
      setActiveShortcutId(shortcut.id);
      setExpandedCategory(null);
    }
  };

  const summaryPanel = (draft.aromas_l1.length > 0 || isWide) ? (
    <View style={[styles.summary, isWide && styles.summarySticky]}>
      <Text style={styles.summaryTitle}>
        {draft.aromas_l1.length > 0 ? 'Selected Aromas' : 'No aromas selected yet'}
      </Text>
      {draft.aromas_l1.length > 0 && (
        <>
          <Text style={styles.summaryText}>
            {draft.aromas_l1
              .map((id) => {
                const cat = AROMA_CATEGORIES.find((c) => c.id === id);
                return cat ? `${cat.emoji} ${cat.label}` : id;
              })
              .join(' · ')}
          </Text>
          {draft.aromas_l2.length > 0 && (
            <Text style={styles.summaryL2}>{draft.aromas_l2.join(' · ')}</Text>
          )}
          {draft.aromas_other_note ? (
            <Text style={styles.summaryL2}>✨ {draft.aromas_other_note}</Text>
          ) : null}
          {draft.custom_aromas.length > 0 && (
            <Text style={styles.summaryL2}>💭 {draft.custom_aromas.join(', ')}</Text>
          )}
        </>
      )}
      {draft.aromas_l1.length === 0 && (
        <Text style={styles.summaryHint}>
          Tap a category below to build your aroma profile.
        </Text>
      )}
    </View>
  ) : null;

  const categoriesPanel = (
    <>
      {/* Style Shortcuts */}
      <Text style={styles.sectionLabel}>Style Shortcuts</Text>
      <Text style={styles.shortcutHint}>
        Tap a style to auto-fill aromas and structure — adjust anything after.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shortcutScroll}>
        <View style={styles.shortcutRow}>
          {WINE_SHORTCUTS.map((shortcut) => {
            const active = activeShortcutId === shortcut.id;
            return (
              <Pressable
                key={shortcut.id}
                style={[styles.shortcutCard, active && styles.shortcutCardActive]}
                onPress={() => handleShortcut(shortcut)}
              >
                <Text style={styles.shortcutEmoji}>{shortcut.emoji}</Text>
                <Text style={[styles.shortcutName, active && styles.shortcutNameActive]} numberOfLines={2}>
                  {shortcut.name}
                </Text>
                <Text style={styles.shortcutStyle} numberOfLines={1}>
                  {shortcut.styleLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Flat category list in Appendix I order */}
      <View style={styles.groupsHeader}>
        <Text style={styles.sectionLabel}>Aroma Categories</Text>
        {isSommelier && (
          <View style={styles.sommelierModeBadge}>
            <Text style={styles.sommelierModeBadgeText}>🎓 Expanded</Text>
          </View>
        )}
      </View>

      <View style={styles.flatCatList}>
        {AROMA_CATEGORIES.map((cat) => {
          const group = CAT_TO_GROUP[cat.id];
          const color = group?.color ?? Colors.gold;
          const selected = draft.aromas_l1.includes(cat.id);
          const isExpanded = expandedCategory === cat.id;
          const subcategories = getCategorySubcategories(cat, isSommelier);

          return (
            <View key={cat.id} style={styles.categoryBlock}>
              <Pressable
                style={[
                  styles.catChip,
                  selected && { backgroundColor: color + '1A', borderColor: color },
                ]}
                onPress={() => toggleL1(cat.id)}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={[styles.catLabel, selected && { color: Colors.ink, fontFamily: Fonts.dmSansMedium }]}>
                  {cat.label}
                </Text>
                {selected && (
                  <Text style={[styles.catCheck, { color }]}>✓</Text>
                )}
              </Pressable>

              {/* L2 drill-down — inline below the chip when expanded */}
              {selected && isExpanded && (
                <View style={styles.l2Container}>
                  <View style={[styles.l2Indent, { borderLeftColor: color + '55' }]}>
                    <View style={styles.l2Grid}>
                      {subcategories.map((aroma) => {
                        const isSommelierSub =
                          isSommelier && (cat.sommelierSubcategories ?? []).includes(aroma);
                        const isSelected = draft.aromas_l2.includes(aroma);
                        return (
                          <Pressable
                            key={aroma}
                            style={[
                              styles.l2Chip,
                              isSelected && { backgroundColor: color + '28', borderColor: color },
                              isSommelierSub && !isSelected && styles.l2ChipSommelier,
                            ]}
                            onPress={() => toggleL2(aroma)}
                          >
                            <Text style={[styles.l2Text, isSelected && { color: Colors.inkMid, fontFamily: Fonts.dmSansRegular }]}>
                              {aroma}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {cat.id === 'other' && (
                      <View style={styles.otherNoteWrapper}>
                        <Text style={styles.otherNoteLabel}>Describe further</Text>
                        <RNTextInput
                          style={styles.otherNoteInput}
                          value={draft.aromas_other_note ?? ''}
                          onChangeText={setAromasOtherNote}
                          placeholder="e.g. wet slate, incense, beeswax…"
                          placeholderTextColor={Colors.inkFaint}
                          multiline
                          numberOfLines={2}
                          textAlignVertical="top"
                        />
                      </View>
                    )}
                  </View>

                  <Pressable onPress={() => setExpandedCategory(null)} style={styles.collapseBtn}>
                    <Text style={[styles.collapseBtnText, { color }]}>Done ↑</Text>
                  </Pressable>
                </View>
              )}

              {selected && !isExpanded && (
                <Pressable onPress={() => setExpandedCategory(cat.id)} style={styles.expandRow}>
                  <Text style={[styles.expandHint, { color }]}>
                    {draft.aromas_l2.filter((l2) =>
                      getCategorySubcategories(cat, isSommelier).includes(l2)
                    ).length > 0
                      ? `${draft.aromas_l2.filter((l2) =>
                          getCategorySubcategories(cat, isSommelier).includes(l2)
                        ).length} note${draft.aromas_l2.filter((l2) =>
                          getCategorySubcategories(cat, isSommelier).includes(l2)
                        ).length > 1 ? 's' : ''} · Edit ↓`
                      : '+ Add specific notes'}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </>
  );

  const personalNotesPanel = (
    <View style={styles.personalNotesSection}>
      <Text style={styles.sectionLabel}>Personal Flavor Notes</Text>
      <Text style={styles.shortcutHint}>
        Add your own words — anything you taste that's not in the list above.
      </Text>

      <View style={styles.customTagInputRow}>
        <RNTextInput
          style={styles.customTagInput}
          value={customInput}
          onChangeText={setCustomInput}
          placeholder="e.g. dried herbs, pencil shavings…"
          placeholderTextColor={Colors.inkFaint}
          maxLength={MAX_TAG_LENGTH}
          returnKeyType="done"
          onSubmitEditing={addCustomTag}
        />
        <Pressable
          style={[
            styles.customTagAddBtn,
            (!customInput.trim() || draft.custom_aromas.length >= MAX_CUSTOM_TAGS) && styles.customTagAddBtnDisabled,
          ]}
          onPress={addCustomTag}
          disabled={!customInput.trim() || draft.custom_aromas.length >= MAX_CUSTOM_TAGS}
        >
          <Text style={styles.customTagAddBtnText}>Add</Text>
        </Pressable>
      </View>

      {draft.custom_aromas.length > 0 && (
        <View style={styles.customTagChips}>
          {draft.custom_aromas.map((tag) => (
            <Pressable key={tag} style={styles.customTagChip} onPress={() => removeCustomTag(tag)}>
              <Text style={styles.customTagChipText}>{tag}</Text>
              <Text style={styles.customTagChipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      )}
      {draft.custom_aromas.length >= MAX_CUSTOM_TAGS && (
        <Text style={styles.customTagLimit}>Maximum {MAX_CUSTOM_TAGS} custom tags reached.</Text>
      )}
    </View>
  );

  if (isWide) {
    return (
      <View style={styles.wideContainer}>
        {/* Fixed header */}
        <View style={styles.wideHeader}>
          <View style={styles.titleRow}>
            <Text style={styles.stepTitle}>Aroma Profile</Text>
          </View>
          <Text style={styles.intro}>
            Select the aromas you detect. Tap a category then pick specific notes.
          </Text>
        </View>

        {/* Split two-column body */}
        <View style={styles.wideTwoCol}>
          {/* Left: scrollable categories */}
          <ScrollView
            style={styles.wideScrollCol}
            contentContainerStyle={styles.wideScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {categoriesPanel}
            {personalNotesPanel}
          </ScrollView>

          {/* Right: pinned summary */}
          <View style={styles.widePinnedCol}>
            {summaryPanel}
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.titleRow}>
          <Text style={styles.stepTitle}>Aroma Profile</Text>
        </View>
        <Text style={styles.intro}>
          Select the aromas you detect. Tap a category then pick specific notes.
        </Text>
        {categoriesPanel}
        {personalNotesPanel}
        {summaryPanel}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  // ─── Wide split-ScrollView layout ──────────────────────────────────────────
  wideContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
  },
  wideHeader: {
    marginBottom: Spacing.md,
  },
  wideTwoCol: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  wideScrollCol: {
    flex: 3,
  },
  wideScrollContent: {
    paddingBottom: Spacing.huge,
  },
  widePinnedCol: {
    flex: 2,
    minWidth: 160,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stepTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 22,
    color: Colors.ink,
  },
  intro: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    marginBottom: Spacing.lg,
    lineHeight: 19,
  },
  sectionLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
    marginBottom: 6,
    marginTop: Spacing.md,
  },
  shortcutHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
    marginBottom: Spacing.sm,
    lineHeight: 17,
  },
  shortcutScroll: { marginBottom: Spacing.md },
  shortcutRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: Spacing.xl,
    paddingBottom: 4,
  },
  shortcutCard: {
    width: 120,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  shortcutCardActive: {
    backgroundColor: Colors.goldPale,
    borderColor: Colors.gold,
  },
  shortcutEmoji: { fontSize: 22 },
  shortcutName: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.ink,
    lineHeight: 16,
  },
  shortcutNameActive: { color: Colors.ink },
  shortcutStyle: {
    fontFamily: Fonts.dmSans,
    fontSize: 10,
    color: Colors.inkMuted,
    lineHeight: 13,
  },

  groupsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.sm,
  },
  sommelierModeBadge: {
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  sommelierModeBadgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    color: Colors.inkMid,
    letterSpacing: 0.2,
  },

  flatCatList: {
    gap: 6,
    marginTop: 4,
  },
  categoryBlock: { gap: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  catEmoji: { fontSize: 15 },
  catLabel: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMid,
    flex: 1,
  },
  catCheck: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
  },

  l2Container: { gap: 4 },
  l2Indent: {
    marginLeft: Spacing.lg,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  l2Grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  l2Chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  l2ChipSommelier: {
    borderStyle: 'dashed',
  },
  l2Text: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
  },

  collapseBtn: {
    alignSelf: 'flex-start',
    marginLeft: Spacing.lg,
    paddingVertical: 2,
  },
  collapseBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
  },
  expandRow: { paddingLeft: Spacing.lg },
  expandHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    paddingVertical: 2,
  },

  otherNoteWrapper: {
    marginTop: Spacing.sm,
    gap: 6,
  },
  otherNoteLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  otherNoteInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.ink,
    minHeight: 60,
  },

  summary: {
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 4,
  },
  summarySticky: { marginTop: 0 },
  summaryTitle: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
    marginBottom: 4,
  },
  summaryText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMid,
  },
  summaryL2: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
    fontStyle: 'italic',
  },
  summaryHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkFaint,
    fontStyle: 'italic',
    lineHeight: 18,
  },

  personalNotesSection: {
    marginTop: Spacing.xl,
  },
  customTagInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  customTagInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
  },
  customTagAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.ink,
  },
  customTagAddBtnDisabled: {
    backgroundColor: Colors.border,
  },
  customTagAddBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.surface,
  },
  customTagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  customTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.ink + '12',
    borderWidth: 0.5,
    borderColor: Colors.inkMuted,
  },
  customTagChipText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMid,
  },
  customTagChipRemove: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.inkMuted,
    lineHeight: 16,
  },
  customTagLimit: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkFaint,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
});
