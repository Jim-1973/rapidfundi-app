import { View, Text, TouchableOpacity, Linking, ScrollView } from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";

const PHONE = "+254722819877";
const PHONE_DISPLAY = "0722 819 877";
const WA = "254722819877";
const EMAIL = "rapidfundi@outlook.com";

export default function Contact() {
  return (
    <ScrollView style={{flex:1, backgroundColor:"#f8fafc"}} contentContainerStyle={{padding:24, paddingTop:60}}>
      
      {/* HEADER */}
      <View style={{alignItems:"center", marginBottom:28}}>
        <View style={{width:72, height:72, borderRadius:36, backgroundColor:"#0A1931", justifyContent:"center", alignItems:"center"}}>
          <Ionicons name="headset" size={32} color="white" />
        </View>
        <Text style={{fontSize:24, fontWeight:"900", marginTop:14}}>We're here to help</Text>
        <View style={{flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#dcfce7", paddingHorizontal:10, paddingVertical:4, borderRadius:20, marginTop:8}}>
          <View style={{width:6, height:6, borderRadius:3, backgroundColor:"#16a34a"}} />
          <Text style={{fontSize:11, fontWeight:"700", color:"#166534"}}>Online • Replies in ~5 mins</Text>
        </View>
      </View>

      {/* PRIMARY ACTIONS - 2 BIG BUTTONS */}
      <View style={{flexDirection:"row", gap:12}}>
        <TouchableOpacity onPress={()=> Linking.openURL(`tel:${PHONE}`)} style={{flex:1, backgroundColor:"white", padding:20, borderRadius:16, borderWidth:1, borderColor:"#e2e8f0", alignItems:"center", elevation:2}}>
          <View style={{width:48, height:48, borderRadius:24, backgroundColor:"#0ABAB5", justifyContent:"center", alignItems:"center"}}>
            <Ionicons name="call" size={22} color="white" />
          </View>
          <Text style={{fontWeight:"900", marginTop:10}}>Call</Text>
          <Text style={{fontSize:11, color:"#64748b", marginTop:2}}>{PHONE_DISPLAY}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={()=> Linking.openURL(`https://wa.me/${WA}?text=${encodeURIComponent("Hi RapidFundi, I need help")}`)} style={{flex:1, backgroundColor:"#0A1931", padding:20, borderRadius:16, alignItems:"center", elevation:2}}>
          <View style={{width:48, height:48, borderRadius:24, backgroundColor:"white", justifyContent:"center", alignItems:"center"}}>
            <FontAwesome5 name="whatsapp" size={22} color="#0A1931" />
          </View>
          <Text style={{fontWeight:"900", marginTop:10, color:"white"}}>WhatsApp</Text>
          <Text style={{fontSize:11, color:"#94a3b8", marginTop:2}}>Fastest</Text>
        </TouchableOpacity>
      </View>

      {/* EMAIL - SINGLE LINE */}
      <TouchableOpacity onPress={()=> Linking.openURL(`mailto:${EMAIL}`)} style={{backgroundColor:"white", marginTop:14, padding:16, borderRadius:16, borderWidth:1, borderColor:"#e2e8f0", flexDirection:"row", alignItems:"center", gap:12}}>
        <View style={{width:40, height:40, borderRadius:20, backgroundColor:"#f1f5f9", justifyContent:"center", alignItems:"center"}}>
          <Ionicons name="mail-outline" size={20} color="#334155" />
        </View>
        <View style={{flex:1}}>
          <Text style={{fontSize:12, color:"#64748b"}}>Email us</Text>
          <Text style={{fontWeight:"700"}}>{EMAIL}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      </TouchableOpacity>

      {/* FOOTER INFO */}
      <View style={{marginTop:24, backgroundColor:"white", padding:14, borderRadius:12, borderWidth:1, borderColor:"#e2e8f0"}}>
        <View style={{flexDirection:"row", gap:8}}>
          <Ionicons name="time-outline" size={14} color="#64748b" />
          <Text style={{fontSize:12, color:"#64748b"}}>Support hours: 7am - 9pm daily</Text>
        </View>
        <View style={{flexDirection:"row", gap:8, marginTop:6}}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#64748b" />
          <Text style={{fontSize:12, color:"#64748b"}}>Emergency leaks prioritized — 30 min response</Text>
        </View>
      </View>

    </ScrollView>
  )
}