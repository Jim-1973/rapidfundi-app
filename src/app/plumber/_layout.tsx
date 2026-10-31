import { Tabs } from "expo-router";
import { Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";

export default function PlumberLayout() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      const session = res.data.session;
      if (!session) {
        router.replace("/login" as any);
      } else {
        setUserId(session.user.id);
      }
      setChecking(false);
    });
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login" as any);
  };

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" }}>
        <ActivityIndicator color="#0ABAB5" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#0ABAB5",
        headerStyle: { backgroundColor: "white" },
        headerTitleStyle: { fontWeight: "900" },
        headerTintColor: "#0A1931",
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 12 }}>
            <NotificationBell userId={userId} />
            <TouchableOpacity onPress={logout} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fee2e2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
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
          headerTitle: "Plumber Jobs",
          tabBarIcon: ({ color }) => <Ionicons name="construct" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="change-password"
        options={{ href: null, tabBarStyle: { display: "none" }, headerShown: false }}
      />
    </Tabs>
  );
}