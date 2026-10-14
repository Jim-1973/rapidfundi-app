import { Tabs } from "expo-router";
import { Text, View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";

export default function CustomerLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      const session = res.data.session;
      if (!session) {
        router.replace("/login" as any);
      } else {
        setHasSession(true);
      }
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" }}>
        <ActivityIndicator color="#0ABAB5" />
      </View>
    );
  }

  if (!hasSession) {
    return null;
  }

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0ABAB5" }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Request", tabBarIcon: () => <Text>🏠</Text> }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{ title: "My Jobs", tabBarIcon: () => <Text>📋</Text> }}
      />
    </Tabs>
  );
}