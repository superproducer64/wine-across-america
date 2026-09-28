import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/theme';
import { searchMembers, MemberSearchResult } from '@/lib/supabase';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

interface Props {
  selected: MemberSearchResult | null;
  onSelect: (member: MemberSearchResult | null) => void;
  autoFocus?: boolean;
}

function MemberAvatar({ member, size = 36 }: { member: MemberSearchResult; size?: number }) {
  const [imageError, setImageError] = useState(false);
  const dims = { width: size, height: size, borderRadius: size / 2 };
  return member.avatar_url && !imageError ? (
    <Image source={{ uri: member.avatar_url }} style={[styles.avatar, dims]} onError={() => setImageError(true)} />
  ) : (
    <View style={[styles.avatar, dims]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {member.display_label.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function TierBadge({ role }: { role: MemberSearchResult['user_role'] }) {
  const sommelier = role === 'sommelier';
  return (
    <View style={[styles.tierBadge, sommelier && styles.tierBadgeSommelier]}>
      <Text style={[styles.tierText, sommelier && styles.tierTextSommelier]}>
        {sommelier ? '🎓 Sommelier' : 'Enthusiast'}
      </Text>
    </View>
  );
}

/**
 * "To:" field with a type-ahead member dropdown. Results render inline below
 * the input (not as an absolute overlay), so inside a KeyboardAvoidingView /
 * ScrollView with keyboardShouldPersistTaps="handled" they stay above the keyboard.
 */
export function MemberPicker({ selected, onSelect, autoFocus }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    setError('');
    if (q.length < MIN_CHARS) {
      requestId.current++; // drop any in-flight response
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const { data, error: searchError } = await searchMembers(q);
      if (id !== requestId.current) return; // a newer keystroke superseded this one
      setLoading(false);
      setSearched(true);
      if (searchError) setError('Search failed. Please try again.');
      setResults(data ?? []);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (member: MemberSearchResult) => {
    Keyboard.dismiss();
    setQuery('');
    setResults([]);
    setSearched(false);
    onSelect(member);
  };

  if (selected) {
    return (
      <View style={styles.field}>
        <Text style={styles.toLabel}>To:</Text>
        <View style={styles.chip}>
          <MemberAvatar member={selected} size={24} />
          <Text style={styles.chipText} numberOfLines={1}>{selected.display_label}</Text>
          <Pressable
            onPress={() => onSelect(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${selected.display_label}`}
          >
            <Text style={styles.chipClear}>×</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const showDropdown = query.trim().length >= MIN_CHARS;

  return (
    <View>
      <View style={styles.field}>
        <Text style={styles.toLabel}>To:</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="start typing a name…"
          placeholderTextColor={Colors.inkFaint}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
        />
        {loading ? <ActivityIndicator size="small" color={Colors.gold} /> : null}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {error ? (
            <Text style={styles.emptyText}>{error}</Text>
          ) : searched && results.length === 0 && !loading ? (
            <Text style={styles.emptyText}>No members found.</Text>
          ) : (
            results.map((m, i) => (
              <Pressable
                key={m.id}
                style={({ pressed }) => [
                  styles.resultRow,
                  i > 0 && styles.resultRowDivider,
                  pressed && styles.resultRowPressed,
                ]}
                onPress={() => handleSelect(m)}
              >
                <MemberAvatar member={m} />
                <Text style={styles.resultName} numberOfLines={1}>{m.display_label}</Text>
                <TierBadge role={m.user_role} />
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    backgroundColor: Colors.white,
  },
  toLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.inkMuted,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.dmSansRegular,
    fontSize: 15,
    color: Colors.ink,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.goldPale,
    borderColor: Colors.gold,
    borderWidth: 0.5,
    borderRadius: Radius.full,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  chipText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
    flexShrink: 1,
  },
  chipClear: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 18,
    lineHeight: 20,
    color: Colors.inkMuted,
  },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  resultRowDivider: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  resultRowPressed: { backgroundColor: Colors.goldPale },
  resultName: {
    flex: 1,
    fontFamily: Fonts.dmSansRegular,
    fontSize: 15,
    color: Colors.ink,
  },
  avatar: {
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: Fonts.playfair, color: Colors.ink },
  tierBadge: {
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tierBadgeSommelier: { borderColor: Colors.gold, backgroundColor: Colors.goldPale },
  tierText: { fontFamily: Fonts.dmSansMedium, fontSize: 11, color: Colors.inkMuted },
  tierTextSommelier: { color: Colors.inkMid },
  emptyText: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.inkMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});
