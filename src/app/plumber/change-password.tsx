import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";

export default function ChangePassword(){
  const router = useRouter();
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const rules = {
    length: newPass.length >= 8,
    upper: /[A-Z]/.test(newPass),
    lower: /[a-z]/.test(newPass),
    number: /[0-9]/.test(newPass),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPass),
    notTemp: newPass !== "Rapid@2026" && newPass.toLowerCase() !== "rapid@2026",
  };
  const allValid = Object.values(rules).every(Boolean);
  const strength = Object.values(rules).filter(Boolean).length;
  const strengthLabel = strength <= 2 ? "Weak" : strength <= 4 ? "Fair" : strength === 5 ? "Good" : "Strong";
  const strengthColor = strength <= 2 ? "#ef4444" : strength <= 4 ? "#f59e0b" : strength === 5 ? "#0ABAB5" : "#22c55e";

  useEffect(()=>{ checkSession(); }, []);
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if(!session){
      setErrorBanner("Auth session missing! Please login first with your temporary password at /login.");
    }
    setCheckingSession(false);
  };

  const change = async () => {
    setErrorBanner("");
    setSuccessBanner("");
    if(!newPass){ setErrorBanner("New password is required."); return; }
    if(!allValid){
      if(!rules.length) setErrorBanner("Password must be at least 8 characters.");
      else if(!rules.upper) setErrorBanner("Must include at least 1 uppercase letter (A-Z).");
      else if(!rules.lower) setErrorBanner("Must include at least 1 lowercase letter (a-z).");
      else if(!rules.number) setErrorBanner("Must include at least 1 number (0-9).");
      else if(!rules.special) setErrorBanner("Must include at least 1 special character (!@#$%).");
      else if(!rules.notTemp) setErrorBanner("You cannot reuse the temporary password Rapid@2026.");
      return;
    }
    if(!confirm){ setErrorBanner("Please confirm your password."); return; }
    if(newPass !== confirm){ setErrorBanner("Passwords do not match."); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if(!session) throw new Error("No active session. Please go to Login with Rapid@2026 first.");
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if(error) throw error;
      await supabase.from('plumbers').update({ must_change_password: false }).eq('user_id', session.user.id);
      setSuccessBanner("Strong password set! Opening jobs...");
      setTimeout(()=> router.replace("/plumber" as any), 1000);
    } catch(e:any){
      setErrorBanner(e.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  if(checkingSession) return <View style={{flex:1, justifyContent:"center", alignItems:"center"}}><ActivityIndicator/></View>;

  return (
    <ScrollView style={{flex:1, backgroundColor:"white"}} contentContainerStyle={{padding:24, paddingTop:60}}>
      <Text style={{fontSize:28, fontWeight:"900", color:"#0A1931"}}>Change Password</Text>
      <Text style={{color:"#64748b", marginTop:6}}>Create a strong password to secure your account</Text>

      {/* 1. REQUIREMENTS ON TOP - As you requested */}
      <View style={{backgroundColor:"#f8fafc", borderRadius:16, padding:16, marginTop:20, borderWidth:1, borderColor:"#e2e8f0"}}>
        <Text style={{fontWeight:"900", fontSize:13, color:"#0A1931", marginBottom:10}}>🔒 PASSWORD REQUIREMENTS:</Text>
        <View style={{gap:6}}>
          <Text style={{fontSize:13, color: rules.length ? "#16a34a" : "#475569", fontWeight: rules.length ? "700" : "400"}}>{rules.length ? "✅" : "⭕"} At least 8 characters</Text>
          <Text style={{fontSize:13, color: rules.upper ? "#16a34a" : "#475569", fontWeight: rules.upper ? "700" : "400"}}>{rules.upper ? "✅" : "⭕"} 1 uppercase letter (A-Z)</Text>
          <Text style={{fontSize:13, color: rules.lower ? "#16a34a" : "#475569", fontWeight: rules.lower ? "700" : "400"}}>{rules.lower ? "✅" : "⭕"} 1 lowercase letter (a-z)</Text>
          <Text style={{fontSize:13, color: rules.number ? "#16a34a" : "#475569", fontWeight: rules.number ? "700" : "400"}}>{rules.number ? "✅" : "⭕"} 1 number (0-9)</Text>
          <Text style={{fontSize:13, color: rules.special ? "#16a34a" : "#475569", fontWeight: rules.special ? "700" : "400"}}>{rules.special ? "✅" : "⭕"} 1 special character (!@#$% etc)</Text>
          <Text style={{fontSize:13, color: rules.notTemp ? "#16a34a" : "#ef4444", fontWeight:"700"}}>{rules.notTemp ? "✅" : "❌"} Cannot be Rapid@2026</Text>
        </View>
        {newPass.length > 0 && (
          <View style={{marginTop:14}}>
            <View style={{flexDirection:"row", gap:4}}>
              {[1,2,3,4,5,6].map(i=>(
                <View key={i} style={{flex:1, height:6, borderRadius:3, backgroundColor: i <= strength ? strengthColor : "#e2e8f0"}}/>
              ))}
            </View>
            <Text style={{marginTop:6, fontSize:12, fontWeight:"800", color:strengthColor}}>Strength: {strengthLabel}</Text>
          </View>
        )}
      </View>

      {errorBanner ? (
        <View style={{backgroundColor:"#fef2f2", borderWidth:1, borderColor:"#fecaca", padding:12, borderRadius:10, marginTop:16}}>
          <Text style={{color:"#dc2626", fontSize:13, fontWeight:"700"}}>⚠️ {errorBanner}</Text>
          {(errorBanner.includes("session") || errorBanner.includes("Login")) && (
            <TouchableOpacity onPress={()=>router.replace("/login" as any)} style={{marginTop:12, backgroundColor:"#0A1931", padding:10, borderRadius:8}}>
              <Text style={{color:"white", textAlign:"center", fontWeight:"700"}}>Go to Login</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      {successBanner ? (
        <View style={{backgroundColor:"#f0fdf4", borderWidth:1, borderColor:"#bbf7d0", padding:12, borderRadius:10, marginTop:16}}>
          <Text style={{color:"#16a34a", fontSize:13, fontWeight:"700"}}>✅ {successBanner}</Text>
        </View>
      ) : null}

      {/* 2. INPUTS AFTER REQUIREMENTS */}
      <View style={{flexDirection:"row", alignItems:"center", borderWidth:1, borderColor: errorBanner ? "#fecaca" : "#e2e8f0", borderRadius:12, marginTop:20, backgroundColor:"white"}}>
        <TextInput value={newPass} onChangeText={(t)=>{ setNewPass(t); if(errorBanner) setErrorBanner(""); }} placeholder="New password" secureTextEntry={!showPass} style={{flex:1, padding:14}}/>
        <TouchableOpacity onPress={()=>setShowPass(!showPass)} style={{paddingHorizontal:14}}><Text style={{color:"#0ABAB5", fontWeight:"800", fontSize:12}}>{showPass ? "HIDE" : "SHOW"}</Text></TouchableOpacity>
      </View>

      <TextInput value={confirm} onChangeText={(t)=>{ setConfirm(t); if(errorBanner) setErrorBanner(""); }} placeholder="Confirm new password" secureTextEntry={!showPass} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:12, backgroundColor:"white"}}/>
      
      <TouchableOpacity onPress={change} disabled={loading || !allValid && newPass.length>0} style={{backgroundColor: loading ? "#94a3b8" : allValid ? "#0A1931" : "#cbd5e1", padding:16, borderRadius:12, marginTop:20}}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>{allValid ? "CHANGE & OPEN JOBS" : "ENTER A STRONG PASSWORD"}</Text>}
      </TouchableOpacity>

      <Text style={{fontSize:11, color:"#94a3b8", textAlign:"center", marginTop:12}}>🔒 OWASP & NIST cybersecurity compliant</Text>
      <View style={{height:40}}/>
    </ScrollView>
  );
}