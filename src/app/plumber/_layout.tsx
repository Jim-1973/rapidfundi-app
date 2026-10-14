import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function PlumberLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0ABAB5" }}>
      <Tabs.Screen name="index" options={{ title: "Jobs", tabBarIcon: () => <Text>🔧</Text> }} />
      <Tabs.Screen name="login" options={{ href: null, tabBarStyle: {display:"none"} }} />
      <Tabs.Screen name="change-password" options={{ href: null, tabBarStyle: {display:"none"} }} />
    </Tabs>
  );
}