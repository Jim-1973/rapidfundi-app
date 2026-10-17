import { Stack } from "expo-router";
import { View, TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";

export default function AdminLayout() {
  const router = useRouter();

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login" as any);
  };

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