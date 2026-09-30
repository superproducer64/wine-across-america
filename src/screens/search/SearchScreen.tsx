import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { useResponsive, SIDEBAR_WIDTH } from '@/hooks/useResponsive';
import { ResponsiveContainer } from '@/components/ui/ResponsiveContainer';
import { TextInput } from '@/components/ui/TextInput';
import { WineListItem } from '@/components/wine/WineListItem';
import { WineGridItem } from '@/components/wine/WineGridItem';
import { useAuthStore } from '@/stores/authStore';
import { useWineStore } from '@/stores/wineStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { SHOW_SUBSCRIPTION_UI } from '@/config/featureFlags';
import { WineEntry, COUNTRIES_AND_REGIONS } from '@/types';
import { MainStackParamList } from '@/navigation/types';

const SORT_OPTIONS = ['Recent', 'Score ↓', 'Score ↑', 'Vintage ↓'] as const;
type SortOption = typeof SORT_OPTIONS[number];

function sortEntries(entries: WineEntry[], sort: SortOption): WineEntry[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'Score ↓': return b.technical_score - a.technical_score;
      case 'Score ↑': return a.technical_score - b.technical_score;
      case 'Vintage ↓': return (b.vintage ?? 0) - (a.vintage ?? 0);
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });
}

export function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user } = useAuthStore();
  const { entries, totalCount, searchResults, searching, hasMore, loadingMore, search, clearSearch, loadEntries, loadMore } = useWineStore();
  const { isSubscribed } = useSubscriptionStore();

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('Recent');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) loadEntries(user.id, isSubscribed);
  }, [user]);

  const runSearch = useCallback(
    (q: string, country: string, minScore: string) => {
      if (!user) return;
      if (!q && !country && !minScore) {
        clearSearch();
        return;
      }
      search(user.id, q, {
        country: country || undefined,
        minScore: minScore ? parseInt(minScore) : undefined,
      });
    },
    [user, search, clearSearch]
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      runSearch(text, filterCountry, filterMinScore);
    }, 400);
    setDebounceTimer(timer);
  };

  const displayEntries = query || filterCountry || filterMinScore
    ? searchResults
    : sortEntries(entries, sortBy);

  const countries = Object.keys(COUNTRIES_AND_REGIONS).sort();

  const handleWinePress = useCallback((entry: WineEntry) => {
    navigation.navigate('WineDetail', { entryId: entry.id });
  }, [navigation]);

  const { isWide } = useResponsive();

  return (
    <SafeAreaView style={[styles.safe, isWide && { paddingLeft: SIDEBAR_WIDTH }]}>
      <ResponsiveContainer style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>My Wines</Text>
        <Text style={styles.count}>{totalCount} entries</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search wines, producers, regions…"
          containerStyle={styles.searchInput}
        />
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
        >
          <Text style={styles.filterBtnText}>⚡ Filter</Text>
        </Pressable>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <Text style={styles.filtersTitle}>Filters</Text>
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Country</Text>
              <Pressable
                style={styles.filterSelect}
                onPress={() => {
                  // Simple cycle through countries for MVP
                  const idx = countries.indexOf(filterCountry);
                  const next = countries[(idx + 1) % countries.length] ?? '';
                  setFilterCountry(next);
                  runSearch(query, next, filterMinScore);
                }}
              >
                <Text style={styles.filterSelectText}>
                  {filterCountry || 'Any country'}
                </Text>
              </Pressable>
            </View>

            <View style={{ width: 90 }}>
              <Text style={styles.filterLabel}>Min Score</Text>
              <TextInput
                value={filterMinScore}
                onChangeText={(v) => {
                  setFilterMinScore(v);
                  runSearch(query, filterCountry, v);
                }}
                keyboardType="number-pad"
                placeholder="0"
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
          </View>

          {SHOW_SUBSCRIPTION_UI && !isSubscribed && (
            <View style={styles.paywallHint}>
              <Text style={styles.paywallText}>
                🔒 Upgrade to Pro for compound search (price range, terroir, tags…)
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Sort Options */}
      {!query && !filterCountry && !filterMinScore && (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.sortChip, sortBy === opt && styles.sortChipActive]}
              onPress={() => setSortBy(opt)}
            >
              <Text style={[styles.sortText, sortBy === opt && styles.sortTextActive]}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Results */}
      {searching ? (
        <View style={styles.searchingWrap}>
          <ActivityIndicator color={Colors.gold} />
        </View>
      ) : (
        <FlatList
          key={isWide ? 'grid' : 'list'}
          data={displayEntries}
          keyExtractor={(item) => item.id}
          numColumns={isWide ? 2 : 1}
          columnWrapperStyle={isWide ? { gap: Spacing.md } : undefined}
          renderItem={({ item }) =>
            isWide ? (
              <WineGridItem entry={item} onPress={handleWinePress} />
            ) : (
              <WineListItem entry={item} onPress={handleWinePress} />
            )
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            const isSearching = !!(query || filterCountry || filterMinScore);
            if (!isSearching && hasMore && user) {
              loadMore(user.id, isSubscribed);
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {query || filterCountry || filterMinScore
                  ? 'No wines match your search'
                  : 'No wines logged yet'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore && !(query || filterCountry || filterMinScore) ? (
              <View style={styles.loadMoreFooter}>
                <ActivityIndicator size="small" color={Colors.gold} />
              </View>
            ) : null
          }
        />
      )}
      </ResponsiveContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    fontFamily: Fonts.playfair,
    fontSize: 24,
    color: Colors.ink,
  },
  count: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  searchWrap: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  filterBtnActive: {
    backgroundColor: Colors.goldPale,
    borderColor: Colors.gold,
  },
  filterBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.inkMid,
  },
  filtersPanel: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  filtersTitle: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-end',
  },
  filterLabel: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterSelect: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  filterSelectText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.inkMid,
  },
  paywallHint: {
    backgroundColor: Colors.blueLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  paywallText: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.blue,
    lineHeight: 17,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  sortChipActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  sortText: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMid,
  },
  sortTextActive: {
    color: Colors.gold,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  searchingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingTop: Spacing.huge,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.playfairItalic,
    fontSize: 15,
    color: Colors.inkMuted,
  },
  loadMoreFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
});
