import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { GRAPE_VARIETIES, GrapeBlendEntry } from '@/types';

interface Props {
  value: GrapeBlendEntry[];
  onChange: (entries: GrapeBlendEntry[]) => void;
}

// Auto-distribute percentages for 1–3 grapes, descending dominant pattern
const AUTO_SPLITS: Record<number, number[]> = {
  1: [100],
  2: [60, 40],
  3: [60, 25, 15],
};

function autoDistribute(entries: GrapeBlendEntry[]): GrapeBlendEntry[] {
  const splits = AUTO_SPLITS[entries.length];
  if (!splits) return entries;
  return entries.map((e, i) => ({ ...e, percentage: splits[i] }));
}

export function GrapeBlendInput({ value, onChange }: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GRAPE_VARIETIES.slice(0, 20);
    return GRAPE_VARIETIES.filter((g) => g.toLowerCase().includes(q));
  }, [query]);

  const selectedNames = useMemo(() => value.map((e) => e.name), [value]);

  const totalPct = useMemo(
    () => value.reduce((sum, e) => sum + (e.percentage ?? 0), 0),
    [value]
  );

  const isAutoMode = value.length >= 2 && value.length <= 3;
  const hasAnyPct = value.some((e) => e.percentage !== null);

  const handleAdd = (name: string) => {
    if (selectedNames.includes(name)) return;
    const next = [...value, { name, percentage: 0 }];
    onChange(next.length <= 3 ? autoDistribute(next) : next);
    setQuery('');
    Keyboard.dismiss();
  };

  const handleAddCustom = () => {
    const name = query.trim();
    if (!name || selectedNames.includes(name)) return;
    const next = [...value, { name, percentage: 0 }];
    onChange(next.length <= 3 ? autoDistribute(next) : next);
    setQuery('');
    Keyboard.dismiss();
  };

  const handleRemove = (name: string) => {
    const next = value.filter((e) => e.name !== name);
    onChange(next.length >= 1 && next.length <= 3 ? autoDistribute(next) : next);
  };

  const handlePctChange = (name: string, raw: string) => {
    const pct = raw === '' ? null : Math.min(100, Math.max(0, parseInt(raw) || 0));
    const updated = value.map((e) => (e.name === name ? { ...e, percentage: pct } : e));

    // In auto mode: when editing any grape except the last, auto-adjust the last
    // grape so the total stays at 100
    if (isAutoMode && pct !== null) {
      const editedIdx = updated.findIndex((e) => e.name === name);
      const lastIdx = updated.length - 1;
      if (editedIdx !== lastIdx) {
        const othersSum = updated
          .slice(0, lastIdx)
          .reduce((s, e) => s + (e.percentage ?? 0), 0);
        updated[lastIdx] = {
          ...updated[lastIdx],
          percentage: Math.max(0, 100 - othersSum),
        };
      }
    }

    onChange(updated);
  };

  const pctColor =
    !hasAnyPct ? Colors.inkMuted
    : totalPct === 100 ? '#4CAF50'
    : totalPct > 100 ? Colors.red
    : Colors.gold;

  const showCustomAdd =
    query.trim().length > 0 && !GRAPE_VARIETIES.some(
      (g) => g.toLowerCase() === query.trim().toLowerCase()
    ) && !selectedNames.includes(query.trim());

  return (
    <View style={styles.container}>
      {/* ── Selected grapes ── */}
      {value.length > 0 && (
        <View style={styles.selectedList}>
          {value.map((entry) => (
            <View key={entry.name} style={styles.selectedRow}>
              <View style={styles.selectedLeft}>
                <Pressable onPress={() => handleRemove(entry.name)} style={styles.removeBtn} hitSlop={6}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
                <Text style={styles.selectedName}>{entry.name}</Text>
              </View>
              <View style={[
                styles.pctWrap,
                entry.percentage !== null && styles.pctWrapFilled,
              ]}>
                <TextInput
                  style={styles.pctInput}
                  value={entry.percentage !== null ? String(entry.percentage) : ''}
                  onChangeText={(v) => handlePctChange(entry.name, v)}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="0"
                  placeholderTextColor={Colors.inkMuted}
                  selectTextOnFocus
                />
                <Text style={[
                  styles.pctSign,
                  entry.percentage !== null && styles.pctSignFilled,
                ]}>%</Text>
              </View>
            </View>
          ))}

          {/* Blend total */}
          {hasAnyPct && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {isAutoMode ? 'Auto-balanced  ⚡' : 'Blend total'}
              </Text>
              <Text style={[styles.totalValue, { color: pctColor }]}>
                {totalPct}%{totalPct === 100 ? '  ✓' : totalPct > 100 ? '  over 100' : ''}
              </Text>
            </View>
          )}

          {/* Blend warning — only shown in manual mode (4+ grapes) */}
          {!isAutoMode && hasAnyPct && totalPct !== 100 && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Blend adds up to {totalPct}% — tap a field to adjust
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Search box ── */}
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🍇</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search or add a grape variety…"
          placeholderTextColor={Colors.inkMuted}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (filtered.length === 1) handleAdd(filtered[0]);
            else if (showCustomAdd) handleAddCustom();
          }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* ── Custom add button ── */}
      {showCustomAdd && (
        <Pressable style={styles.customAddBtn} onPress={handleAddCustom}>
          <Text style={styles.customAddText}>
            ＋ Add "{query.trim()}" as custom grape
          </Text>
        </Pressable>
      )}

      {/* ── Filtered suggestions ── */}
      {/* Plain ScrollView (not FlatList): this sits inside the Step 1
          ScrollView, and a nested VirtualizedList triggers RN's warning. */}
      <ScrollView
        style={styles.list}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {(() => {
          const items = filtered.filter((g) => !selectedNames.includes(g));
          if (items.length === 0) {
            return query.trim() && !showCustomAdd ? (
              <Text style={styles.empty}>All matches already added</Text>
            ) : null;
          }
          const rows: string[][] = [];
          for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
          return rows.map((row) => (
            <View key={row[0]} style={[styles.row, { flexDirection: 'row' }]}>
              {row.map((item) => (
                <Pressable key={item} style={styles.suggestionBtn} onPress={() => handleAdd(item)}>
                  <Text style={styles.suggestionText}>{item}</Text>
                  <Text style={styles.suggestionPlus}>＋</Text>
                </Pressable>
              ))}
            </View>
          ));
        })()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },

  // Selected list
  selectedList: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  selectedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  removeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    color: Colors.white,
  },
  selectedName: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
    flexShrink: 1,
  },
  pctWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    minWidth: 64,
    gap: 2,
  },
  pctWrapFilled: {
    backgroundColor: Colors.goldPale,
    borderColor: Colors.borderStrong,
  },
  pctInput: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
    textAlign: 'right',
    width: 36,
    paddingVertical: 0,
  },
  pctSign: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  pctSignFilled: {
    color: Colors.ink,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.goldPale,
  },
  totalLabel: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMuted,
  },
  totalValue: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
  },
  warningBanner: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.goldPale,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderStrong,
  },
  warningText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.gold,
    textAlign: 'center',
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
    paddingVertical: 0,
  },
  clearBtn: { padding: 2 },
  clearBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.inkMuted,
  },

  // Custom add
  customAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  customAddText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.ink,
  },

  // Suggestions
  list: { maxHeight: 200 },
  row: { gap: 6, marginBottom: 6 },
  suggestionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  suggestionText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 12,
    color: Colors.ink,
    flex: 1,
  },
  suggestionPlus: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.gold,
  },
  empty: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMuted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
