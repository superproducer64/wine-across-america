import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import { supabase, setRecoverySession } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { usePasswordRecoveryStore } from '@/stores/passwordRecoveryStore';
import { useInviteStore } from '@/stores/inviteStore';
import { parseRecoveryParamsFromUrl, parseInviteCodeFromUrl } from '@/lib/deepLink';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { RootStackParamList } from './types';
import { Colors } from '@/theme';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const Root = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { session, loading, setSession } = useAuthStore();
  const { active: recoveryActive, error: recoveryError, start: startRecovery } = usePasswordRecoveryStore();
  const { pendingCode: pendingInviteCode, setPendingCode: setPendingInviteCode } = useInviteStore();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  usePushNotifications();

  useEffect(() => {
    // Bootstrap auth session from stored token
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    }).catch((err) => {
      console.error('[RootNavigator] getSession failed:', err);
      setSession(null);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Handles two deep-link families, each reachable via either the legacy
    // custom scheme or the pouracrossamerica.com.bgpstudios.com Universal Link:
    //  - .../reset-password (+ tokens in the hash) — recovery
    //  - .../invite/{code} — invite signup
    // initialRouteName/initialParams on AuthNavigator cover cold starts (state
    // is set before it ever mounts); navigationRef.navigate covers the case
    // where the app is already open and the navigator is already mounted, so
    // changing initialRouteName after the fact would otherwise be a no-op.
    const handleUrl = async (url: string | null) => {
      if (!url) return;

      const recovery = parseRecoveryParamsFromUrl(url);
      if (recovery) {
        if (recovery.kind === 'error') {
          startRecovery(recovery.message);
        } else {
          startRecovery(null);
          const { error } = await setRecoverySession(recovery.accessToken, recovery.refreshToken);
          if (error) startRecovery(error);
        }
        if (navigationRef.isReady()) {
          navigationRef.navigate('Auth', { screen: 'NewPassword' });
        }
        return;
      }

      const inviteCode = parseInviteCodeFromUrl(url);
      if (inviteCode) {
        if (!useAuthStore.getState().session) {
          setPendingInviteCode(inviteCode);
          if (navigationRef.isReady()) {
            navigationRef.navigate('Auth', { screen: 'Signup', params: { inviteCode } });
          }
        } else {
          Alert.alert(
            "You're already signed in",
            'This invite link is for new accounts.'
          );
        }
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [startRecovery, setPendingInviteCode, navigationRef]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.ink, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {recoveryActive || !session ? (
          <Root.Screen name="Auth">
            {() => (
              <AuthNavigator
                initialRouteName={recoveryActive ? 'NewPassword' : pendingInviteCode ? 'Signup' : 'Login'}
                newPasswordParams={recoveryActive && recoveryError ? { error: recoveryError } : undefined}
                signupParams={!recoveryActive && pendingInviteCode ? { inviteCode: pendingInviteCode } : undefined}
              />
            )}
          </Root.Screen>
        ) : (
          <Root.Screen name="Main" component={MainNavigator} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
