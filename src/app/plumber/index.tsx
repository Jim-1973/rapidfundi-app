import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from "react-native";
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";

export default function PlumberApp() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<any>(null);
  const [plumberProfile, setPlumberProfile] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // --- NEW: CHECK PLUMBER LOGIN & MUST CHANGE ---
  useEffect(()=>{
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if(!session){
        router.replace("/plumber/login");
        return;
      }
      const { data: pl } = await supabase.from('plumbers').select('*').eq('user_id', session.user.id).single();
      if(!pl){
        Alert.alert("Not a plumber account");
        router.replace("/plumber/login");
        return;
      }
      if(pl.must_change_password){
        router.replace("/plumber/change-password");
        return;
      }
      setPlumberProfile(pl);
      setAuthChecked(true);
      fetchJobs(pl.id);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status==='granted'){
        const loc = await Location.getCurrentPositionAsync({});
        setGps(loc.coords);
      }
    };
    checkAuth();
  },[]);

  const fetchJobs = async (plumberId?: string) => {
    const id = plumberId || plumberProfile?.id;
    if(!id) return;
    // Show jobs assigned to THIS plumber OR unassigned but in flow
    const { data } = await supabase.from('jobs')
     .select('*, plumbers(*)')
     .eq('assigned_plumber_id', id)
     .in('status',['ASSIGNED','EN_ROUTE','ARRIVED'])
     .order('created_at',{ascending:false});
    setJobs(data||[]);
  };

  const fetchMedia = async (jobId:string) => {
    const { data } = await supabase.from('job_media').select('*').eq('job_id', jobId).order('created_at',{ascending:false});
    setMedia(data||[]);
  };

  const takePhotoWithGPS = async (type: 'arrival' | 'completion') => {
    try{
      setLoading(true);
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if(camPerm.status!=='granted'){ Alert.alert("Allow camera"); setLoading(false); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing:false });
      if(result.canceled){ setLoading(false); return; }
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if(locPerm.status!=='granted'){ Alert.alert("Allow GPS for proof"); setLoading(false); return; }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude } = location.coords;
      setGps(location.coords);

      const uri = result.assets[0].uri;
      const response = await globalThis.fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const fileName = `${selected.id}/${type}_${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage.from('job-evidence').upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg', upsert: true
      });
      if(upErr) throw new Error("Storage upload: "+upErr.message);

      const { data: urlData } = supabase.storage.from('job-evidence').getPublicUrl(fileName);
      const { error: mediaErr } = await supabase.from('job_media').insert({
        job_id: selected.id,
        type: type,
        url: urlData.publicUrl,
        latitude: latitude,
        longitude: longitude,
      });
      if(mediaErr) throw new Error("DB insert: "+mediaErr.message);

      const newStatus = type==='arrival'? 'ARRIVED' : 'COMPLETED';
      const { error: jobErr } = await supabase.from('jobs').update({
        status: newStatus,
      ...(newStatus==='COMPLETED'? { payment_status: 'PAID' } : {})
      }).eq('id', selected.id);
      if(jobErr) throw new Error("Status update: "+jobErr.message);

      Alert.alert("✅ SUCCESS",
        type==='arrival'
      ? `ARRIVED! Photo + GPS saved\n${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : `COMPLETED! Final photo saved`
      );
      setSelected(null);
      fetchJobs();
    } catch(e:any){
      Alert.alert("Upload Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const markEnRoute = async () => {
    setLoading(true);
    await supabase.from('jobs').update({ status: 'EN_ROUTE' }).eq('id', selected.id);
    Alert.alert("On The Way 🚚", "Customer & Admin notified");
    setSelected(null); fetchJobs(); setLoading(false);
  };

  const doLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/plumber/login");
  };

  if(!authChecked){
    return <View style={{flex:1, justifyContent:"center", alignItems:"center"}}><ActivityIndicator/><Text style={{marginTop:8}}>Checking login...</Text></View>
  }

  if(selected){
    const isArrived = selected.status === 'ARRIVED';
    return (
      <ScrollView style={{flex:1, backgroundColor:"white"}} contentContainerStyle={{padding:20, paddingTop:50}}>
        <TouchableOpacity onPress={()=>setSelected(null)}><Text style={{color:"#0ABAB5", fontWeight:"700"}}>← Back</Text></TouchableOpacity>
        <Text style={{fontSize:22, fontWeight:"900", marginTop:16}}>{selected.job_number}</Text>
        <Text style={{fontWeight:"700", marginTop:8}}>{selected.category} - {selected.building_name}</Text>
        <Text style={{marginTop:4, fontSize:12, color:"#64748b"}}>{selected.description}</Text>
        <Text style={{marginTop:4, fontWeight:"700"}}>📍 {selected.street} Floor {selected.floor}</Text>
        <Text style={{marginTop:8, fontWeight:"900", fontSize:16, color: isArrived? "#2563eb" : "#0A1931"}}>Status: {isArrived? "ARRIVED - WORK ONGOING" : selected.status}</Text>

        {gps && (
          <View style={{backgroundColor:"#f0fdfa", padding:10, borderRadius:8, marginTop:12, borderWidth:1, borderColor:"#0ABAB5"}}>
            <Text style={{fontSize:11, fontWeight:"700"}}>📡 GPS: {gps.latitude?.toFixed(6)}, {gps.longitude?.toFixed(6)}</Text>
          </View>
        )}

        <Text style={{fontWeight:"800", marginTop:16}}>Evidence ({media.length})</Text>
        <View style={{flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:8}}>
          {media.map((m:any,i:number)=>(
            <View key={i} style={{alignItems:"center"}}>
              <Image source={{uri: m.url}} style={{width:80, height:80, borderRadius:8}}/>
              <Text style={{fontSize:9, fontWeight:"700"}}>{m.type}</Text>
            </View>
          ))}
        </View>

        <View style={{marginTop:30, gap:12}}>
          {selected.status==='ASSIGNED' && (
            <TouchableOpacity onPress={markEnRoute} disabled={loading} style={{backgroundColor:"#f59e0b", padding:18, borderRadius:12}}>
              {loading? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"900"}}>🚚 ON THE WAY</Text>}
            </TouchableOpacity>
          )}
          {(selected.status==='ASSIGNED' || selected.status==='EN_ROUTE') && (
            <TouchableOpacity onPress={()=>takePhotoWithGPS('arrival')} disabled={loading} style={{backgroundColor:"#0ABAB5", padding:18, borderRadius:12}}>
              {loading? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"900"}}>📍 ARRIVED - Photo + GPS</Text>}
            </TouchableOpacity>
          )}
          {isArrived && (
            <>
              <View style={{backgroundColor:"#dbeafe", padding:14, borderRadius:12, borderWidth:1, borderColor:"#3b82f6"}}>
                <Text style={{fontWeight:"800", color:"#1e40af"}}>🔧 WORK ONGOING</Text>
              </View>
              <TouchableOpacity onPress={()=>takePhotoWithGPS('completion')} disabled={loading} style={{backgroundColor:"#0A1931", padding:18, borderRadius:12}}>
                {loading? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"900"}}>✅ WORK DONE - Final Photo</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={{flex:1, backgroundColor:"#f8fafc"}} contentContainerStyle={{padding:20, paddingTop:50}}>
      <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
        <View>
          <Text style={{fontSize:28, fontWeight:"900"}}>Plumber App</Text>
          <Text style={{color:"#64748b"}}>{plumberProfile?.plumber_number} {plumberProfile?.name} • {jobs.length} jobs</Text>
        </View>
        <TouchableOpacity onPress={doLogout} style={{backgroundColor:"#fee2e2", padding:8, borderRadius:8}}><Text style={{color:"red", fontWeight:"700", fontSize:12}}>Logout</Text></TouchableOpacity>
      </View>

      <View style={{gap:12, marginTop:20}}>
        {jobs.map(j=>(
          <TouchableOpacity key={j.id} onPress={()=>{ setSelected(j); fetchMedia(j.id); }} style={{backgroundColor:"white", padding:16, borderRadius:14, borderWidth:1, borderColor: j.status==='EN_ROUTE'? "#f59e0b" : j.status==='ARRIVED'? "#3b82f6" : "#0ABAB5"}}>
            <View style={{flexDirection:"row", justifyContent:"space-between"}}>
              <Text style={{fontWeight:"800"}}>{j.job_number}</Text>
              <Text style={{fontSize:10, fontWeight:"800", backgroundColor: j.status==='EN_ROUTE'? "#ffedd5" : j.status==='ARRIVED'? "#dbeafe" : "#dcfce7", paddingHorizontal:8, paddingVertical:3, borderRadius:10}}>{j.status}</Text>
            </View>
            <Text style={{fontWeight:"700", marginTop:4}}>{j.category} - {j.building_name}</Text>
            <Text style={{fontSize:12, color:"#64748b"}}>Floor {j.floor} • {j.street}</Text>
          </TouchableOpacity>
        ))}
        {jobs.length===0 && <Text style={{textAlign:"center", marginTop:40, color:"#94a3b8"}}>No jobs assigned to you. Admin must assign.</Text>}
      </View>
      <TouchableOpacity onPress={()=>fetchJobs()} style={{marginTop:20, padding:12, borderWidth:1, borderColor:"#e2e8f0", borderRadius:10}}><Text style={{textAlign:"center"}}>↻ Refresh</Text></TouchableOpacity>
    </ScrollView>
  )
}