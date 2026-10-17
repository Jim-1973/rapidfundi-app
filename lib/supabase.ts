import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("SUPABASE ENV MISSING - Check .env file")
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'rapidfundi-main-auth', // FIX: prevents Multiple GoTrueClient warning
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
    storageKey: 'temp-plumber-signup', // Different key = no clash
  }
})

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
    user_id: '00000000-0000-0000-0000-000000000000' // dummy, admin fetches by role
  } as any)
  if(error) console.log("notifyAdmin error:", error.message)
}

export const notifyCustomer = async (customerId: string, title: string, message: string, type: string, jobId?: string) => {
  return notifyUser(customerId, title, message, type, jobId)
}

export const notifyPlumber = async (plumberUserId: string, title: string, message: string, type: string, jobId?: string) => {
  return notifyUser(plumberUserId, title, message, type, jobId)
}