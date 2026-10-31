import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("SUPABASE ENV MISSING - Check .env file")
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: isWeb ? undefined : AsyncStorage as any, // web uses localStorage automatically
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb ? true : false, // TRUE on web = fixes reset link, FALSE on mobile = prevents warning
    storageKey: 'rapidfundi-main-auth', // prevents Multiple GoTrueClient warning
    flowType: 'pkce', // REQUIRED for new Supabase reset links (?code=)
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    }
  }
})

// === TEMP CLIENT FOR PLUMBER SIGNUP (NO SESSION PERSIST) ===
export const supabaseTemp = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'temp-plumber-signup',
    flowType: 'pkce',
  }
})

// === EAT TIMEZONE HELPERS - USE IN ENTIRE PROJECT ===
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

// === NOTIFICATION HELPERS ===
export const notifyUser = async (userId: string, title: string, message: string, type: string, jobId?: string) => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    job_id: jobId,
    is_read: false
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
  return notifyUser(customerId, title, message, type, jobId)
}

export const notifyPlumber = async (plumberUserId: string, title: string, message: string, type: string, jobId?: string) => {
  return notifyUser(plumberUserId, title, message, type, jobId)
}