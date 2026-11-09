import * as Notifications from 'expo-notifications';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { auth, db } from '@/lib/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const TOKEN_KEY = 'potholedar:expo-push-token';

export async function setReportStatusNotificationsEnabled(enabled: boolean) {
  if (Platform.OS === 'web') {
    throw new Error('Repair push notifications are available in the Android and iOS app.');
  }
  if (!auth?.currentUser || !db) {
    throw new Error('Sign in with a connected Firebase project before enabling repair alerts.');
  }
  if (!enabled) {
    const existing = await AsyncStorage.getItem(TOKEN_KEY);
    if (existing) {
      const id = existing.replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(
        doc(db, 'users', auth.currentUser.uid, 'pushTokens', id),
        { expoPushToken: existing, enabled: false, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    return;
  }

  const permission = await Notifications.getPermissionsAsync();
  const access = permission.granted
    ? permission
    : await Notifications.requestPermissionsAsync();
  if (!access.granted) throw new Error('Notification permission was not granted.');

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    (await import('expo-constants')).default.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    throw new Error('Add EXPO_PUBLIC_EAS_PROJECT_ID to enable remote repair notifications.');
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  const tokenId = token.data.replace(/[^a-zA-Z0-9_-]/g, '_');
  await setDoc(
    doc(db, 'users', auth.currentUser.uid, 'pushTokens', tokenId),
    {
      expoPushToken: token.data,
      enabled: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await AsyncStorage.setItem(TOKEN_KEY, token.data);
}
