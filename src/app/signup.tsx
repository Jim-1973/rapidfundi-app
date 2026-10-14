import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";

export default function Signup(){
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const doSignup = async () => {
    // Inline required notices
    const newErrors = { name: "", email: "", password: "" };
    let hasError = false;
    
    if(!name.trim()){
      newErrors.name = "Full name is required";
      hasError = true;
    }
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
    } else if(password.length < 6){
      newErrors.password = "Min 6 characters";
      hasError = true;
    }
    
    setErrors(newErrors);
    if(hasError) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ 
        email: email.trim(), 
        password, 
        options:{ data:{ full_name:name, role:"customer" } } 
      });
      if(error) throw error;
      
      Alert.alert("Success","Account created! Login now.");
      // FIX: Go back to MAIN login, not customer login
      router.replace("/login" as any);
      
    } catch(e:any){
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{flex:1, backgroundColor:"white", padding:24, justifyContent:"center"}}>
      <Text style={{fontSize:32, fontWeight:"900"}}>Create Account</Text>
      <Text style={{color:"#64748b", marginTop:6}}>Customer self-register</Text>
      
      <View style={{marginTop:24}}>
        <TextInput value={name} onChangeText={(t)=>{setName(t); if(errors.name) setErrors({...errors, name:""})}} placeholder="Full Name" style={{borderWidth:1, borderColor: errors.name ? "#ef4444" : "#e2e8f0", borderRadius:12, padding:14}}/>
        {errors.name ? <Text style={{color:"#ef4444", fontSize:12, marginTop:6, fontWeight:"600"}}>{errors.name}</Text> : null}
      </View>

      <View style={{marginTop:12}}>
        <TextInput value={email} onChangeText={(t)=>{setEmail(t); if(errors.email) setErrors({...errors, email:""})}} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={{borderWidth:1, borderColor: errors.email ? "#ef4444" : "#e2e8f0", borderRadius:12, padding:14}}/>
        {errors.email ? <Text style={{color:"#ef4444", fontSize:12, marginTop:6, fontWeight:"600"}}>{errors.email}</Text> : null}
      </View>

      <View style={{marginTop:12}}>
        <TextInput value={password} onChangeText={(t)=>{setPassword(t); if(errors.password) setErrors({...errors, password:""})}} placeholder="Password (min 6)" secureTextEntry style={{borderWidth:1, borderColor: errors.password ? "#ef4444" : "#e2e8f0", borderRadius:12, padding:14}}/>
        {errors.password ? <Text style={{color:"#ef4444", fontSize:12, marginTop:6, fontWeight:"600"}}>{errors.password}</Text> : null}
      </View>

      <TouchableOpacity onPress={doSignup} disabled={loading} style={{backgroundColor:"#0A1931", padding:16, borderRadius:12, marginTop:16}}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>SIGN UP</Text>}
      </TouchableOpacity>
      
      {/* FIXED BACK - always to login, never to homepage */}
      <TouchableOpacity onPress={()=>router.replace("/login" as any)} style={{marginTop:16}}>
        <Text style={{textAlign:"center", color:"#64748b", fontWeight:"700"}}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}