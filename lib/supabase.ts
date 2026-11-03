import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("SUPABASE ENV MISSING - Check .env file")
}

const isWeb = Platform.OS === 'web';

// === FIXED: SecureStore ONLY - No AsyncStorage fallback that brings ghost back ===
const SecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      if (isWeb) {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      }
      // ONLY SecureStore, never AsyncStorage
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (isWeb) {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.log("SecureStore setItem error", e);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (isWeb) {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {}
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: isWeb ? undefined : (SecureStoreAdapter as any),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'rapidfundi-main-auth',
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    }
  }
})

export const supabaseTemp = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'temp-plumber-signup',
    flowType: 'pkce',
  }
})

export const toEAT = (dateStr?: string | null) => {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("en-KE", {
      timeZone: "Africa/Nairobi",
      hour12: true,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr || "";
  }
};

export const nowEAT = () => {
  return new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
};

export const notifyUser = async (userId: string, title: string, message: string, type: string, jobId?: string, role: string = 'customer') => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    job_id: jobId,
    is_read: false,
    role: role
  } as any)
  if(error) console.log("notifyUser error:", error.message)
}

export const notifyAdmin = async (title: string, message: string, type: string, jobId?: string) => {
  const { error } = await supabase.from('notifications').insert({
    role: 'admin',
    title,
    message,
    type,
    job_id: jobId,
    is_read: false,
    user_id: '00000000-0000-0000-0000-000000000000'
  } as any)
  if(error) console.log("notifyAdmin error:", error.message)
}

export const notifyCustomer = async (customerId: string, title: string, message: string, type: string, jobId?: string) => {
  return notifyUser(customerId, title, message, type, jobId, 'customer')
}

export const notifyPlumber = async (plumberUserId: string, title: string, message: string, type: string, jobId?: string) => {
  return notifyUser(plumberUserId, title, message, type, jobId, 'plumber')
}