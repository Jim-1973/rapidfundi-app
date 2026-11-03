import { Tabs } from "expo-router";
import { Text, View, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";
import AsyncStorage from '@react-native-async-storage/async-storage';

function LogoHeader({ title }: { title?: string }){
  return (
    <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
      <Image source={require('../../../assets/images/logo.png')} style={{width:28, height:28, resizeMode:'contain'}} />
      <Text style={{fontWeight:'900', fontSize:16, color:'#0A1931'}}>{title || 'RapidFundi'}</Text>
    </View>
  );
}

export default function PlumberLayout() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const session = data.session;
      if (!session) {
        router.replace("/login" as any);
      } else {
        setUserId(session.user.id);
      }
      setChecking(false);
    };
    check();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && mounted) {
        setUserId(undefined);
        router.replace("/login" as any);
      } else if (session && mounted) {
        setUserId(session.user.id);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
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
      setUserId(undefined);
      router.replace("/login" as any);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: "#0ABAB5",
          headerStyle: { backgroundColor: "white" },
          headerTitleStyle: { fontWeight: "900" },
          headerTintColor: "#0A1931",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 12 }}>
              {userId ? <NotificationBell userId={userId} role="plumber" /> : null}
              <TouchableOpacity
                onPress={logout}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "#fee2e2",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                }}
              >
                <Ionicons name="log-out-outline" size={16} color="#991b1b" />
                <Text style={{ fontWeight: "800", fontSize: 12, color: "#991b1b" }}>Logout</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Jobs",
            headerTitle: () => <LogoHeader title="Plumber Jobs" />,
            tabBarIcon: ({ color }: any) => <Ionicons name="construct" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="receipts"
          options={{
            title: "Receipts",
            headerTitle: () => <LogoHeader title="Receipts" />,
            tabBarIcon: ({ color }: any) => <Ionicons name="receipt" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="change-password"
          options={{ href: null, tabBarStyle: { display: "none" }, headerShown: false }}
        />
      </Tabs>

      {checking && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "white",
          }}
        >
          <Image source={require('../../../assets/images/logo.png')} style={{width:80, height:80, resizeMode:'contain', marginBottom:12}} />
          <ActivityIndicator color="#0ABAB5" />
        </View>
      )}
    </View>
  );
}