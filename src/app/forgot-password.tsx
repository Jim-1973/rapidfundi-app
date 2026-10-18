import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";

export default function ForgotPassword(){
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const router = useRouter();

  const sendReset = async () => {
    setErrorBanner("");
    setSuccessBanner("");
    const emailTrim = email.trim().toLowerCase();

    if(!emailTrim){
      setErrorBanner("Email address is required.");
      return;
    }
    if(!/\S+@\S+\.\S+/.test(emailTrim)){
      setErrorBanner("Invalid email format. Example: customer@gmail.com");
      return;
    }

    setLoading(true);
    try{
      // 1. CHECK IF CUSTOMER EXISTS - ONLY EXISTING USERS CAN RESET
      const { data: customer } = await supabase
        .from('customers')
        .select('id, email')
        .eq('email', emailTrim)
        .maybeSingle();

      const { data: plumber } = await supabase
        .from('plumbers')
        .select('id, email')
        .eq('email', emailTrim)
        .maybeSingle();

      // If not found in customers or plumbers
      if(!customer && !plumber){
        // Also check if email contains admin as fallback
        if(!emailTrim.includes("admin")){
          setErrorBanner(`No account found for ${emailTrim}. Please Sign Up first.`);
          setLoading(false);
          return;
        }
      }

      // 2. SEND RESET ONLY IF EXISTS
      const { error } = await supabase.auth.resetPasswordForEmail(emailTrim, {
        redirectTo: "http://localhost:8081/reset-password",
      });
      
      if(error) throw error;
      
      setSuccessBanner(`Reset link sent to ${emailTrim}! Check your inbox.`);
      setTimeout(()=> router.replace("/login" as any), 2000);

    }catch(e:any){
      setErrorBanner(e.message || "Failed to send reset link. Try again.");
    }finally{
      setLoading(false);
    }
  };

  return (
    <View style={{flex:1, backgroundColor:"white", padding:24, justifyContent:"center"}}>
      <Text style={{fontSize:28, fontWeight:"900", color:"#0A1931"}}>Forgot Password?</Text>
      <Text style={{color:"#64748b", marginTop:6}}>Only registered customers can reset password</Text>

      {errorBanner ? (
        <View style={{backgroundColor:"#fef2f2", borderWidth:1, borderColor:"#fecaca", padding:12, borderRadius:10, marginTop:16}}>
          <Text style={{color:"#dc2626", fontSize:13, fontWeight:"700"}}>⚠️ {errorBanner}</Text>
        </View>
      ) : null}

      {successBanner ? (
        <View style={{backgroundColor:"#f0fdf4", borderWidth:1, borderColor:"#bbf7d0", padding:12, borderRadius:10, marginTop:16}}>
          <Text style={{color:"#16a34a", fontSize:13, fontWeight:"700"}}>✅ {successBanner}</Text>
        </View>
      ) : null}

      <TextInput 
        value={email} 
        onChangeText={(t)=>{ setEmail(t); if(errorBanner) setErrorBanner(""); }} 
        placeholder="Email address" 
        autoCapitalize="none" 
        keyboardType="email-address"
        style={{borderWidth:1, borderColor: errorBanner ? "#fecaca" : "#e2e8f0", borderRadius:12, padding:14, marginTop:20, backgroundColor:"#f8fafc"}} 
      />

      <TouchableOpacity onPress={sendReset} disabled={loading} style={{backgroundColor: loading ? "#94a3b8" : "#0ABAB5", padding:16, borderRadius:12, marginTop:16}}>
        {loading? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"800", letterSpacing:0.5}}>SEND RESET LINK</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={()=>router.replace("/login" as any)} style={{marginTop:20}}>
        <Text style={{textAlign:"center", color:"#64748b", fontWeight:"700", fontSize:13}}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}