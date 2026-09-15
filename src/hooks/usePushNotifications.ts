import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { savePushToken } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export function usePushNotifications() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !user) return;

    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Pour Across America',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#C4847A',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      try {
        const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
        const projectId =
          extra?.eas?.projectId ??
          ((Constants as Record<string, unknown>).easConfig as { projectId?: string } | undefined)?.projectId;

        const tokenData = projectId
          ? await Notifications.getExpoPushTokenAsync({ projectId })
          : await Notifications.getExpoPushTokenAsync();

        await savePushToken(user.id, tokenData.data);
      } catch (e) {
        console.error('[usePushNotifications] token error:', e);
      }
    })();
  }, [user?.id]);
}
