import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { useResponsive, SIDEBAR_WIDTH, MAX_CONTENT_WIDTH } from '@/hooks/useResponsive';
import { useAuthStore } from '@/stores/authStore';
import { useWineStore } from '@/stores/wineStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { SHOW_SUBSCRIPTION_UI } from '@/config/featureFlags';
import { WineListItem } from '@/components/wine/WineListItem';
import { WineGridItem } from '@/components/wine/WineGridItem';
import { SkeletonWineListItem } from '@/components/wine/SkeletonWineListItem';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MainStackParamList, TabParamList } from '@/navigation/types';
import { WineEntry } from '@/types';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { user, profile } = useAuthStore();
  const { entries, totalCount, loading, loadingMore, hasMore, loadError, loadEntries, loadMore } = useWineStore();
  const { isSubscribed } = useSubscriptionStore();

  useEffect(() => {
    if (!user) return;
    loadEntries(user.id, isSubscribed);
  }, [user]);

  const firstName = profile?.display_name?.split(' ')[0] ?? 'there';

  const avgScore = useMemo(() => {
    if (!entries.length) return 0;
    return Math.round(entries.reduce((s, e) => s + e.technical_score, 0) / entries.length);
  }, [entries]);

  const topCountry = useMemo(() => {
    if (!entries.length) return null;
    const counts: Record<string, number> = {};
    entries.forEach((e) => { counts[e.country] = (counts[e.country] ?? 0) + 1; });
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  }, [entries]);

  const topGrape = useMemo(() => {
    if (!entries.length) return null;
    const counts: Record<string, number> = {};
    entries.forEach((e) => e.grapes.forEach((g) => { counts[g] = (counts[g] ?? 0) + 1; }));
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  }, [entries]);

  const recentEntries = useMemo(() => entries, [entries]);

  const handleWinePress = useCallback((entry: WineEntry) => {
    navigation.navigate('WineDetail', { entryId: entry.id } as never);
  }, [navigation]);

  const { isWide } = useResponsive();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWide && { paddingLeft: SIDEBAR_WIDTH + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
      <View style={isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' } : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.greeting}>Hello, {firstName}</Text>
            <Pressable onPress={() => navigation.navigate('Settings' as never)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {firstName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            </Pressable>
          </View>
          <Text style={styles.tagline}>Your wine intelligence journal</Text>
        </View>

        {/* Analytics Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalCount}</Text>
            <Text style={styles.statLabel}>Wines Logged</Text>
            {SHOW_SUBSCRIPTION_UI && !isSubscribed && totalCount >= 30 && (
              <Text style={styles.freeLimitHint}>Free limit reached</Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{avgScore}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{topCountry ?? '—'}</Text>
            <Text style={styles.statLabel}>Top Country</Text>
          </View>
        </View>

        {topGrape && (
          <View style={styles.grapeCard}>
            <Text style={styles.grapeEmoji}>🍇</Text>
            <View>
              <Text style={styles.grapeLabel}>Favourite Grape</Text>
              <Text style={styles.grapeName}>{topGrape}</Text>
            </View>
          </View>
        )}

        {/* Pro Upsell */}
        {SHOW_SUBSCRIPTION_UI && !isSubscribed && (
          <Pressable style={styles.upsellCard} onPress={() => navigation.navigate('Settings')}>
            <View>
              <Text style={styles.upsellTitle}>Unlock Wine Intelligence</Text>
              <Text style={styles.upsellBody}>
                Taste fingerprint, score-vs-price charts, compound search, and more.
              </Text>
            </View>
            <View style={styles.upsellBadge}>
              <Text style={styles.upsellBadgeText}>PRO</Text>
            </View>
          </Pressable>
        )}

        {/* Recent Wines */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Wines</Text>
          <View style={styles.sectionActions}>
            {entries.length >= 2 && (
              <Pressable
                onPress={() => navigation.navigate('Comparison' as never)}
                style={styles.compareBtn}
              >
                <Text style={styles.compareBtnText}>Compare ⚖️</Text>
              </Pressable>
            )}
            <Pressable onPress={() => navigation.navigate('Search' as never)}>
              <Text style={styles.viewAll}>View all →</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonWineListItem key={i} />
            ))}
          </>
        ) : (
          <>
            {recentEntries.length === 0 ? (
              loadError ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>⚠️</Text>
                  <Text style={styles.emptyTitle}>Couldn't load your wines</Text>
                  <Text style={styles.emptyBody}>{loadError}</Text>
                  <Pressable
                    style={styles.retryBtn}
                    onPress={() => user && loadEntries(user.id, isSubscribed)}
                  >
                    <Text style={styles.retryBtnText}>Try again</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>🍾</Text>
                  <Text style={styles.emptyTitle}>Your journal is empty</Text>
                  <Text style={styles.emptyBody}>
                    Tap the + button to log your first wine
                  </Text>
                </View>
              )
            ) : (
              <View style={isWide ? styles.gridWrap : undefined}>
                {recentEntries.map(item =>
                  isWide ? (
                    <View key={item.id} style={styles.gridCell}>
                      <WineGridItem entry={item} onPress={handleWinePress} />
                    </View>
                  ) : (
                    <WineListItem key={item.id} entry={item} onPress={handleWinePress} />
                  )
                )}
              </View>
            )}
            {hasMore && (
              <Pressable
                style={styles.loadMoreBtn}
                onPress={() => user && loadMore(user.id, isSubscribed)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={Colors.gold} />
                ) : (
                  <Text style={styles.loadMoreText}>Load more</Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  greeting: {
    fontFamily: Fonts.playfair,
    fontSize: 24,
    color: Colors.ink,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.playfair,
    fontSize: 16,
    color: Colors.ink,
  },
  tagline: {
    fontFamily: Fonts.playfairItalic,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.ink,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: Fonts.playfair,
    fontSize: 22,
    color: Colors.gold,
    lineHeight: 26,
  },
  statLabel: {
    fontFamily: Fonts.dmSans,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  freeLimitHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 9,
    color: Colors.red,
    marginTop: 2,
    textAlign: 'center',
  },
  grapeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.goldPale,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    marginBottom: Spacing.md,
  },
  grapeEmoji: { fontSize: 24 },
  grapeLabel: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  grapeName: {
    fontFamily: Fonts.playfair,
    fontSize: 17,
    color: Colors.ink,
  },
  upsellCard: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  upsellTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 16,
    color: Colors.gold,
    marginBottom: 3,
  },
  upsellBody: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    maxWidth: 240,
    lineHeight: 17,
  },
  upsellBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.gold,
  },
  upsellBadgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 18,
    color: Colors.ink,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  compareBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  compareBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.ink,
  },
  viewAll: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 13,
    color: Colors.gold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
    gap: Spacing.sm,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 18,
    color: Colors.ink,
  },
  emptyBody: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
  },
  retryBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.ink,
  },

  loadMoreBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceAlt,
  },
  loadMoreText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.gold,
  },

  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridCell: {
    flex: 1,
    minWidth: 240,
  },
});
