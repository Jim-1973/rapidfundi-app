import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, TextInput, Modal, ActivityIndicator } from "react-native";
import { supabase } from "../../../lib/supabase";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function MyJobs(){
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [media, setMedia] = useState<Record<string, any[]>>({});
  const [showPay, setShowPay] = useState(false);
  const [payJob, setPayJob] = useState<any>(null);
  const [mpesaPin, setMpesaPin] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("254");
  const [loadingPay, setLoadingPay] = useState(false);
  const [loading, setLoading] = useState(true);

  const getStatusUI = (status: string, payment_status?: string) => {
    if(payment_status === 'PAID' && status === 'COMPLETED'){
      return { text: "Paid & Completed", icon: "checkmark-done" as const, bg:"#dcfce7", color:"#166534", desc:"Work completed & paid via MPESA - Thank you!" };
    }
    switch(status){
      case 'UNDER_REVIEW': return { text: "Under Review", icon: "search" as const, bg:"#fef3c7", color:"#92400e", desc:"Admin reviewing your photos" };
      case 'QUOTATION_PREPARED': return { text: "Quotation Ready", icon: "receipt" as const, bg:"#ede9fe", color:"#5b21b6", desc:"New quotation received!" };
      case 'QUOTATION_APPROVED': return { text: "Approved", icon: "checkmark-circle" as const, bg:"#ccfbf1", color:"#0f766e", desc:"Assigning plumber..." };
      case 'ASSIGNED': return { text: "Plumber Assigned", icon: "person" as const, bg:"#dcfce7", color:"#166534", desc:"Plumber will start soon" };
      case 'EN_ROUTE': return { text: "On The Way", icon: "bicycle" as const, bg:"#ffedd5", color:"#9a3412", desc:"Plumber is on the way! 30 min response active" };
      case 'ARRIVED': return { text: "Work Ongoing", icon: "construct" as const, bg:"#dbeafe", color:"#1e40af", desc:"Plumber arrived (GPS proof) - Work in progress now" };
      case 'COMPLETED': return { text: "Awaiting Verification", icon: "camera" as const, bg:"#fef9c3", color:"#854d0e", desc:"Plumber uploaded final photo - Please verify & pay" };
      case 'DECLINED': return { text: "Declined", icon: "close-circle" as const, bg:"#fee2e2", color:"#991b1b", desc:"You declined quotation" };
      default: return { text: status, icon: "time" as const, bg:"#f1f5f9", color:"#334155", desc:"" };
    }
  };

  const fetchJobs = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace("/login" as any);
      return;
    }
    const { data, error } = await supabase
 .from('jobs')
 .select(`*, quotations(*), plumbers(name, plumber_number, phone, rating)`)
 .eq('customer_id', user.id)
 .order('created_at', {ascending:false});
    if (error) {
      console.log("fetch error", error);
      setLoading(false);
      return;
    }
    setJobs(data||[]);
    if(data){
      const newMedia: Record<string, any[]> = {};
      for(const j of data){
        const { data: m } = await supabase.from('job_media').select('*').eq('job_id', j.id).order('created_at',{ascending:true});
        if(m) {
          const fixed = m.map((item:any) => {
            if(!item.url) return item;
            if(item.url.startsWith('http')) return item;
            const { data } = supabase.storage.from('job-evidence').getPublicUrl(item.url);
            return {...item, url: data.publicUrl };
          });
          newMedia[j.id] = fixed;
        }
      }
      setMedia(newMedia);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchJobs(); }, []));
  const approve = async (job:any, q:any) => {
    await supabase.from('quotations').update({status:'APPROVED'}).eq('id', q.id);
    await supabase.from('jobs').update({status:'QUOTATION_APPROVED'}).eq('id', job.id);
    Alert.alert("Approved", "Admin will assign plumber now");
    fetchJobs();
  };
  const decline = async (q:any, job:any) => {
    await supabase.from('quotations').update({status:'DECLINED'}).eq('id', q.id);
    await supabase.from('jobs').update({status:'DECLINED'}).eq('id', job.id);
    fetchJobs();
  };
  const openMpesaPay = (job:any) => {
    const q = job.quotations?.[0];
    if(!q){ Alert.alert("No quotation"); return; }
    setPayJob(job);
    setMpesaPhone("254");
    setMpesaPin("");
    setShowPay(true);
  };
  const processMpesaPayment = async () => {
    if(mpesaPin.length < 4){ Alert.alert("Enter MPESA PIN"); return; }
    if(mpesaPhone.length < 12){ Alert.alert("Enter valid MPESA number e.g. 2547..."); return; }
    setLoadingPay(true);
    await new Promise(r => setTimeout(r, 2500));
    try{
      const q = payJob.quotations?.[0];
      await supabase.from('jobs').update({ payment_status: 'PAID', status: 'COMPLETED', paid_at: new Date().toISOString() }).eq('id', payJob.id);
      if(q){ await supabase.from('quotations').update({ status: 'PAID' }).eq('id', q.id); }
      setShowPay(false);
      Alert.alert("Payment Success", `KES ${q.total} paid via MPESA\nCode: QG${Date.now().toString().slice(-6)}`);
      fetchJobs();
    } catch(e:any){ Alert.alert("Payment Failed", e.message); } finally { setLoadingPay(false); }
  };
  const confirmWorkDone = async (job:any) => {
    Alert.alert("Confirm Work", "Have you verified the final photo?", [{ text: "Cancel", style:"cancel" }, { text: "Yes, Verify & Pay", onPress: ()=> openMpesaPay(job) }])
  };

  return (
    <View style={{flex:1, backgroundColor:"white"}}>
    <ScrollView style={{flex:1}} contentContainerStyle={{padding:20, paddingTop:50, paddingBottom:100}}>
      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
        <View><Text style={{fontSize:26, fontWeight:"900"}}>My Jobs</Text><Text style={{color:"#64748b"}}>Track, verify & pay via MPESA</Text></View>
        <TouchableOpacity onPress={()=> router.push("/")} style={{ backgroundColor:"#f1f5f9", paddingHorizontal:12, paddingVertical:8, borderRadius:20 }}><Text style={{ fontWeight:"700", fontSize:12 }}>← Request</Text></TouchableOpacity>
      </View>
      {loading && <ActivityIndicator style={{ marginTop:30 }} color="#0ABAB5" />}
      <View style={{gap:14, marginTop:20}}>
        {jobs.map((job, idx)=>{
          const q = job.quotations?.[0];
          const s = getStatusUI(job.status, job.payment_status);
          const jobMedia = media[job.id] || [];
          const completion = jobMedia.find((m:any)=>m.type==='completion');
          const isPaid = job.payment_status === 'PAID';
          const isNewest = idx === 0;
          return (
            <View key={job.id} style={{backgroundColor:"#f8fafc", padding:16, borderRadius:14, borderWidth: isNewest? 2 : 1, borderColor: isPaid? "#16a34a" : job.status==='EN_ROUTE' || job.status==='ARRIVED' || job.status==='COMPLETED'? s.color : isNewest? "#0ABAB5" : "#e2e8f0"}}>
              {isNewest && <View style={{flexDirection:"row", alignItems:"center", gap:4, marginBottom:6}}><Ionicons name="ellipse" size={8} color="#0ABAB5" /><Text style={{ fontSize:10, fontWeight:"800", color:"#0ABAB5" }}>LATEST</Text></View>}
              <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
                <Text style={{fontWeight:"800"}}>{job.job_number}</Text>
                <View style={{flexDirection:"row", alignItems:"center", gap:4, backgroundColor:s.bg, paddingHorizontal:8, paddingVertical:4, borderRadius:20}}>
                  <Ionicons name={s.icon} size={12} color={s.color} />
                  <Text style={{fontSize:10, fontWeight:"800", color:s.color}}>{s.text}</Text>
                </View>
              </View>
              <Text style={{marginTop:4, fontWeight:"600"}}>{job.category} @ {job.building_name}</Text>
              <Text style={{fontSize:12, color:"#64748b", marginTop:2}}>{job.street} • Floor {job.floor}</Text>
              <View style={{backgroundColor:s.bg, padding:10, borderRadius:8, marginTop:10, borderWidth:1, borderColor:s.color+"30", flexDirection:"row", gap:8, alignItems:"flex-start"}}>
                <Ionicons name={s.icon} size={14} color={s.color} style={{marginTop:1}} />
                <View style={{flex:1}}>
                  <Text style={{fontSize:12, fontWeight:"700", color:s.color}}>{s.desc}</Text>
                  {job.plumbers && <View style={{flexDirection:"row", alignItems:"center", gap:4, marginTop:4}}><Ionicons name="person-circle" size={12} color={s.color} /><Text style={{fontSize:11, color:s.color}}>{job.plumbers.name} ({job.plumbers.plumber_number}) • {job.plumbers.phone} • {job.plumbers.rating}★</Text></View>}
                </View>
              </View>
              {jobMedia.length > 0 && (
                <View style={{marginTop:12}}>
                  <View style={{flexDirection:"row", alignItems:"center", gap:4}}><Ionicons name="images" size={12} color="#334155" /><Text style={{fontWeight:"800", fontSize:12}}>Evidence Timeline ({jobMedia.length})</Text></View>
                  <View style={{flexDirection:"row", gap:8, marginTop:8, flexWrap:"wrap"}}>
                    {jobMedia.map((m:any,i:number)=>(
                      <View key={i} style={{alignItems:"center"}}>
                        <Image source={{uri: m.url}} style={{width:90, height:90, borderRadius:8, backgroundColor:"#e2e8f0"}}/>
                        <Text style={{fontSize:9, fontWeight:"800", marginTop:2}}>{m.type?.toUpperCase()}</Text>
                        {m.latitude!= null && m.longitude!= null && (
                          <View style={{flexDirection:"row", alignItems:"center", gap:2}}><Ionicons name="location" size={8} color="#64748b" /><Text style={{fontSize:8, color:"#64748b"}}>{Number(m.latitude).toFixed(4)},{Number(m.longitude).toFixed(4)}</Text></View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {q? (<View style={{backgroundColor:"white", padding:12, borderRadius:10, marginTop:10, borderWidth:1, borderColor:"#e2e8f0"}}><Text style={{fontWeight:"700"}}>{q.quotation_number}: KES {q.total} {isPaid? "• PAID" : ""}</Text><Text style={{fontSize:12, marginTop:4, color:"#475569"}}>Labour {q.labour} + Materials {q.materials} + Fee {q.service_fee}</Text>{q.status==='PENDING' && (<View style={{flexDirection:"row", gap:8, marginTop:10}}><TouchableOpacity onPress={()=>approve(job,q)} style={{flex:1, backgroundColor:"#0ABAB5", padding:12, borderRadius:10, flexDirection:"row", justifyContent:"center", gap:6}}><Ionicons name="checkmark" size={16} color="white" /><Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>APPROVE</Text></TouchableOpacity><TouchableOpacity onPress={()=>decline(q,job)} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:12, borderRadius:10, flexDirection:"row", justifyContent:"center", gap:6}}><Ionicons name="close" size={16} color="#334155" /><Text style={{textAlign:"center"}}>Decline</Text></TouchableOpacity></View>)}</View>) : <Text style={{marginTop:8, fontSize:12, color:"#94a3b8"}}>Waiting for admin quotation...</Text>}
              {job.status === 'COMPLETED' &&!isPaid && completion && (<TouchableOpacity onPress={()=>confirmWorkDone(job)} style={{backgroundColor:"#0A1931", padding:16, borderRadius:12, marginTop:12, flexDirection:"row", justifyContent:"center", gap:8}}><Ionicons name="card" size={18} color="white" /><Text style={{color:"white", textAlign:"center", fontWeight:"900"}}>Verify & Pay KES {q?.total} via MPESA</Text></TouchableOpacity>)}
              {isPaid && (<View style={{backgroundColor:"#dcfce7", padding:12, borderRadius:10, marginTop:12, flexDirection:"row", justifyContent:"center", gap:6}}><Ionicons name="checkmark-done-circle" size={16} color="#166534" /><Text style={{fontWeight:"800", color:"#166534", textAlign:"center"}}>PAID & COMPLETED</Text></View>)}
            </View>
          )
        })}
        {jobs.length===0 &&!loading && <Text style={{textAlign:"center", marginTop:40, color:"#94a3b8"}}>No jobs yet.</Text>}
      </View>
      <Modal visible={showPay} transparent animationType="slide"><View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end"}}><View style={{backgroundColor:"white", padding:20, borderTopLeftRadius:20, borderTopRightRadius:20}}><Text style={{fontSize:20, fontWeight:"900"}}>MPESA Payment</Text><Text style={{color:"#64748b", marginTop:4}}>Pay KES {payJob?.quotations?.[0]?.total}</Text><Text style={{fontWeight:"700", marginTop:16}}>MPESA Phone</Text><TextInput value={mpesaPhone} onChangeText={setMpesaPhone} keyboardType="phone-pad" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:6}}/><Text style={{fontWeight:"700", marginTop:12}}>MPESA PIN</Text><TextInput value={mpesaPin} onChangeText={setMpesaPin} secureTextEntry keyboardType="numeric" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:6}}/><TouchableOpacity onPress={processMpesaPayment} disabled={loadingPay} style={{backgroundColor:"#0ABAB5", padding:16, borderRadius:12, marginTop:16}}>{loadingPay? <ActivityIndicator color="white"/> : <View style={{flexDirection:"row", justifyContent:"center", gap:8}}><Ionicons name="card" color="white" size={18} /><Text style={{color:"white", textAlign:"center", fontWeight:"900"}}>PAY NOW</Text></View>}</TouchableOpacity><TouchableOpacity onPress={()=>setShowPay(false)} style={{padding:12, marginTop:8}}><Text style={{textAlign:"center", color:"#64748b"}}>Cancel</Text></TouchableOpacity></View></View></Modal>
    </ScrollView>

    <TouchableOpacity
      onPress={()=> router.push("/contact" as any)}
      style={{
        position:"absolute",
        bottom:24,
        right:20,
        backgroundColor:"#0A1931",
        paddingHorizontal:18,
        paddingVertical:14,
        borderRadius:30,
        flexDirection:"row",
        alignItems:"center",
        gap:8,
        elevation:6
      }}>
      <Ionicons name="headset" size={20} color="white" />
      <Text style={{color:"white", fontWeight:"900"}}>Help</Text>
    </TouchableOpacity>
    </View>
  )
}