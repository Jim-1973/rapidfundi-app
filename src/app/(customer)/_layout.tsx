import { Tabs } from "expo-router";
import { Text, View, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";

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

  const logout = async () => {
    Alert.alert("Logout?", "Are you sure?", [
      { text: "Cancel", style:"cancel" },
      { text: "Logout", style:"destructive", onPress: async () => {
        await supabase.auth.signOut();
        router.replace("/login" as any);
      }}
    ])
  };

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
    <Tabs 
      screenOptions={{ 
        headerShown: true, 
        tabBarActiveTintColor: "#0ABAB5",
        headerStyle: { backgroundColor: "white" },
        headerTitleStyle: { fontWeight:"900" },
        headerTintColor: "#0A1931",
        headerRight: () => (
          <TouchableOpacity onPress={logout} style={{flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#fee2e2", paddingHorizontal:12, paddingVertical:6, borderRadius:20, marginRight:12}}>
            <Ionicons name="log-out-outline" size={16} color="#991b1b" />
            <Text style={{fontWeight:"800", fontSize:12, color:"#991b1b"}}>Logout</Text>
          </TouchableOpacity>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{ 
          title: "Request", 
          headerTitle: "RapidFundi",
          tabBarIcon: ({color}) => <Ionicons name="home" size={22} color={color} /> 
        }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{ 
          title: "My Jobs", 
          headerTitle: "My Jobs",
          tabBarIcon: ({color}) => <Ionicons name="list" size={22} color={color} /> 
        }}
      />
      <Tabs.Screen 
        name="contact"
        options={{ 
          title: "Contact", 
          headerTitle: "Help & Support",
          tabBarIcon: ({color}) => <Ionicons name="headset" size={22} color={color} /> 
        }} 
      />
    </Tabs>
  );
}