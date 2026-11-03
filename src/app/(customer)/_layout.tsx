import { Tabs } from "expo-router";
import { Text, View, ActivityIndicator, Image } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import NotificationBell from "../../components/NotificationBell";

const ADMIN_DISPLAY = "0722819877";
const LOGO_URL = "https://qyqaqnkxtmsrrctknhxi.supabase.co/storage/v1/object/public/public-assets/logo.png";

function LogoHeader({ title, customerName }: { title?: string; customerName?: string }){
  return (
    <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
      <Image source={{uri: LOGO_URL}} style={{width:28, height:28, resizeMode:'contain', borderRadius:6}} />
      <View>
        <Text style={{fontWeight:'900', fontSize:14, color:'#0A1931'}}>{title || 'RapidFundi'}</Text>
        {customerName ? <Text style={{fontSize:10, color:'#0ABAB5', fontWeight:'700'}}>Hi {customerName} 👋</Text> : null}
      </View>
    </View>
  );
}

export default function CustomerLayout() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if(!mounted) return;
      const session = data.session;
      if (!session) {
        router.replace("/login" as any);
      } else {
        setHasSession(true);
        setUserId(session.user.id);
        try {
          const { data: cust } = await supabase.from('customers').select('full_name, name, first_name').eq('id', session.user.id).maybeSingle();
          const full = cust?.full_name || (cust as any)?.name || (cust as any)?.first_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || "";
          if (full) setCustomerName(full.split(" ")[0]);
        } catch {}
      }
      setChecking(false);
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if(!session && mounted){
        setHasSession(false);
        setCustomerName("");
        router.replace("/login" as any);
      } else if(session && mounted){
        setUserId(session.user.id);
        setHasSession(true);
      }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); }
  }, []);

  if (checking) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" }}><Image source={{uri: LOGO_URL}} style={{width:60, height:60, resizeMode:'contain', marginBottom:12}} /><ActivityIndicator color="#0ABAB5" /></View>;
  if (!hasSession) return null;

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false, // <-- DELETE ALL UPPER HEADERS - WE USE CUSTOM CARD INSIDE SCREENS
        tabBarActiveTintColor: "#0ABAB5",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: { backgroundColor:"white", borderTopWidth:1, borderColor:"#e2e8f0", height:60, paddingBottom:6, paddingTop:4 },
        headerStyle: { backgroundColor: "white" },
        headerTitleStyle: { fontWeight:"900" },
        headerTintColor: "#0A1931",
      }}>
      <Tabs.Screen
        name="index"
        options={{ 
          title: "Request", 
          headerShown: false,
          tabBarIcon: ({color}: any) => <Ionicons name="home" size={22} color={color} /> 
        }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{ 
          title: "My Jobs", 
          headerShown: false, // <-- THIS DELETES YOUR CIRCLED UPPER PART
          tabBarIcon: ({color}: any) => <Ionicons name="list" size={22} color={color} /> 
        }}
      />
      <Tabs.Screen 
        name="contact"
        options={{ 
          title: "Contact", 
          headerShown: false, // <-- ALSO DELETE FOR CONTACT TO KEEP PROFESSIONAL
          tabBarIcon: ({color}: any) => <Ionicons name="call-outline" size={22} color={color} /> 
        }} 
      />
      <Tabs.Screen name="profile" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="receipts" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}