import { Stack } from "expo-router";
import { View, TouchableOpacity, Text, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminLayout() {
  const router = useRouter();

  useEffect(() => {
    // BYPASS for localhost:8081 - keep old behavior
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const host = window.location.hostname;
      const href = window.location.href;
      if (host === 'localhost' || host === '127.0.0.1' || href.includes('8081') || href.includes('localhost')) {
        console.log("Admin layout bypass - localhost:8081");
        return; // Don't check auth on localhost
      }
    }

    // On phone app - don't redirect, let index.tsx show blank silently
    if (Platform.OS !== 'web') {
      return;
    }

    // Only for production web, if you ever deploy admin
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if(!session){
        // Don't redirect on localhost, only production
        // router.replace("/login" as any);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    // On localhost:8081, logout just reloads - no login needed
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.href.includes('8081')) {
      window.location.reload();
      return;
    }
    try {
      await supabase.auth.signOut();
      await AsyncStorage.clear();
      try {
        const SecureStore = require('expo-secure-store');
        await SecureStore.deleteItemAsync('rapidfundi-main-auth');
        await SecureStore.deleteItemAsync('supabase-auth-token');
        await SecureStore.deleteItemAsync('sb-rapidfundi-main-auth');
      } catch {}
    } catch {}
    finally {
      router.replace("/login" as any);
    }
  };

  // Phone app: hide header completely - blank
  if (Platform.OS !== 'web') {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "white" },
        headerTitleStyle: { fontWeight: "900" },
        headerTintColor: "#0A1931",
        headerTitle: "Admin Panel",
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 12 }}>
            <NotificationBell role="admin" />
            <TouchableOpacity onPress={logout} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fee2e2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Ionicons name="log-out-outline" size={16} color="#991b1b" />
              <Text style={{ fontWeight: "800", fontSize: 12, color: "#991b1b" }}>Logout</Text>
            </TouchableOpacity>
          </View>
        ),
      }}
    />
  );
}