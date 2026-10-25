import { supabase } from "./supabase";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Setup handler once
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'RapidFundi Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
}

// BASE - saves to DB + fires OS push instantly
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

  // Instant OS popup even if app in background
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.message,
        data: { job_id: params.job_id, type: params.type },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (e) {}
}

// COMPAT for your old admin code - admin/index.tsx calls these
export async function notifyCustomer(userId: string, title: string, message: string, type: string, job_id?: string) {
  return sendNotification({ user_id: userId, role: 'customer', title, message, type, job_id });
}

export async function notifyPlumber(userId: string, title: string, message: string, type: string, job_id?: string) {
  return sendNotification({ user_id: userId, role: 'plumber', title, message, type, job_id });
}

// FIXED ADMIN - inserts with role=admin so admin panel can listen by role, plus fires OS push
export async function notifyAdmins(title: string, message: string, type: string, job_id?: string) {
  // 1. Save for admin panel (filter by role=admin)
  await supabase.from('notifications').insert({
    role: 'admin',
    title,
    message,
    type,
    job_id,
    user_id: '00000000-0000-0000-0000-000000000000', // dummy but role is what matters
    is_read: false
  } as any);

  // 2. Instant OS push for any admin with app open (realtime on jobs table already handles it too)
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: { job_id, type },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {}
}

// NEW: For NotificationBell.tsx - auto update without refresh
export function subscribeToNotifications(userId: string, callback: (n: any) => void) {
  return supabase
    .channel(`notifs-${userId}`)
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

// NEW: For Admin - listen by role=admin
export function subscribeToAdminNotifications(callback: (n: any) => void) {
  return supabase
    .channel('admin-notifs')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `role=eq.admin` },
      (payload) => callback(payload.new)
    )
    .subscribe();
}