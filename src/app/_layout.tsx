import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import * as SecureStore from 'expo-secure-store';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const killGhost = async () => {
      try {
        const keys = [
          'rapidfundi-main-auth',
          'rapidfundi-main-auth-code-verifier',
          'sb-338767c9-8e70-4613-9408-5159e3e658e3-auth-token',
          'sb-338767c9-8e70-4613-9408-5159e3e658e3-auth-token-code-verifier',
          'supabase-auth-token',
        ];
        for (const k of keys) {
          try { await SecureStore.deleteItemAsync(k); } catch {}
          try { 
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.removeItem(k); 
          } catch {}
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const { error } = await supabase.auth.getUser();
          if (error) await supabase.auth.signOut();
        }
      } catch {}
      setReady(true);
    };
    killGhost();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="plumber" />
      </Stack>

      {!ready && (
        <View style={{ position:"absolute", top:0, left:0, right:0, bottom:0, justifyContent:"center", alignItems:"center", backgroundColor:"white" }}>
          <ActivityIndicator color="#0ABAB5" />
        </View>
      )}
    </View>
  );
}