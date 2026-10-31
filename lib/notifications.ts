import { supabase } from "./supabase";
import { Platform } from "react-native";

// NO native require here - Expo Go crashes if we do
let Notifications: any = null;
let isExpoGo = true;

// Try to load native module only if NOT in Expo Go
try {
  if (Platform.OS !== 'web') {
    const Constants = require('expo-constants').default;
    if (Constants?.appOwnership !== 'expo' && Constants?.executionEnvironment !== 'storeClient') {
      isExpoGo = false;
      Notifications = require('expo-notifications');
      
      // Handler - safe
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          } as any),
        });
      } catch {}

      // Channel - LAZY & SAFE (this was crashing your APK)
      if (Platform.OS === 'android') {
        (async () => {
          try {
            await new Promise(res => setTimeout(res, 1000)); // wait for native to init
            if (Notifications?.setNotificationChannelAsync) {
              await Notifications.setNotificationChannelAsync('default', {
                name: 'RapidFundi Alerts',
                importance: Notifications.AndroidImportance?.MAX || 5,
                vibrationPattern: [0, 250, 250, 250],
                sound: 'default',
              }).catch(() => {});
            }
          } catch {}
        })();
      }
    }
  }
} catch (e) {
  Notifications = null;
  isExpoGo = true;
}

console.log(`Notifications mode: ${isExpoGo ? 'DB-only (Expo Go)' : 'Native (Dev Build)'}`);

export async function sendNotification(params: {
  user_id: string;
  role?: string;
  title: string;
  message: string;
  type: string;
  job_id?: string;
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.user_id,
    role: params.role,
    title: params.title,
    message: params.message,
    type: params.type,
    job_id: params.job_id,
    is_read: false
  });
  if (error) console.log("Notification error", error);

  // Instant OS popup - only works in dev build
  try {
    if (Notifications && !isExpoGo) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: params.title,
          body: params.message,
          data: { job_id: params.job_id, type: params.type },
          sound: 'default',
        },
        trigger: null,
      });
    }
  } catch (e) {
    console.log("OS push failed (expected in Expo Go)", e);
  }
}

export async function notifyCustomer(userId: string, title: string, message: string, type: string, job_id?: string) {
  return sendNotification({ user_id: userId, role: 'customer', title, message, type, job_id });
}

export async function notifyPlumber(userId: string, title: string, message: string, type: string, job_id?: string) {
  return sendNotification({ user_id: userId, role: 'plumber', title, message, type, job_id });
}

export async function notifyAdmins(title: string, message: string, type: string, job_id?: string) {
  const { error } = await supabase.from('notifications').insert({
    role: 'admin',
    title,
    message,
    type,
    job_id,
    user_id: '00000000-0000-0000-0000-000000000000',
    is_read: false
  } as any);
  if (error) console.log("Admin notify error", error);

  try {
    if (Notifications && !isExpoGo) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data: { job_id, type },
          sound: 'default',
        },
        trigger: null,
      });
    }
  } catch {}
}

export const notifyAdmin = notifyAdmins;

export function subscribeToNotifications(userId: string, callback: (n: any) => void) {
  return supabase
    .channel(`notifs-${userId}`)
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

export function subscribeToAdminNotifications(callback: (n: any) => void) {
  return supabase
    .channel('admin-notifs')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `role=eq.admin` },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

export { Notifications, isExpoGo };