import React, { useCallback, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Fonts, Radius, Spacing } from '@/theme';
import { useResponsive, SIDEBAR_WIDTH, MAX_CONTENT_WIDTH } from '@/hooks/useResponsive';
import { fetchUsageInsights, UsageInsights } from '@/lib/supabase';
import { MainStackParamList } from '@/navigation/types';

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function pct(part: number, total: number): string {
  if (total <= 0) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

export function InsightsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { isWide } = useResponsive();
  const [insights, setInsights] = useState<UsageInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: fetchError } = await fetchUsageInsights();
    if (fetchError) {
      setError(fetchError);
    } else {
      setInsights(data);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={[styles.safe, isWide && { paddingLeft: SIDEBAR_WIDTH }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' } : undefined}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Usage Insights</Text>
          <Text style={styles.subtitle}>
            Aggregate, anonymized product metrics drawn from data already stored to run the
            app — no behavioral tracking or new instrumentation is added.
          </Text>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Loading insights…</Text>
            </View>
          ) : insights ? (
            <View style={styles.sections}>
              <View>
                <SectionTitle>Adoption</SectionTitle>
                <View style={styles.statsGrid}>
                  <StatCard label="Total Users" value={String(insights.totalUsers)} />
                  <StatCard
                    label="New Signups (30d)"
                    value={String(insights.signupsLast30Days)}
                  />
                  <StatCard
                    label="Users w/ 1+ Entry"
                    value={`${insights.usersWithAtLeastOneEntry} (${pct(
                      insights.usersWithAtLeastOneEntry,
                      insights.totalUsers
                    )})`}
                    hint="Signed up but never logged a wine = onboarding drop-off"
                  />
                </View>
              </View>

              <View>
                <SectionTitle>Engagement</SectionTitle>
                <View style={styles.statsGrid}>
                  <StatCard label="Total Wine Entries" value={String(insights.totalEntries)} />
                  <StatCard label="Entries (Last 7d)" value={String(insights.entriesLast7Days)} />
                  <StatCard label="Entries (Last 30d)" value={String(insights.entriesLast30Days)} />
                  <StatCard
                    label="Avg Entries / Active User"
                    value={insights.avgEntriesPerActiveUser.toFixed(1)}
                  />
                </View>
              </View>

              <View>
                <SectionTitle>Feature Reach</SectionTitle>
                <View style={styles.statsGrid}>
                  <StatCard
                    label="Entries w/ Photo"
                    value={pct(insights.entriesWithPhoto, insights.totalEntries)}
                    hint="Label scanning / photo capture usage"
                  />
                  <StatCard
                    label="Entries w/ Notes"
                    value={pct(insights.entriesWithNotes, insights.totalEntries)}
                    hint="Free-text tasting notes filled in"
                  />
                  <StatCard
                    label="Entries w/ Terroir"
                    value={pct(insights.entriesWithTerroir, insights.totalEntries)}
                    hint="Sommelier-only deep fields"
                  />
                  <StatCard
                    label="Custom Grapes Added"
                    value={String(insights.customGrapeVarietiesAdded)}
                    hint="Users going beyond the master list"
                  />
                </View>
              </View>

              <View>
                <SectionTitle>Social</SectionTitle>
                <View style={styles.statsGrid}>
                  <StatCard
                    label="Wines Shared"
                    value={String(insights.totalShares)}
                    hint={`${pct(insights.sharesSeen, insights.totalShares)} opened by recipient`}
                  />
                  <StatCard
                    label="Approved Sommeliers"
                    value={String(insights.sommelierApproved)}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  backBtn: { paddingVertical: Spacing.xs },
  backText: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.gold,
  },
  title: {
    fontFamily: Fonts.playfair,
    fontSize: 28,
    color: Colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.inkMuted,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  errorBanner: {
    backgroundColor: 'rgba(139,46,46,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.red,
  },
  errorText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.red,
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: Spacing.huge,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.inkMuted,
  },
  sections: { gap: Spacing.xl },
  sectionTitle: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.gold,
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: 4,
  },
  statValue: {
    fontFamily: Fonts.playfair,
    fontSize: 24,
    color: Colors.ink,
  },
  statLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.inkMuted,
  },
  statHint: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    color: Colors.inkFaint,
    marginTop: 2,
    lineHeight: 14,
  },
});
