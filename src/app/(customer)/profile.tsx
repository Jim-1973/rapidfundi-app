import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Linking, Image } from "react-native";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const LOGO_URL = "https://qyqaqnkxtmsrrctknhxi.supabase.co/storage/v1/object/public/public-assets/logo.png";

export default function CustomerProfile(){
  const router = useRouter();
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [user,setUser]=useState<any>(null);
  const [form,setForm]=useState({ full_name:"", phone:"", estate:"", building:"" });
  const [stats,setStats]=useState({ total:0, paid:0, pending:0 });

  useEffect(()=>{
    (async()=>{
      try{
        const {data:{user:authUser}} = await supabase.auth.getUser();
        if(!authUser){ 
          router.replace("/login" as any); 
          return; 
        }
        setUser(authUser);
        const {data:cust} = await supabase.from('customers').select('*').eq('id', authUser.id).maybeSingle();
        if(cust){
          setForm({ full_name: cust.full_name || "", phone: cust.phone || "", estate: cust.estate || cust.location || "", building: cust.building_name || "" });
        } else {
          setForm({ full_name: (authUser.user_metadata as any)?.full_name || authUser.email?.split('@')[0] || "", phone: (authUser.user_metadata as any)?.phone || "", estate:"", building:"" });
        }
        const {data:jobs} = await supabase.from('jobs').select('status,payment_status').eq('customer_id', authUser.id);
        if(jobs){
          setStats({
            total: jobs.length,
            paid: jobs.filter((j:any)=> j.payment_status==='PAID' || j.status==='paid' || j.status==='PAID').length,
            pending: jobs.filter((j:any)=> !['paid','PAID','COMPLETED','paid'].includes(j.status)).length
          });
        }
      }catch(e){ console.log(e); }
      finally{ setLoading(false); }
    })();
  },[]);

  const saveProfile=async()=>{
    if(!user) return;
    setSaving(true);
    try{
      const {error} = await supabase.from('customers').upsert({
        id: user.id,
        email: user.email,
        full_name: form.full_name,
        phone: form.phone,
        estate: form.estate,
        location: form.estate,
        building_name: form.building,
        updated_at: new Date().toISOString()
      }, { onConflict:'id' });
      if(error) throw error;
      Alert.alert("Saved",`Thanks ${form.full_name.split(' ')[0] || ''}! Profile updated`);
    }catch(e:any){ Alert.alert("Failed", e.message); }
    finally{ setSaving(false); }
  };

  const handleBack = () => {
    if(router.canGoBack()) router.back();
    else router.replace("/(customer)" as any);
  };

  const logout=async()=>{
    await supabase.auth.signOut();
    router.replace("/login" as any);
  };

  if(loading) return <View style={{flex:1, justifyContent:"center", alignItems:"center", backgroundColor:'white'}}><Image source={{uri: LOGO_URL}} style={{width:60, height:60, resizeMode:'contain', marginBottom:12}} /><ActivityIndicator color="#0ABAB5"/></View>;

  const firstName = (form.full_name || '').split(' ')[0] || user?.email?.split('@')[0] || '';

  return (
    <View style={{flex:1, backgroundColor:"#f8fafc"}}>
      {/* TOP BAR WITH BACK - NO MORE STUCK ON HOME */}
      <View style={{backgroundColor:'white', paddingHorizontal:16, paddingTop:50, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'#e2e8f0'}}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#f8fafc', paddingHorizontal:14, paddingVertical:12, borderRadius:16, borderWidth:1, borderColor:'#e2e8f0' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <TouchableOpacity onPress={handleBack} style={{backgroundColor:'white', width:38, height:38, borderRadius:10, justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'#e2e8f0'}}><Ionicons name="arrow-back" size={18} color="#0A1931"/></TouchableOpacity>
            <Image source={{uri: LOGO_URL}} style={{width:38, height:38, resizeMode:'contain', borderRadius:8, backgroundColor:'white'}} />
            <View>
              <Text style={{fontSize:12, color:'#64748b', fontWeight:'600'}}>RapidFundi</Text>
              <Text style={{fontSize:16, fontWeight:'900', color:'#0A1931'}}>My Profile</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={{flex:1}} contentContainerStyle={{padding:16, paddingBottom:40}}>
        <View style={{backgroundColor:"#0A1931", borderRadius:20, padding:20, flexDirection:"row", alignItems:"center", gap:16}}>
          <View style={{width:64, height:64, borderRadius:32, backgroundColor:"white", justifyContent:"center", alignItems:"center"}}>
            <Image source={{uri: LOGO_URL}} style={{width:36, height:36, resizeMode:'contain'}} />
          </View>
          <View style={{flex:1}}>
            <Text style={{color:"white", fontWeight:"900", fontSize:18}}>Hi {firstName} 👋</Text>
            <Text style={{color:"white", fontWeight:"900", fontSize:14, marginTop:2}}>{form.full_name || "Customer"}</Text>
            <Text style={{color:"#94a3b8", fontSize:11, marginTop:2}}>{user?.email}</Text>
            <View style={{flexDirection:"row", gap:8, marginTop:8}}>
              <View style={{backgroundColor:"#ffffff20", paddingHorizontal:8, paddingVertical:4, borderRadius:8}}><Text style={{color:"white", fontSize:10, fontWeight:"700"}}>{stats.total} Jobs</Text></View>
              <View style={{backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:4, borderRadius:8}}><Text style={{color:"#166534", fontSize:10, fontWeight:"700"}}>{stats.paid} Paid</Text></View>
            </View>
          </View>
        </View>

        <View style={{backgroundColor:"white", borderRadius:16, padding:16, marginTop:16, borderWidth:1, borderColor:"#e2e8f0"}}>
          <Text style={{fontWeight:"900", fontSize:14, color:"#0A1931"}}>Personal Information</Text>
          <Text style={{fontSize:11, fontWeight:"700", color:"#64748b", marginTop:16}}>Full Name</Text>
          <TextInput value={form.full_name} onChangeText={t=>setForm({...form, full_name:t})} placeholder="John Doe" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:6, fontWeight:"600"}}/>
          <Text style={{fontSize:11, fontWeight:"700", color:"#64748b", marginTop:12}}>Phone (M-Pesa)</Text>
          <TextInput value={form.phone} onChangeText={t=>setForm({...form, phone:t})} keyboardType="phone-pad" placeholder="0712345678" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:6, fontWeight:"600"}}/>
          <Text style={{fontSize:11, fontWeight:"700", color:"#64748b", marginTop:12}}>Email (cannot change)</Text>
          <View style={{backgroundColor:"#f1f5f9", borderRadius:10, padding:12, marginTop:6}}><Text style={{color:"#64748b", fontWeight:"600"}}>{user?.email}</Text></View>
          <Text style={{fontSize:11, fontWeight:"700", color:"#64748b", marginTop:12}}>Estate / Location</Text>
          <TextInput value={form.estate} onChangeText={t=>setForm({...form, estate:t})} placeholder="Westlands" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:6, fontWeight:"600"}}/>
          <Text style={{fontSize:11, fontWeight:"700", color:"#64748b", marginTop:12}}>Building / Apartment</Text>
          <TextInput value={form.building} onChangeText={t=>setForm({...form, building:t})} placeholder="Sunrise Apartments" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:6, fontWeight:"600"}}/>
          <TouchableOpacity onPress={saveProfile} disabled={saving} style={{backgroundColor:saving?"#94a3b8":"#0A1931", padding:14, borderRadius:12, marginTop:20, alignItems:"center"}}>
            {saving? <ActivityIndicator color="white"/> : <Text style={{color:"white", fontWeight:"800"}}>Save Changes</Text>}
          </TouchableOpacity>
        </View>

        <View style={{backgroundColor:"white", borderRadius:16, padding:16, marginTop:12, borderWidth:1, borderColor:"#e2e8f0"}}>
          <Text style={{fontWeight:"900", fontSize:14}}>Account Stats (Real)</Text>
          <View style={{flexDirection:"row", gap:10, marginTop:12}}>
            <View style={{flex:1, backgroundColor:"#f8fafc", padding:12, borderRadius:12, alignItems:"center"}}><Text style={{fontWeight:"900", fontSize:20}}>{stats.total}</Text><Text style={{fontSize:10, color:"#64748b"}}>Total Requests</Text></View>
            <View style={{flex:1, backgroundColor:"#f0fdf4", padding:12, borderRadius:12, alignItems:"center"}}><Text style={{fontWeight:"900", fontSize:20, color:"#166534"}}>{stats.paid}</Text><Text style={{fontSize:10, color:"#64748b"}}>Paid</Text></View>
            <View style={{flex:1, backgroundColor:"#fef3c7", padding:12, borderRadius:12, alignItems:"center"}}><Text style={{fontWeight:"900", fontSize:20, color:"#92400e"}}>{stats.pending}</Text><Text style={{fontSize:10, color:"#64748b"}}>Active</Text></View>
          </View>
          <Text style={{fontSize:10, color:"#94a3b8", marginTop:10}}>Member since: {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-KE") : '-'}</Text>
        </View>

        <View style={{flexDirection:"row", gap:10, marginTop:16}}>
          <TouchableOpacity onPress={()=>Linking.openURL("https://wa.me/254722819877")} style={{flex:1, backgroundColor:"white", borderWidth:1, borderColor:"#e2e8f0", padding:12, borderRadius:12, flexDirection:"row", justifyContent:"center", alignItems:"center", gap:6}}><Ionicons name="logo-whatsapp" size={16} color="#25D366"/><Text style={{fontWeight:"700", fontSize:12}}>Help</Text></TouchableOpacity>
          <TouchableOpacity onPress={logout} style={{flex:1, backgroundColor:"#fee2e2", padding:12, borderRadius:12, flexDirection:"row", justifyContent:"center", alignItems:"center", gap:6}}><Ionicons name="log-out" size={16} color="#ef4444"/><Text style={{fontWeight:"700", fontSize:12, color:"#ef4444"}}>Logout</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}