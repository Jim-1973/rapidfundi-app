import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";

const SUPPORT_PHONE = "+254743525184"; // <-- CHANGE TO YOUR REAL NUMBER
const SUPPORT_WA = "254743525184"; // without + for wa.me
const SUPPORT_EMAIL = "kaumbajim@gmail.com";
const SUPPORT_SMS = "+254743525184"; // <-- CHANGE TO YOUR REAL NUMBER

export default function ContactPage() {

  const callTeam = async () => {
    const url = `tel:${SUPPORT_PHONE}`;
    const can = await Linking.canOpenURL(url);
    if(!can) return Alert.alert("Cannot make call");
    Linking.openURL(url);
  };

  const whatsappTeam = async () => {
    // pre-filled message
    const message = encodeURIComponent("Hi RapidFundi Team, I need help with my plumbing job...");
    const url = `https://wa.me/${SUPPORT_WA}?text=${message}`;
    Linking.openURL(url);
  };

  const smsTeam = async () => {
    const url = `sms:${SUPPORT_SMS}?body=${encodeURIComponent("Hi RapidFundi,")}`;
    Linking.openURL(url);
  };

  const emailTeam = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("RapidFundi Support")}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView style={{flex:1, backgroundColor:"white"}} contentContainerStyle={{padding:20, paddingTop:50}}>
      <Text style={{fontSize:26, fontWeight:"900"}}>Contact Support</Text>
      <Text style={{color:"#64748b", marginTop:4}}>We respond in under 10 minutes — 7am to 9pm</Text>

      <View style={{marginTop:24, gap:14}}>
        
        {/* CALL */}
        <TouchableOpacity onPress={callTeam} style={{backgroundColor:"#0ABAB5", padding:18, borderRadius:14, flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
          <View>
            <Text style={{color:"white", fontWeight:"900", fontSize:16}}>📞 Call Team</Text>
            <Text style={{color:"white", opacity:0.9, marginTop:2, fontSize:12}}>{SUPPORT_PHONE} • Instant</Text>
          </View>
          <Text style={{color:"white", fontWeight:"800"}}>CALL →</Text>
        </TouchableOpacity>

        {/* WHATSAPP */}
        <TouchableOpacity onPress={whatsappTeam} style={{backgroundColor:"#dcfce7", padding:18, borderRadius:14, borderWidth:1, borderColor:"#16a34a", flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
          <View>
            <Text style={{color:"#166534", fontWeight:"900", fontSize:16}}>💬 WhatsApp Us</Text>
            <Text style={{color:"#166534", marginTop:2, fontSize:12}}>Fastest — Photos & location</Text>
          </View>
          <Text style={{color:"#166534", fontWeight:"800"}}>CHAT →</Text>
        </TouchableOpacity>

        {/* SMS */}
        <TouchableOpacity onPress={smsTeam} style={{backgroundColor:"white", padding:18, borderRadius:14, borderWidth:1, borderColor:"#e2e8f0", flexDirection:"row", justifyContent:"space-between"}}>
          <View>
            <Text style={{fontWeight:"900", fontSize:16}}>✉️ Send SMS</Text>
            <Text style={{color:"#64748b", marginTop:2, fontSize:12}}>If you have no data</Text>
          </View>
          <Text style={{fontWeight:"800"}}>SMS →</Text>
        </TouchableOpacity>

        {/* EMAIL */}
        <TouchableOpacity onPress={emailTeam} style={{backgroundColor:"#f8fafc", padding:18, borderRadius:14, borderWidth:1, borderColor:"#e2e8f0"}}>
          <Text style={{fontWeight:"900", fontSize:16}}>📧 Email</Text>
          <Text style={{color:"#64748b", marginTop:2, fontSize:12}}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>

        {/* Emergency */}
        <View style={{backgroundColor:"#fef2f2", padding:14, borderRadius:12, borderWidth:1, borderColor:"#fecaca", marginTop:10}}>
          <Text style={{fontWeight:"800", color:"#991b1b"}}>🚨 Emergency Leak? Call directly</Text>
          <Text style={{fontSize:12, color:"#991b1b", marginTop:4}}>If water is flooding, use the Call button — we prioritize EN_ROUTE jobs and will dispatch in 30 mins.</Text>
        </View>

      </View>
    </ScrollView>
  )
}