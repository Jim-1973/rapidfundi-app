import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";

export default function Login(){
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    // 1. Inline validation - no Alert
    const newErrors = { email: "", password: "" };
    let hasError = false;
    
    if(!email.trim()){
      newErrors.email = "Email is required";
      hasError = true;
    } else if(!/\S+@\S+\.\S+/.test(email)){
      newErrors.email = "Enter valid email";
      hasError = true;
    }
    
    if(!password){
      newErrors.password = "Password is required";
      hasError = true;
    }
    
    setErrors(newErrors);
    if(hasError) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if(error) throw error;

      const userId = data.user.id;
      console.log("Logged in userId:", userId);

      // 1. Check if PLUMBER (must be created by admin via WhatsApp)
      const { data: plumber, error: pError } = await supabase.from('plumbers').select('id, must_change_password').eq('user_id', userId).maybeSingle();
      console.log("Plumber check:", plumber, pError);
      
      if(plumber){
        if(plumber.must_change_password){
          router.replace("/admin/plumber/change-password" as any);
          return;
        }
        router.replace("/admin/plumber" as any);
        return;
      }

      // 2. Default = CUSTOMER
      const { data: cust } = await supabase.from('customers').select('id').eq('id', userId).maybeSingle();
      if(!cust){
        await supabase.from('customers').insert({ id: userId, email: data.user.email });
      }

      router.replace("/(customer)" as any);

    } catch(e:any){
      Alert.alert("Login Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{flex:1, backgroundColor:"white", padding:24, justifyContent:"center"}}>
      <Text style={{fontSize:32, fontWeight:"900"}}>Welcome Back</Text>
      <Text style={{color:"#64748b", marginTop:6}}>Login to RapidFundi</Text>
      <Text style={{fontSize:11, color:"#94a3b8", marginTop:4}}>Customer self-register • Plumber must be added by Admin</Text>
      
      {/* Email with required notice */}
      <View style={{marginTop:24}}>
        <TextInput 
          value={email} 
          onChangeText={(t)=>{ setEmail(t); if(errors.email) setErrors({...errors, email:""}) }} 
          placeholder="Email" 
          autoCapitalize="none" 
          keyboardType="email-address" 
          style={{borderWidth:1, borderColor: errors.email ? "#ef4444" : "#e2e8f0", borderRadius:12, padding:14}}
        />
        {errors.email ? <Text style={{color:"#ef4444", fontSize:12, marginTop:6, fontWeight:"600"}}>{errors.email}</Text> : null}
      </View>

      {/* Password with required notice */}
      <View style={{marginTop:12}}>
        <TextInput 
          value={password} 
          onChangeText={(t)=>{ setPassword(t); if(errors.password) setErrors({...errors, password:""}) }} 
          placeholder="Password" 
          secureTextEntry 
          style={{borderWidth:1, borderColor: errors.password ? "#ef4444" : "#e2e8f0", borderRadius:12, padding:14}}
        />
        {errors.password ? <Text style={{color:"#ef4444", fontSize:12, marginTop:6, fontWeight:"600"}}>{errors.password}</Text> : null}
      </View>
      
      <TouchableOpacity onPress={doLogin} disabled={loading} style={{backgroundColor:"#0ABAB5", padding:16, borderRadius:12, marginTop:16}}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>LOGIN</Text>}
      </TouchableOpacity>
      
      {/* FIX 2: Signup is NOT inside (customer) - go to standalone signup */}
      <TouchableOpacity onPress={()=>router.push("/signup" as any)} style={{marginTop:16}}>
        <Text style={{textAlign:"center", color:"#0ABAB5", fontWeight:"700"}}>Don't have account? Sign Up as Customer</Text>
      </TouchableOpacity>

      <Text style={{textAlign:"center", fontSize:10, color:"#cbd5e1", marginTop:20}}>Plumbers: Must be On-boarded by Admin</Text>
    </View>
  );
}