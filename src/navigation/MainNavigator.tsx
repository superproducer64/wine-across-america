import React from 'react';
import { Text, View, Pressable, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors, Fonts, Radius, Spacing } from '@/theme';
import { TabParamList, MainStackParamList } from './types';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { SearchScreen } from '@/screens/search/SearchScreen';
import { WineEntryScreen } from '@/screens/entry/WineEntryScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { WineDetailScreen } from '@/screens/detail/WineDetailScreen';
import { ShareCardScreen } from '@/screens/share/ShareCardScreen';
import { ComparisonScreen } from '@/screens/comparison/ComparisonScreen';
import { AdminScreen } from '@/screens/admin/AdminScreen';
import { InsightsScreen } from '@/screens/admin/InsightsScreen';
import { MemberDirectoryScreen } from '@/screens/directory/MemberDirectoryScreen';
import { InviteMembersScreen } from '@/screens/invite/InviteMembersScreen';
import { InboxScreen } from '@/screens/messages/InboxScreen';
import { MessageDetailScreen } from '@/screens/messages/MessageDetailScreen';
import { ComposeMessageScreen } from '@/screens/messages/ComposeMessageScreen';
import { useResponsive, SIDEBAR_WIDTH } from '@/hooks/useResponsive';

const Stack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ITEMS = [
  { name: 'Home' as const, emoji: '🏠', label: 'Home' },
  { name: 'Search' as const, emoji: '🔍', label: 'Search' },
  { name: 'AddEntry' as const, emoji: '+', label: 'Add Wine' },
  { name: 'Settings' as const, emoji: '👤', label: 'Account' },
];

function TabBarIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { isWide } = useResponsive();

  if (__DEV__) {
    console.log('[CustomTabBar] insets:', insets);
  }

  if (isWide) {
    return (
      <View style={sidebarStyles.container}>
        <View style={sidebarStyles.logoSection}>
          <Text style={sidebarStyles.logoLine1}>Pour Across</Text>
          <Text style={sidebarStyles.logoLine2}>America</Text>
        </View>

        <View style={sidebarStyles.divider} />

        <View style={sidebarStyles.navItems}>
          {state.routes
            .filter((r) => r.name !== 'AddEntry')
            .map((route) => {
              const idx = state.routes.indexOf(route);
              const focused = state.index === idx;
              const item = TAB_ITEMS.find((t) => t.name === route.name);
              return (
                <Pressable
                  key={route.key}
                  style={[sidebarStyles.navItem, focused && sidebarStyles.navItemActive]}
                  onPress={() => navigation.navigate(route.name as keyof TabParamList)}
                >
                  <Text style={sidebarStyles.navEmoji}>{item?.emoji}</Text>
                  <Text style={[sidebarStyles.navLabel, focused && sidebarStyles.navLabelActive]}>
                    {item?.label}
                  </Text>
                </Pressable>
              );
            })}
        </View>

        <Pressable
          style={sidebarStyles.addWineBtn}
          onPress={() => navigation.navigate('AddEntry')}
        >
          <Text style={sidebarStyles.addWineBtnText}>+ Add Wine</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
      {state.routes.map((route) => {
        const index = state.routes.indexOf(route);
        const focused = state.index === index;

        if (route.name === 'AddEntry') {
          return (
            <Pressable
              key={route.key}
              style={styles.addButton}
              onPress={() => navigation.navigate('AddEntry')}
            >
              <Text style={styles.addButtonText}>+</Text>
            </Pressable>
          );
        }

        const item = TAB_ITEMS.find((t) => t.name === route.name);
        return (
          <Pressable
            key={route.key}
            style={styles.tabButton}
            onPress={() => navigation.navigate(route.name as keyof TabParamList)}
          >
            <TabBarIcon
              emoji={item?.emoji ?? ''}
              label={item?.label ?? ''}
              focused={focused}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="AddEntry" component={WineEntryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen
        name="WineDetail"
        component={WineDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ShareCard"
        component={ShareCardScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Comparison"
        component={ComparisonScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="MemberDirectory"
        component={MemberDirectoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="MessageDetail"
        component={MessageDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="ComposeMessage"
        component={ComposeMessageScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

const sidebarStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: Colors.ink,
    borderRightWidth: 0.5,
    borderRightColor: 'rgba(196,132,122,0.2)',
    paddingTop: 48,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    zIndex: 100,
  },
  logoSection: {
    marginBottom: Spacing.lg,
    paddingHorizontal: 4,
  },
  logoLine1: {
    fontFamily: Fonts.playfairItalic,
    fontSize: 13,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  logoLine2: {
    fontFamily: Fonts.playfair,
    fontSize: 18,
    color: Colors.white,
    lineHeight: 22,
  },
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(196,132,122,0.2)',
    marginBottom: Spacing.lg,
  },
  navItems: {
    flex: 1,
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  navItemActive: {
    backgroundColor: 'rgba(196,132,122,0.12)',
  },
  navEmoji: {
    fontSize: 18,
  },
  navLabel: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  navLabelActive: {
    color: Colors.gold,
  },
  addWineBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  addWineBtnText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 14,
    color: Colors.ink,
    letterSpacing: 0.2,
  },
});

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#EFE4E1',
    borderTopColor: 'rgba(196,132,122,0.3)',
    borderTopWidth: 0.5,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    alignItems: 'center',
    gap: 2,
  },
  tabEmoji: {
    fontSize: 20,
    opacity: 0.4,
  },
  tabEmojiActive: {
    opacity: 1,
  },
  tabLabel: {
    fontFamily: Fonts.dmSans,
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Colors.gold,
  },
  addButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 28,
    color: Colors.ink,
    lineHeight: 32,
    marginTop: -2,
  },
});
