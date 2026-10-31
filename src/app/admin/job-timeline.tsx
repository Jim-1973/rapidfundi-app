import { useEffect, useState } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { supabase } from "../../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function AdminJobTimeline({ jobId, onClose }: { jobId: string, onClose?: ()=>void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [liveLoc, setLiveLoc] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const { data: j } = await supabase.from('jobs').select('*, plumbers(name, plumber_number, phone)').eq('id', jobId).single();
    const { data: h } = await supabase.from('job_status_history').select('*, plumbers(name, plumber_number)').eq('job_id', jobId).order('created_at', {ascending:true});
    const { data: m } = await supabase.from('job_media').select('*').eq('job_id', jobId).order('created_at', {ascending:false});
    const { data: loc } = await supabase.from('plumber_live_locations').select('*').eq('job_id', jobId).order('created_at', {ascending:false}).limit(1).maybeSingle();
    setJob(j); setHistory(h||[]); setMedia(m||[]); setLiveLoc(loc); setLoading(false);
  };

  useEffect(()=>{
    fetchAll();
    const channel = supabase.channel(`admin-job-${jobId}-v2`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_status_history', filter:`job_id=eq.${jobId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_media', filter:`job_id=eq.${jobId}` }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plumber_live_locations', filter:`job_id=eq.${jobId}` }, fetchAll)
      .subscribe();
    return ()=>{ supabase.removeChannel(channel) };
  },[jobId]);

  const getLabour = (j:any) => Number(j?.labour_amount || j?.labor_amount || 0);
  const getEarning = (j:any) => Math.round(getLabour(j) * 0.7);

  if(loading) return <View style={{flex:1, justifyContent:"center", alignItems:"center"}}><ActivityIndicator color="#0A1931"/></View>;

  return (
    <View style={{flex:1, backgroundColor:"#f8fafc"}}>
      <ScrollView contentContainerStyle={{padding:16, paddingBottom:30}}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={{flexDirection:"row", alignItems:"center", gap:4, marginBottom:12, backgroundColor:"white", alignSelf:"flex-start", paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:"#e2e8f0"}}>
            <Ionicons name="chevron-back" size={16} color="#0A1931"/><Text style={{fontWeight:"800", fontSize:12}}>Back</Text>
          </TouchableOpacity>
        )}

        {/* JOB HEADER */}
        <View style={{backgroundColor:"white", borderRadius:16, padding:16, borderWidth:1, borderColor:"#e2e8f0"}}>
          <View style={{flexDirection:"row", justifyContent:"space-between"}}>
            <View style={{backgroundColor:"#0A1931", paddingHorizontal:10, paddingVertical:5, borderRadius:8}}><Text style={{color:"white", fontWeight:"900", fontSize:11}}>{job?.job_number}</Text></View>
            <Text style={{fontWeight:"900", color: job?.status==='COMPLETED' ? "#16a34a" : "#0ABAB5"}}>{job?.status}</Text>
          </View>
          <Text style={{fontWeight:"900", fontSize:16, marginTop:10}}>{job?.category} • {job?.building_name}</Text>
          <Text style={{color:"#64748b", fontSize:12, marginTop:2}}>{job?.estate} • {job?.street}</Text>
          <View style={{backgroundColor:"#f0fdf4", borderWidth:1, borderColor:"#bbf7d0", borderRadius:12, padding:12, marginTop:12, flexDirection:"row", justifyContent:"space-between"}}>
            <View><Text style={{fontSize:10, fontWeight:"800", color:"#16a34a"}}>LABOUR</Text><Text style={{fontWeight:"900"}}>KES {getLabour(job).toLocaleString()}</Text></View>
            <View><Text style={{fontSize:10, fontWeight:"800", color:"#16a34a"}}>PLUMBER 70%</Text><Text style={{fontWeight:"900", color:"#16a34a"}}>KES {getEarning(job).toLocaleString()}</Text></View>
            <View><Text style={{fontSize:10, fontWeight:"800", color:"#94a3b8"}}>COMPANY 30%</Text><Text style={{fontWeight:"900"}}>KES {Math.round(getLabour(job)*0.3).toLocaleString()}</Text></View>
          </View>
        </View>

        {/* LIVE LOCATION - VISIBLE TO ADMIN */}
        {liveLoc && (
          <TouchableOpacity onPress={()=>Linking.openURL(`https://www.google.com/maps?q=${liveLoc.lat},${liveLoc.lng}`)} style={{backgroundColor:"#0A1931", padding:14, borderRadius:14, flexDirection:"row", gap:12, alignItems:"center", marginTop:16}}>
            <View style={{width:40, height:40, borderRadius:20, backgroundColor:"#22c55e", justifyContent:"center", alignItems:"center"}}><Ionicons name="navigate" size={20} color="white"/></View>
            <View style={{flex:1}}><Text style={{color:"white", fontWeight:"900"}}>LIVE Plumber Location</Text><Text style={{color:"#94a3b8", fontSize:11}}>{liveLoc.lat?.toFixed(6)}, {liveLoc.lng?.toFixed(6)} • {new Date(liveLoc.created_at).toLocaleTimeString()} • Tap to open Maps</Text></View>
            <Ionicons name="open-outline" size={18} color="white"/>
          </TouchableOpacity>
        )}

        {/* TIMELINE - EVERY PLUMBER ACTION */}
        <Text style={{fontWeight:"900", fontSize:16, marginTop:20}}>Plumber Actions Timeline ({history.length})</Text>
        {history.length===0 && <View style={{backgroundColor:"white", padding:20, borderRadius:12, marginTop:8, alignItems:"center"}}><Text style={{color:"#94a3b8"}}>No actions yet - will show ACCEPT → EN_ROUTE → ARRIVED → COMPLETED + GPS</Text></View>}
        {history.map((h,i)=>(
          <View key={i} style={{backgroundColor:"white", padding:12, borderRadius:12, marginTop:10, borderLeftWidth:4, borderLeftColor: h.new_status==='COMPLETED' ? "#22c55e" : h.new_status==='DECLINED' ? "#ef4444" : h.new_status==='ARRIVED' ? "#0ABAB5" : "#f59e0b", flexDirection:"row", gap:10}}>
            <View style={{width:36, height:36, borderRadius:18, backgroundColor:"#f1f5f9", justifyContent:"center", alignItems:"center"}}><Ionicons name={h.new_status==='EN_ROUTE' ? "bicycle" : h.new_status==='ARRIVED' ? "location" : h.new_status==='COMPLETED' ? "checkmark-done" : "alert-circle"} size={16} color="#0A1931"/></View>
            <View style={{flex:1}}>
              <View style={{flexDirection:"row", justifyContent:"space-between"}}><Text style={{fontWeight:"800", fontSize:13}}>{h.old_status} → {h.new_status}</Text><Text style={{fontSize:10, color:"#94a3b8"}}>{new Date(h.created_at).toLocaleString()}</Text></View>
              <Text style={{fontSize:11, color:"#475569", marginTop:2}}>{h.plumbers?.name} • {h.plumbers?.plumber_number}</Text>
              {h.reason && <View style={{backgroundColor:"#fee2e2", padding:8, borderRadius:8, marginTop:6}}><Text style={{color:"#ef4444", fontSize:12, fontWeight:"700"}}>Reason: {h.reason}</Text></View>}
              {h.latitude && <Text style={{fontSize:10, color:"#0ABAB5", marginTop:4}}>📍 {h.latitude}, {h.longitude}</Text>}
              {h.media_url && <Text style={{fontSize:10, color:"#22c55e", marginTop:2}}>📷 Photo attached</Text>}
            </View>
          </View>
        ))}

        {/* PROOF PHOTOS - ARRIVAL BEFORE & COMPLETION */}
        <Text style={{fontWeight:"900", fontSize:16, marginTop:20}}>Proof Photos ({media.length}) - Admin Verification</Text>
        <View style={{flexDirection:"row", flexWrap:"wrap", gap:10, marginTop:10}}>
          {media.map((m:any,i:number)=>(
            <View key={i} style={{backgroundColor:"white", padding:6, borderRadius:12, borderWidth:1, borderColor:"#e2e8f0"}}>
              <Image source={{uri: m.url}} style={{width:120, height:120, borderRadius:10}}/>
              <View style={{backgroundColor: m.type==='arrival_before_work' ? "#ffedd5" : "#dcfce7", paddingHorizontal:6, paddingVertical:2, borderRadius:6, marginTop:6, alignSelf:"flex-start"}}><Text style={{fontSize:9, fontWeight:"900"}}>{m.type?.toUpperCase()}</Text></View>
              <Text style={{fontSize:9, color:"#64748b", marginTop:4}}>{new Date(m.created_at).toLocaleString()}</Text>
              {m.latitude && <Text style={{fontSize:8, color:"#0ABAB5"}}>📍 {m.latitude?.toFixed(5)}</Text>}
            </View>
          ))}
        </View>

        {/* ADMIN ACTIONS */}
        <View style={{flexDirection:"row", gap:10, marginTop:24}}>
          <TouchableOpacity onPress={async()=>{ await supabase.from('jobs').update({status:'COMPLETED_VERIFIED'}).eq('id', jobId); alert("Verified!"); }} style={{flex:1, backgroundColor:"#22c55e", padding:16, borderRadius:14, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8}}><Ionicons name="checkmark-done" size={18} color="white"/><Text style={{color:"white", fontWeight:"900"}}>VERIFY & RELEASE 70%</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>Linking.openURL(`tel:${job?.plumbers?.phone || ''}`)} style={{backgroundColor:"white", borderWidth:1, borderColor:"#e2e8f0", width:54, height:54, borderRadius:14, justifyContent:"center", alignItems:"center"}}><Ionicons name="call" size={22} color="#0A1931"/></TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}