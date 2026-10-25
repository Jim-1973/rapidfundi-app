import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";

const ESTATES = ["Westlands","Kasarani","Kilimani","CBD","Lavington","Karen","Embakasi","Parklands","South B","Eastlands","Langata","Rongai","Kileleshwa","Syokimau","Umoja","Donholm","Buruburu","Kitengela","Ruaka"];

export default function Signup(){
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("254");
  const [password, setPassword] = useState("");
  const [estate, setEstate] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({ name: "", email: "", phone: "", password: "", estate: "" });
  const [loading, setLoading] = useState(false);

  const passChecks = useMemo(()=>({
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }), [password]);
  const passScore = Object.values(passChecks).filter(Boolean).length;
  const isStrongPass = passScore === 5;

  const validate = () => {
    const e = { name: "", email: "", phone: "", password: "", estate: "" };
    let has=false;
    if(!name.trim()||name.length<3){e.name="Full name required *";has=true;}
    if(!estate){e.estate="Estate is required *";has=true;}
    if(!phone||phone.length!==12||!/^254[71]\d{8}$/.test(phone)){e.phone="Phone: 2547XXXXXXXX *";has=true;}
    if(!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){e.email="Valid email required *";has=true;}
    if(!isStrongPass){e.password="Password must meet security rules *";has=true;}
    setErrors(e); return !has;
  };

  const doSignup = async () => {
    if(!validate()) return;
    setLoading(true);
    try{
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(), 
        password,
        options:{ data:{ full_name:name.trim(), role:"customer", phone, estate, location:estate } }
      });
      if(error) throw error;
      
      if(data.user){
        const { error: firstError } = await supabase.from("customers").insert({ 
          id: data.user.id, 
          user_id: data.user.id, 
          full_name: name.trim(), 
          email: email.toLowerCase(), 
          phone, 
          location: estate, 
          estate 
        });
        if(firstError){
          await supabase.from("customers").insert({ 
            id: data.user.id, 
            full_name: name.trim(), 
            email: email.toLowerCase(), 
            phone, 
            location: estate, 
            estate 
          });
        }
      }
      Alert.alert("Success", `Welcome! Account in ${estate} created.`);
      router.replace("/login" as any);
    }catch(e:any){ 
      Alert.alert("Error", e.message); 
    } finally{ 
      setLoading(false); 
    }
  };

  return (
    <ScrollView style={{flex:1, backgroundColor:"white"}} contentContainerStyle={{padding:0, paddingBottom:40}}>
      <View style={{ paddingHorizontal:24, paddingTop:20, paddingBottom:14, borderBottomWidth:1, borderColor:"#e5e7eb" }}>
        <Text style={{ fontSize:18, fontWeight:"900", color:"#0A1931" }}>RapidFundi</Text>
      </View>

      <View style={{ padding:24 }}>
        <Text style={{fontSize:30, fontWeight:"900", color:"#0A1931"}}>Create Account</Text>
        <Text style={{color:"#64748b", marginTop:6, fontSize:13}}>All fields required • Secure signup</Text>

        <View style={{ marginTop:20 }}>
          <Text style={{ fontSize:12, fontWeight:"800", color:"#0A1931", marginBottom:8 }}>Full Name *</Text>
          <View style={{ borderWidth:1.5, borderColor: errors.name? "#ef4444":name?"#0A1931":"#e2e8f0", borderRadius:12, padding:14, backgroundColor: errors.name? "#fef2f2":"white" }}>
            <TextInput value={name} onChangeText={(t)=>{setName(t); setErrors({...errors, name:""})}} placeholder="Full Name" style={{ fontWeight:"600" }} />
          </View>
          {errors.name? <Text style={{ color:"#ef4444", fontSize:11, marginTop:6, fontWeight:"700" }}>{errors.name}</Text>:null}
        </View>

        <View style={{ marginTop:14 }}>
          <Text style={{ fontSize:12, fontWeight:"800", color:"#0A1931", marginBottom:8 }}>Estate *</Text>
          <TouchableOpacity onPress={()=>setShowDropdown(true)} style={{ borderWidth:1.5, borderColor: errors.estate? "#ef4444":estate?"#0A1931":"#e2e8f0", borderRadius:12, padding:14, flexDirection:"row", justifyContent:"space-between", backgroundColor: errors.estate? "#fef2f2":"white" }}>
            <Text style={{ fontWeight:"600", color: estate? "#0A1931":"#94a3b8" }}>{estate||"Select your estate *"}</Text>
            <Ionicons name="chevron-down" size={16} color="#64748b" />
          </TouchableOpacity>
          {errors.estate? <Text style={{ color:"#ef4444", fontSize:11, marginTop:6, fontWeight:"700" }}>{errors.estate}</Text>:null}
        </View>

        <View style={{ marginTop:14 }}>
          <Text style={{ fontSize:12, fontWeight:"800", color:"#0A1931", marginBottom:8 }}>Phone *</Text>
          <View style={{ borderWidth:1.5, borderColor: errors.phone? "#ef4444":phone.length===12?"#0A1931":"#e2e8f0", borderRadius:12, padding:14, backgroundColor: errors.phone? "#fef2f2":"white" }}>
            <TextInput value={phone} onChangeText={(t)=>{setPhone(t.replace(/[^0-9]/g,"")); setErrors({...errors, phone:""})}} keyboardType="phone-pad" maxLength={12} placeholder="254722000000" style={{ fontWeight:"600" }} />
          </View>
          {errors.phone? <Text style={{ color:"#ef4444", fontSize:11, marginTop:6, fontWeight:"700" }}>{errors.phone}</Text>:null}
        </View>

        <View style={{ marginTop:14 }}>
          <Text style={{ fontSize:12, fontWeight:"800", color:"#0A1931", marginBottom:8 }}>Email *</Text>
          <View style={{ borderWidth:1.5, borderColor: errors.email? "#ef4444":email?"#0A1931":"#e2e8f0", borderRadius:12, padding:14, backgroundColor: errors.email? "#fef2f2":"white" }}>
            <TextInput value={email} onChangeText={(t)=>{setEmail(t); setErrors({...errors, email:""})}} autoCapitalize="none" keyboardType="email-address" placeholder="Email" style={{ fontWeight:"600" }} />
          </View>
          {errors.email? <Text style={{ color:"#ef4444", fontSize:11, marginTop:6, fontWeight:"700" }}>{errors.email}</Text>:null}
        </View>

        <View style={{ marginTop:14 }}>
          <Text style={{ fontSize:12, fontWeight:"800", color:"#0A1931", marginBottom:8 }}>Password *</Text>
          <View style={{ flexDirection:"row", alignItems:"center", borderWidth:1.5, borderColor: errors.password? "#ef4444":isStrongPass?"#16a34a":password?"#f59e0b":"#e2e8f0", borderRadius:12, padding:14, backgroundColor: errors.password? "#fef2f2":"white" }}>
            <TextInput value={password} onChangeText={(t)=>{setPassword(t); setErrors({...errors, password:""})}} secureTextEntry={!showPass} placeholder="Password" style={{ flex:1, fontWeight:"600" }} />
            <TouchableOpacity onPress={()=>setShowPass(!showPass)}><Ionicons name={showPass? "eye-off-outline":"eye-outline"} size={18} color="#94a3b8"/></TouchableOpacity>
          </View>
          <View style={{ flexDirection:"row", gap:4, marginTop:10 }}>{[1,2,3,4,5].map(i=><View key={i} style={{ flex:1, height:4, borderRadius:10, backgroundColor: i<=passScore? (passScore<3? "#ef4444":passScore<5? "#f59e0b":"#16a34a"):"#e2e8f0" }} />)}</View>
          <View style={{ backgroundColor:"#f8fafc", borderRadius:12, padding:10, marginTop:8, borderWidth:1, borderColor:"#f1f5f9" }}>
            <View style={{ flexDirection:"row", gap:6, marginTop:2 }}><Ionicons name={passChecks.length? "checkmark-circle":"close-circle"} size={12} color={passChecks.length? "#16a34a":"#cbd5e1"} /><Text style={{ fontSize:11, color: passChecks.length? "#16a34a":"#64748b" }}>8+ characters</Text></View>
            <View style={{ flexDirection:"row", gap:6, marginTop:2 }}><Ionicons name={passChecks.upper? "checkmark-circle":"close-circle"} size={12} color={passChecks.upper? "#16a34a":"#cbd5e1"} /><Text style={{ fontSize:11, color: passChecks.upper? "#16a34a":"#64748b" }}>1 UPPERCASE</Text></View>
            <View style={{ flexDirection:"row", gap:6, marginTop:2 }}><Ionicons name={passChecks.lower? "checkmark-circle":"close-circle"} size={12} color={passChecks.lower? "#16a34a":"#cbd5e1"} /><Text style={{ fontSize:11, color: passChecks.lower? "#16a34a":"#64748b" }}>1 lowercase</Text></View>
            <View style={{ flexDirection:"row", gap:6, marginTop:2 }}><Ionicons name={passChecks.number? "checkmark-circle":"close-circle"} size={12} color={passChecks.number? "#16a34a":"#cbd5e1"} /><Text style={{ fontSize:11, color: passChecks.number? "#16a34a":"#64748b" }}>1 number</Text></View>
            <View style={{ flexDirection:"row", gap:6, marginTop:2 }}><Ionicons name={passChecks.special? "checkmark-circle":"close-circle"} size={12} color={passChecks.special? "#16a34a":"#cbd5e1"} /><Text style={{ fontSize:11, color: passChecks.special? "#16a34a":"#64748b" }}>1 special (!@#$%)</Text></View>
          </View>
          {errors.password? <Text style={{ color:"#ef4444", fontSize:11, marginTop:6, fontWeight:"700" }}>{errors.password}</Text>:null}
        </View>

        <TouchableOpacity onPress={doSignup} disabled={loading||!isStrongPass} style={{ backgroundColor: loading||!isStrongPass? "#94a3b8":"#0A1931", padding:16, borderRadius:12, marginTop:20 }}>
          {loading? <ActivityIndicator color="white"/> : <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>Sign Up</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={()=>router.replace("/login" as any)} style={{ marginTop:16 }}>
          <Text style={{ textAlign:"center", color:"#64748b", fontWeight:"700" }}>Back to Login</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDropdown} transparent animationType="fade">
        <TouchableOpacity activeOpacity={1} onPress={()=>setShowDropdown(false)} style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" }}>
          <View style={{ backgroundColor:"white", borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:"70%" }}>
            <View style={{ padding:16, flexDirection:"row", justifyContent:"space-between", borderBottomWidth:1, borderColor:"#f1f5f9" }}>
              <Text style={{ fontWeight:"800" }}>Select Estate *</Text>
              <TouchableOpacity onPress={()=>setShowDropdown(false)}><Ionicons name="close" size={20} /></TouchableOpacity>
            </View>
            <FlatList data={ESTATES} keyExtractor={i=>i} renderItem={({item})=>(
              <TouchableOpacity onPress={()=>{ setEstate(item); setErrors({...errors, estate:""}); setShowDropdown(false); }} style={{ padding:16, flexDirection:"row", justifyContent:"space-between", borderBottomWidth:1, borderColor:"#f8fafc" }}>
                <Text style={{ fontWeight: estate===item? "800":"600" }}>{item}</Text>
                {estate===item && <Ionicons name="checkmark-circle" size={18} color="#0ABAB5" />}
              </TouchableOpacity>
            )} />
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}