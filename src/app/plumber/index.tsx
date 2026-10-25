import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator, Vibration } from "react-native";
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { supabase, notifyCustomer } from "../../../lib/supabase";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

export default function PlumberApp() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<any>(null);
  const [plumberProfile, setPlumberProfile] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const pollingRef = useRef<any>(null);

  // NEW: Popup + Sound
  const [popup, setPopup] = useState<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const setupSound = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" }
      );
      soundRef.current = sound;
    } catch(e){}
  };

  const triggerNewJobPopup = async (job: any) => {
    setPopup(job);
    Vibration.vibrate([0, 500, 200, 500]);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch{}
    try { await soundRef.current?.replayAsync(); } catch{}
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔧 NEW JOB ASSIGNED! ${job.job_number}`,
        body: `${job.category} at ${job.building_name}, ${job.street} - ${job.estate || job.building_name}`,
        sound: true,
      },
      trigger: null,
    });
    setTimeout(()=> setPopup(null), 8000);
  };

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
    setupSound();
    Notifications.requestPermissionsAsync();
  },[]);

  const fetchJobs = async (plumberId?: string) => {
    const id = plumberId || plumberProfile?.id;
    if(!id) return;
    const { data, error } = await supabase.from('jobs')
     .select('*, plumbers(*)')
     .eq('assigned_plumber_id', id)
     .in('status',['ASSIGNED','EN_ROUTE','ARRIVED'])
     .order('created_at',{ascending:false});
    if(!error){
      // Detect new job vs existing
      if(jobs.length > 0 && data && data.length > jobs.length){
        const newOnes = data.filter((d:any)=> !jobs.find((j:any)=> j.id===d.id));
        if(newOnes.length>0) triggerNewJobPopup(newOnes[0]);
      } else if(jobs.length===0 && data && data.length>0 && isLive){
        // First load after live connected, don't spam, only if it's fresh assign (created < 2 min)
        const fresh = data.find((d:any)=> {
          const diff = (Date.now() - new Date(d.created_at).getTime())/1000/60;
          return diff < 2;
        });
        if(fresh) triggerNewJobPopup(fresh);
      }
      setJobs(data||[]);
      setLastUpdate(new Date().toLocaleTimeString());
    }
  };

  // REALTIME + POPUP
  useEffect(()=>{
    if(!plumberProfile?.id) return;

    const channel = supabase
      .channel(`plumber-live-${plumberProfile.id}-v2`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'jobs',
      }, (payload) => {
        const newRow: any = payload.new;
        const oldRow: any = payload.old;
        
        // Case 1: New job assigned to me (INSERT or UPDATE where assigned_plumber_id becomes mine)
        const assignedToMeNow = newRow?.assigned_plumber_id === plumberProfile.id;
        const wasNotMine = oldRow?.assigned_plumber_id !== plumberProfile.id;
        
        if(assignedToMeNow && (payload.eventType==='INSERT' || wasNotMine)){
          if(newRow.status==='ASSIGNED'){
            triggerNewJobPopup(newRow);
          }
        }
        
        const belongsToMe = newRow?.assigned_plumber_id === plumberProfile.id || oldRow?.assigned_plumber_id === plumberProfile.id;
        if(belongsToMe){
          fetchJobs(plumberProfile.id);
        }
        if(selected && newRow && newRow.id === selected.id){
          setSelected(newRow);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_media' }, () => {
        if(selected) fetchMedia(selected.id);
      })
      .subscribe((status) => { 
        if(status === 'SUBSCRIBED'){
          setIsLive(true);
        }
      });

    pollingRef.current = setInterval(() => {
      fetchJobs(plumberProfile.id);
    }, 4000);

    return () => { 
      supabase.removeChannel(channel);
      if(pollingRef.current) clearInterval(pollingRef.current);
      setIsLive(false);
    }
  }, [plumberProfile?.id, selected?.id, jobs.length]);

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

      const { error: upErr } = await supabase.storage.from('job-evidence').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
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
      await supabase.from('jobs').update({ status: newStatus, ...(newStatus==='COMPLETED'? { payment_status: 'PAID' } : {}) }).eq('id', selected.id);

      if(selected.customer_id){
        if(type === 'arrival'){
          await notifyCustomer(selected.customer_id, "📍 Plumber Arrived!", `Plumber ${plumberProfile.name} from ${plumberProfile.estate || ''} arrived.`, "STATUS", selected.id);
        } else {
          await notifyCustomer(selected.customer_id, "✅ Work Completed!", `${plumberProfile.name} completed ${selected.job_number}.`, "COMPLETION", selected.id);
        }
      }
      Alert.alert("✅ SUCCESS", type==='arrival' ? `ARRIVED! ${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : `COMPLETED!`);
      setSelected(null);
      fetchJobs();
    } catch(e:any){ Alert.alert("Upload Failed", e.message); } finally { setLoading(false); }
  };

  const markEnRoute = async () => {
    setLoading(true);
    try{
      await supabase.from('jobs').update({ status: 'EN_ROUTE' }).eq('id', selected.id);
      if(selected.customer_id){
        await notifyCustomer(selected.customer_id, "🚚 On The Way!", `${plumberProfile.name} is en route.`, "STATUS", selected.id);
      }
      Alert.alert("On The Way 🚚", "Customer notified");
      setSelected(null);
      fetchJobs();
    }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
  };

  const doLogout = async () => {
    if(pollingRef.current) clearInterval(pollingRef.current);
    await supabase.auth.signOut();
    router.replace("/plumber/login");
  };

  if(!authChecked){
    return <View style={{flex:1, justifyContent:"center", alignItems:"center"}}><ActivityIndicator/><Text style={{marginTop:8}}>Checking login...</Text></View>
  }

  if(selected){
    const isArrived = selected.status === 'ARRIVED';
    const estateMatch = (selected.estate || selected.building_name) === (plumberProfile.estate || plumberProfile.location);
    return (
      <ScrollView style={{flex:1, backgroundColor:"white"}} contentContainerStyle={{padding:20, paddingTop:50}}>
        <TouchableOpacity onPress={()=>{ setSelected(null); fetchJobs(); }}><Text style={{color:"#0ABAB5", fontWeight:"700"}}>← Back</Text></TouchableOpacity>
        <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:16 }}>
          <Text style={{fontSize:22, fontWeight:"900"}}>{selected.job_number}</Text>
          <View style={{ backgroundColor: estateMatch ? "#dcfce7" : "#fef3c7", paddingHorizontal:10, paddingVertical:4, borderRadius:12 }}>
            <Text style={{ fontSize:10, fontWeight:"800" }}>{estateMatch ? `✅ SAME ESTATE` : `📍 ${selected.estate || ''}`}</Text>
          </View>
        </View>
        <Text style={{fontWeight:"700", marginTop:8}}>{selected.category} - {selected.building_name}</Text>
        <Text style={{marginTop:4, fontSize:12, color:"#64748b"}}>{selected.description}</Text>
        <Text style={{marginTop:4, fontWeight:"700"}}>📍 {selected.street} • Estate: {selected.estate || selected.building_name}</Text>

        <Text style={{fontWeight:"800", marginTop:16}}>Evidence ({media.length})</Text>
        <View style={{flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:8}}>
          {media.map((m:any,i:number)=>(
            <View key={i}><Image source={{uri: m.url}} style={{width:80, height:80, borderRadius:8}}/><Text style={{fontSize:9, fontWeight:"700"}}>{m.type}</Text></View>
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
            <TouchableOpacity onPress={()=>takePhotoWithGPS('completion')} disabled={loading} style={{backgroundColor:"#0A1931", padding:18, borderRadius:12}}>
              {loading? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"900"}}>✅ WORK DONE</Text>}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    )
  }

  return (
    <View style={{flex:1, backgroundColor:"#f8fafc"}}>
      {/* INSTANT POPUP FOR PLUMBER */}
      {popup && (
        <View style={{ position:"absolute", top:50, left:16, right:16, zIndex:9999, backgroundColor:"#0A1931", borderRadius:16, padding:16, flexDirection:"row", alignItems:"center", elevation:12, borderWidth:2, borderColor:"#22c55e" }}>
          <View style={{ backgroundColor:"#22c55e", width:48, height:48, borderRadius:24, justifyContent:"center", alignItems:"center" }}>
            <Text style={{ fontSize:24 }}>🔧</Text>
          </View>
          <View style={{ marginLeft:12, flex:1 }}>
            <Text style={{ color:"#22c55e", fontWeight:"900", fontSize:12 }}>NEW JOB ASSIGNED - {popup.estate || popup.building_name}</Text>
            <Text style={{ color:"white", fontWeight:"800", marginTop:2 }}>{popup.job_number} - {popup.category}</Text>
            <Text style={{ color:"#94a3b8", fontSize:11, marginTop:2 }}>{popup.building_name}, {popup.street}</Text>
            <View style={{ backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:3, borderRadius:8, alignSelf:"flex-start", marginTop:6 }}>
              <Text style={{ fontSize:10, fontWeight:"800", color:"#16a34a" }}>📍 {popup.estate} - SAME AREA</Text>
            </View>
          </View>
          <View style={{ gap:8, alignItems:"center" }}>
            <TouchableOpacity onPress={()=>{ const j=popup; setPopup(null); setSelected(j); fetchMedia(j.id); }} style={{ backgroundColor:"#22c55e", paddingHorizontal:14, paddingVertical:8, borderRadius:20 }}>
              <Text style={{ fontWeight:"900", fontSize:11, color:"white" }}>VIEW</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setPopup(null)}><Ionicons name="close" size={18} color="white"/></TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{padding:20, paddingTop:50}}>
        <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
          <View style={{ flex:1 }}>
            <View style={{flexDirection:"row", alignItems:"center", gap:8}}>
              <Text style={{fontSize:24, fontWeight:"900"}}>Plumber App</Text>
              {isLive ? <View style={{flexDirection:"row", alignItems:"center", backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:3, borderRadius:12, gap:4}}><View style={{width:6, height:6, borderRadius:3, backgroundColor:"#22c55e"}}/><Text style={{fontSize:10, fontWeight:"900", color:"#16a34a"}}>LIVE AUTO</Text></View> : <View style={{backgroundColor:"#fef3c7", paddingHorizontal:8, paddingVertical:3, borderRadius:12}}><Text style={{fontSize:10, fontWeight:"800"}}>Polling 3s</Text></View>}
            </View>
            <Text style={{color:"#0A1931", fontWeight:"800", marginTop:2}}>{plumberProfile?.plumber_number} {plumberProfile?.name}</Text>
            <View style={{ flexDirection:"row", gap:6, marginTop:4 }}>
              <View style={{ backgroundColor:"#0A1931", paddingHorizontal:10, paddingVertical:4, borderRadius:12 }}><Text style={{ color:"white", fontSize:11, fontWeight:"800" }}>📍 {plumberProfile?.estate || plumberProfile?.location}</Text></View>
              <View style={{ backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:4, borderRadius:12 }}><Text style={{ fontSize:11, fontWeight:"700" }}>{jobs.length} jobs</Text></View>
            </View>
            <Text style={{fontSize:10, color:"#94a3b8", marginTop:4}}>Auto-refreshing every 4s • {lastUpdate}</Text>
          </View>
          <TouchableOpacity onPress={doLogout} style={{backgroundColor:"#fee2e2", padding:8, borderRadius:8}}><Text style={{color:"red", fontWeight:"700", fontSize:12}}>Logout</Text></TouchableOpacity>
        </View>

        <View style={{gap:12, marginTop:20}}>
          {jobs.map(j=>{
            const estateMatch = (j.estate || j.building_name) === (plumberProfile.estate || plumberProfile.location);
            return (
            <TouchableOpacity key={j.id} onPress={()=>{ setSelected(j); fetchMedia(j.id); }} style={{backgroundColor:"white", padding:16, borderRadius:14, borderWidth: estateMatch ? 2 : 1, borderColor: estateMatch ? "#22c55e" : "#0ABAB5"}}>
              <View style={{flexDirection:"row", justifyContent:"space-between"}}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                  <Text style={{fontWeight:"800"}}>{j.job_number}</Text>
                  {estateMatch && <View style={{ backgroundColor:"#dcfce7", paddingHorizontal:6, paddingVertical:2, borderRadius:8 }}><Text style={{ fontSize:9, fontWeight:"800", color:"#16a34a" }}>SAME AREA</Text></View>}
                </View>
                <Text style={{fontSize:10, fontWeight:"800", backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:3, borderRadius:10}}>{j.status}</Text>
              </View>
              <Text style={{fontWeight:"700", marginTop:4}}>{j.category} - {j.building_name}</Text>
              <Text style={{fontSize:12, color:"#64748b"}}>📍 {j.estate || j.building_name} • {j.street}</Text>
            </TouchableOpacity>
          )})}
          {jobs.length===0 && <Text style={{textAlign:"center", marginTop:40, color:"#94a3b8"}}>Waiting for jobs from {plumberProfile?.estate || "your estate"}... LIVE auto-refresh ON 🔴</Text>}
        </View>
        <TouchableOpacity onPress={()=>fetchJobs()} style={{marginTop:20, padding:12, borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, backgroundColor:"white"}}><Text style={{textAlign:"center", fontWeight:"700"}}>↻ Refresh Now (auto every 4s)</Text></TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}