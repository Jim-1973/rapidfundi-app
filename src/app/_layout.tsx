import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="plumber" />
    </Stack>
  );
}