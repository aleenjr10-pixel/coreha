import { Linking, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { loadOptional } from './optionalModule';
import { supabase } from './supabase';

// Everything in this file degrades to a no-op when expo-notifications' native module is
// missing or fails: the rest of the app keeps working, only alerts on this phone are off.

type NotificationsModule = typeof import('expo-notifications');

// Must match channelId in public.send_alert_push and defaultChannel in app.json.
export const CRITICAL_CHANNEL = 'critical-alerts';

// 'unsupported': web, Expo Go, or a build without the notifications module.
// 'not-configured': the build has no EAS project id yet (run `npx eas-cli init`).
export type PushStatus = 'enabled' | 'denied' | 'blocked' | 'unsupported' | 'not-configured' | 'error';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let handlerInstalled = false;
let registeredToken: string | null = null;

function notifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  const module = loadOptional<NotificationsModule>('expo-notifications', () => require('expo-notifications'));
  if (module && !handlerInstalled) {
    handlerInstalled = true;
    try {
      // Show alerts even while the app is open.
      module.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (err) {
      console.warn('[push] could not install the notification handler', err);
    }
  }
  return module;
}

async function ensureCriticalChannel(module: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  // Android 13+ only shows the permission prompt once a channel exists. A failure here
  // must not stop registration: Android then falls back to the default channel.
  try {
    await module.setNotificationChannelAsync(CRITICAL_CHANNEL, {
      name: 'Critical maintenance alerts',
      description: 'Equipment that needs maintenance now.',
      importance: module.AndroidImportance.MAX,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 600, 300, 600, 300, 600],
      lockscreenVisibility: module.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  } catch (err) {
    console.warn('[push] could not create the critical alerts channel', err);
  }
}

// Registers this phone for maintenance alerts. With askPermission false it only checks,
// so screens can show the current state without prompting. Never throws.
export async function registerForPush(askPermission: boolean): Promise<PushStatus> {
  if (isExpoGo) return 'unsupported';
  const module = notifications();
  if (!module) return 'unsupported';

  try {
    await ensureCriticalChannel(module);

    let permission = await module.getPermissionsAsync();
    if (!permission.granted && askPermission && permission.canAskAgain) {
      permission = await module.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: true },
      });
    }
    if (!permission.granted) return permission.canAskAgain ? 'denied' : 'blocked';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'not-configured';

    const { data: token } = await module.getExpoPushTokenAsync({ projectId });
    if (!supabase) return 'error';
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) throw error;

    registeredToken = token;
    return 'enabled';
  } catch (err) {
    console.warn('[push] registration failed', err);
    return 'error';
  }
}

// Called before sign-out so the next person using this phone doesn't get these alerts.
export async function unregisterPush() {
  if (!registeredToken || !supabase) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: registeredToken });
  } catch {
    // Signing out must not fail because of this.
  }
  registeredToken = null;
}

function isMaintenanceAlert(data: unknown) {
  return typeof data === 'object' && data !== null && (data as { type?: unknown }).type === 'maintenance_alert';
}

// Runs the callback when a maintenance alert arrives while the app is open.
// Returns an unsubscribe function (a no-op when notifications are unavailable).
export function onAlertReceived(callback: () => void): () => void {
  const module = notifications();
  if (!module) return () => {};
  try {
    const subscription = module.addNotificationReceivedListener((notification) => {
      if (isMaintenanceAlert(notification.request.content.data)) callback();
    });
    return () => subscription.remove();
  } catch (err) {
    console.warn('[push] could not listen for alerts', err);
    return () => {};
  }
}

// Runs the callback when the user taps a maintenance alert, including the tap that
// launched the app. Returns an unsubscribe function.
export function onAlertOpened(callback: () => void): () => void {
  const module = notifications();
  if (!module) return () => {};

  let handled: string | null = null;
  const handle = (response: { notification: { request: { identifier: string; content: { data?: unknown } } } } | null) => {
    if (!response || response.notification.request.identifier === handled) return;
    handled = response.notification.request.identifier;
    if (isMaintenanceAlert(response.notification.request.content.data)) callback();
  };

  try {
    handle(module.getLastNotificationResponse());
  } catch (err) {
    console.warn('[push] could not read the launching notification', err);
  }

  try {
    const subscription = module.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  } catch (err) {
    console.warn('[push] could not listen for alert taps', err);
    return () => {};
  }
}

export function openNotificationSettings() {
  return Linking.openSettings().catch(() => {});
}
