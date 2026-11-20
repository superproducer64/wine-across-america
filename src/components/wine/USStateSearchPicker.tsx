import React, { useState, useMemo, useRef } from 'react';
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

const ALL_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

interface Props {
  selected: string;
  onSelect: (state: string) => void;
}

export function USStateSearchPicker({ selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_STATES;
    return ALL_STATES.filter((s) => s.toLowerCase().startsWith(q));
  }, [query]);

  const handleSelect = (state: string) => {
    onSelect(state);
    setQuery('');
    setOpen(false);
    Keyboard.dismiss();
  };

  const handleClear = () => {
    onSelect('');
    setQuery('');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── State already chosen — show compact badge only ──────────────────────────
  if (selected && !open) {
    return (
      <View style={styles.container}>
        <View style={styles.chosenRow}>
          <Text style={styles.chosenIcon}>📍</Text>
          <Text style={styles.chosenName}>{selected}</Text>
          <Pressable onPress={handleClear} style={styles.changeBtn} hitSlop={8}>
            <Text style={styles.changeBtnText}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── No state chosen — show search + grid ────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Type a letter to filter states…"
          placeholderTextColor={Colors.inkMuted}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (filtered.length === 1) handleSelect(filtered[0]);
          }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} style={styles.clearBtn} hitSlop={8}>
            <Text style={styles.clearBtnText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Plain ScrollView (not FlatList): nested in the Step 1 ScrollView. */}
      <ScrollView
        style={styles.list}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No states match "{query}"</Text>
        ) : (
          (() => {
            const rows: string[][] = [];
            for (let i = 0; i < filtered.length; i += 2) rows.push(filtered.slice(i, i + 2));
            return rows.map((row) => (
              <View key={row[0]} style={[styles.row, { flexDirection: 'row' }]}>
                {row.map((item) => (
                  <Pressable key={item} style={styles.stateBtn} onPress={() => handleSelect(item)}>
                    <Text style={styles.stateBtnText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            ));
          })()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },

  // Chosen state row
  chosenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  chosenIcon: { fontSize: 16 },
  chosenName: {
    flex: 1,
    fontFamily: Fonts.dmSansMedium,
    fontSize: 15,
    color: Colors.ink,
  },
  changeBtn: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
  },
  changeBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.gold,
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
    height: 42,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchIcon: { fontSize: 14 },
  input: {
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

  // Grid
  list: { maxHeight: 240 },
  row: { gap: 6, marginBottom: 6 },
  stateBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
  },
  stateBtnText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.ink,
    textAlign: 'center',
  },
  empty: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.inkMuted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
