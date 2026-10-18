import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";
import { Link } from "expo-router";

export default function Login(){
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const handleLogin = async () => {
    setErrorBanner("");
    setSuccessBanner("");

    if(!email.trim()){
      setErrorBanner("Email address is required.");
      return;
    }
    if(!/\S+@\S+\.\S+/.test(email.trim())){
      setErrorBanner("Invalid email format. Example: customer@gmail.com");
      return;
    }
    if(!password){
      setErrorBanner("Password is required.");
      return;
    }
    if(password.length < 6){
      setErrorBanner("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try{
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if(error){
        const msg = error.message.toLowerCase();
        if(msg.includes("invalid login credentials") || msg.includes("invalid")){
          throw new Error("Invalid email or password. Please check and try again.");
        }
        if(msg.includes("email not confirmed")){
          throw new Error("Your email is not confirmed. Please check your inbox or contact admin to disable Confirm Email.");
        }
        if(msg.includes("user not found") || msg.includes("not found")){
          throw new Error(`No account found for ${email}. Please Sign Up as Customer first.`);
        }
        throw new Error(error.message);
      }

      const user = data.user;
      if(!user) throw new Error("Login failed. Please try again.");

      const { data: plumber } = await supabase.from('plumbers').select('must_change_password').eq('user_id', user.id).maybeSingle();
      
      if(plumber?.must_change_password){
        setSuccessBanner("Temporary password detected. Redirecting to change password...");
        setTimeout(()=> router.replace("/plumber/change-password" as any), 800);
        return;
      }

      const isAdmin = user.email?.includes("admin") || user.user_metadata?.role === "admin";
      
      if(isAdmin){
        router.replace("/admin" as any);
      } else if(plumber){
        router.replace("/plumber" as any);
      } else {
        router.replace("/(customer)" as any);
      }

    }catch(e:any){
      setErrorBanner(e.message || "Login failed. Please try again.");
    }finally{
      setLoading(false);
    }
  };

  return (
    <View style={{flex:1, backgroundColor:"white", padding:24, justifyContent:"center"}}>
      <Text style={{fontSize:28, fontWeight:"900", color:"#0A1931"}}>Welcome Back</Text>
      <Text style={{color:"#64748b", marginTop:6}}>Login to RapidFundi</Text>

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
      
      <TextInput 
        value={password} 
        onChangeText={(t)=>{ setPassword(t); if(errorBanner) setErrorBanner(""); }} 
        placeholder="Password" 
        secureTextEntry 
        style={{borderWidth:1, borderColor: errorBanner ? "#fecaca" : "#e2e8f0", borderRadius:12, padding:14, marginTop:12, backgroundColor:"#f8fafc"}} 
      />

      <TouchableOpacity onPress={handleLogin} disabled={loading} style={{backgroundColor: loading ? "#94a3b8" : "#0ABAB5", padding:16, borderRadius:12, marginTop:20}}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>LOGIN</Text>}
      </TouchableOpacity>

      {/* PROFESSIONAL SAME LINE BELOW LOGIN */}
      <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:16}}>
        <Link href={"/signup" as any}>
          <Text style={{color:"#64748b", fontWeight:"600", fontSize:13}}>Don't have account? <Text style={{color:"#0ABAB5", fontWeight:"800"}}>Sign Up</Text></Text>
        </Link>

        <TouchableOpacity onPress={()=> router.push("/forgot-password" as any)}>
          <Text style={{color:"#0A1931", fontWeight:"700", fontSize:13}}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}