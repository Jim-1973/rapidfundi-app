import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, TextInput, Modal, ActivityIndicator, Linking, Platform, RefreshControl } from "react-native";
import { supabase, notifyAdmin, notifyPlumber } from "../../../lib/supabase";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const safeDate = (d: any) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleString();
  } catch {
    return "—";
  }
};

export default function MyJobs(){
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [media, setMedia] = useState<Record<string, any[]>>({});
  const [inquiries, setInquiries] = useState<Record<string, any[]>>({});
  const [showPay, setShowPay] = useState(false);
  const [payJob, setPayJob] = useState<any>(null);
  const [mpesaPin, setMpesaPin] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("254");
  const [loadingPay, setLoadingPay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showInquiry, setShowInquiry] = useState(false);
  const [inquiryText, setInquiryText] = useState("");
  const [inquiryJob, setInquiryJob] = useState<any>(null);
  const [inquiryQ, setInquiryQ] = useState<any>(null);
  const [sendingInquiry, setSendingInquiry] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineJob, setDeclineJob] = useState<any>(null);
  const [declineQ, setDeclineQ] = useState<any>(null);
  const [approvingId, setApprovingId] = useState<string|null>(null);
  const [decliningId, setDecliningId] = useState<string|null>(null);

  const getStatusUI = (status: string, payment_status?: string) => {
    if(payment_status === 'PAID' && status === 'COMPLETED'){
      return { text: "Paid & Completed", icon: "checkmark-done" as const, bg:"#dcfce7", color:"#166534", desc:"Work completed & paid via MPESA" };
    }
    switch(status){
      case 'UNDER_REVIEW': return { text: "Under Review", icon: "search" as const, bg:"#fef3c7", color:"#92400e", desc:"Admin reviewing your photos" };
      case 'QUOTATION_PREPARED': return { text: "Quotation Ready", icon: "receipt" as const, bg:"#ede9fe", color:"#5b21b6", desc:"New quotation received! Latest price below" };
      case 'QUOTATION_APPROVED': return { text: "Approved", icon: "checkmark-circle" as const, bg:"#ccfbf1", color:"#0f766e", desc:"Approved - assigning plumber..." };
      case 'ASSIGNED': return { text: "Plumber Assigned", icon: "person" as const, bg:"#dcfce7", color:"#166534", desc:"Plumber assigned" };
      case 'EN_ROUTE': return { text: "On The Way", icon: "bicycle" as const, bg:"#ffedd5", color:"#9a3412", desc:"Plumber is on the way" };
      case 'ARRIVED': return { text: "Work Ongoing", icon: "construct" as const, bg:"#dbeafe", color:"#1e40af", desc:"Work in progress" };
      case 'COMPLETED': return { text: "Awaiting Verification", icon: "camera" as const, bg:"#fef9c3", color:"#854d0e", desc:"Verify & pay" };
      case 'DECLINED': return { text: "Declined", icon: "close-circle" as const, bg:"#fee2e2", color:"#991b1b", desc:"You declined - new quote coming" };
      default: return { text: status, icon: "time" as const, bg:"#f1f5f9", color:"#334155", desc:"" };
    }
  };

  const fetchJobs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); router.replace("/login" as any); return; }
    setUserId(user.id);
    const { data, error } = await supabase.from('jobs').select(`*, quotations(*), plumbers(name, plumber_number, phone, rating, estate, location)`).eq('customer_id', user.id).order('created_at', {ascending:false});
    if (error) { setLoading(false); setRefreshing(false); return; }
    const enriched = [];
    for(const job of (data||[])){
      const { data: latestQs } = await supabase.from('quotations').select('*').eq('job_id', job.id).order('created_at', {ascending:false});
      if(latestQs && latestQs.length>0) job.quotations = latestQs;
      enriched.push(job);
    }
    setJobs(enriched);
    if(enriched.length>0){
      const newMedia: Record<string, any[]> = {};
      for(const j of enriched){
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
      const jobIds = enriched.map((j:any)=>j.id);
      const { data:inq } = await supabase.from('job_inquiries').select('*').in('job_id', jobIds).order('created_at',{ascending:true});
      const grouped: Record<string, any[]> = {};
      (inq||[]).forEach((i:any)=>{ if(!grouped[i.job_id]) grouped[i.job_id]=[]; grouped[i.job_id].push(i); });
      setInquiries(grouped);
    }
    setLastUpdate(new Date().toLocaleTimeString());
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchJobs(); };
  useFocusEffect(useCallback(() => { fetchJobs(); }, []));
  useEffect(()=>{
    if(!userId) return;
    const channel = supabase.channel(`customer-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `customer_id=eq.${userId}` }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_media' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_inquiries' }, () => fetchJobs())
      .subscribe((status) => { if(status === 'SUBSCRIBED') setIsLive(true); });
    return () => { supabase.removeChannel(channel); }
  }, [userId]);

  const autoAssignByEstate = async (job: any) => {
    try {
      const estate = job.estate || job.location || job.building_name;
      if(!estate) return false;
      const { data: matched } = await supabase.from('plumbers').select('*').eq('active', true).or(`estate.eq.${estate},location.eq.${estate}`).order('rating', { ascending: false }).limit(1);
      let plumber = matched?.[0];
      if(!plumber){
        const { data: anyPlumber } = await supabase.from('plumbers').select('*').eq('active', true).order('rating', { ascending: false }).limit(1);
        plumber = anyPlumber?.[0];
      }
      if(!plumber) return false;
      await supabase.from('jobs').update({ assigned_plumber_id: plumber.id, status: 'ASSIGNED' }).eq('id', job.id);
      if(plumber.user_id){ await notifyPlumber(plumber.user_id, "🔧 Auto-Assigned!", `You have been auto-assigned ${job.job_number} in ${estate}.`, "ASSIGNMENT", job.id); }
      await notifyAdmin("🤖 Auto-Assigned", `${plumber.name} auto-assigned to ${job.job_number}`, "AUTO_ASSIGN", job.id);
      return true;
    } catch{ return false; }
  };

  const approve = async (job:any, q:any, effectiveTotal:number) => {
    const executeApprove = async () => {
      setApprovingId(job.id);
      try{
        if(q?.id) await supabase.from('quotations').update({status:'APPROVED', total: effectiveTotal}).eq('id', q.id);
        await supabase.from('jobs').update({status:'QUOTATION_APPROVED'}).eq('id', job.id);
        await supabase.from('job_inquiries').update({ status: 'RESOLVED', resolved_at: new Date().toISOString() }).eq('job_id', job.id).eq('status','PENDING');
        let autoDone = false;
        try{ autoDone = await autoAssignByEstate(job); }catch{}
        try{ await notifyAdmin("✅ Approved - "+job.job_number, `Customer approved KES ${effectiveTotal}`, "APPROVAL", job.id); }catch{}
        await fetchJobs();
      }catch(e:any){ alert("Approve failed: "+e.message); }finally{ setApprovingId(null); }
    };
    if(Platform.OS==='web'){
      const ok = window.confirm(`Approve KES ${effectiveTotal?.toLocaleString()} for ${job.job_number}?`);
      if(ok) executeApprove();
    }else{
      Alert.alert("Approve?", `Approve KES ${effectiveTotal} for ${job.job_number}?`, [{text:"Cancel", style:"cancel"}, {text:"Approve", onPress: executeApprove}]);
    }
  };

  const openDeclineModal = (job:any, q:any) => { setDeclineJob(job); setDeclineQ(q); setDeclineReason(""); setShowDecline(true); };
  const confirmDecline = async () => {
    if(!declineJob || !declineQ) return;
    if(!declineReason.trim()){ alert("Please write reason"); return; }
    setDecliningId(declineJob.id);
    try{
      if(declineQ?.id) await supabase.from('quotations').update({status:'DECLINED', decline_reason: declineReason}).eq('id', declineQ.id);
      await supabase.from('jobs').update({status:'DECLINED', decline_reason: declineReason}).eq('id', declineJob.id);
      await supabase.from('job_inquiries').insert({ job_id: declineJob.id, customer_id: userId, quotation_id: declineQ?.id, message: declineReason, type: 'DECLINE', status: 'PENDING' });
      try{ await notifyAdmin("❌ Declined - "+declineJob.job_number, `Declined KES ${declineQ?.total}. Reason: ${declineReason}`, "DECLINED", declineJob.id); }catch{}
      setShowDecline(false);
      await fetchJobs();
    }catch(e:any){ alert("Decline failed: "+e.message); }finally{ setDecliningId(null); }
  };

  const sendInquiry = async () => {
    if(!inquiryText.trim() || !inquiryJob) return;
    setSendingInquiry(true);
    try{
      await supabase.from('job_inquiries').insert({ job_id: inquiryJob.id, customer_id: userId, quotation_id: inquiryQ?.id, message: inquiryText, type: 'QUESTION', status: 'PENDING' });
      await notifyAdmin(`💬 Question - ${inquiryJob.job_number}`, inquiryText.substring(0,100), "INQUIRY", inquiryJob.id);
      setInquiryText(""); setShowInquiry(false); await fetchJobs();
    }catch(e:any){ alert("Failed: "+e.message); }finally{ setSendingInquiry(false); }
  };

  const openMpesaPay = async (job:any, effectiveTotal:number) => {
    setPayJob({...job, effectiveTotal});
    const { data: { user } } = await supabase.auth.getUser();
    const phoneFromMeta = (user?.user_metadata as any)?.phone || "254";
    setMpesaPhone(phoneFromMeta); setMpesaPin(""); setShowPay(true);
  };
  const processMpesaPayment = async () => {
    if(mpesaPin.length < 4){ alert("Enter MPESA PIN"); return; }
    setLoadingPay(true); await new Promise(r=>setTimeout(r,2000));
    try{
      await supabase.from('jobs').update({ payment_status: 'PAID', status: 'COMPLETED', paid_at: new Date().toISOString() }).eq('id', payJob.id);
      if(payJob.quotations?.[0]?.id) await supabase.from('quotations').update({ status: 'PAID' }).eq('id', payJob.quotations[0].id);
      await notifyAdmin("💰 Paid - "+payJob.job_number, `${payJob.job_number} paid KES ${payJob.effectiveTotal}`, "PAYMENT", payJob.id);
      setShowPay(false);
    }catch(e:any){ alert("Payment failed: "+e.message); }finally{ setLoadingPay(false); }
  };

  return (
    <View style={{flex:1, backgroundColor:"#f8fafc"}}>
    <ScrollView style={{flex:1}} contentContainerStyle={{padding:16, paddingTop:12, paddingBottom:30}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
        <TouchableOpacity onPress={onRefresh} style={{flexDirection:"row", alignItems:"center", gap:6}}><Ionicons name="refresh" size={14} color="#0ABAB5" /><Text style={{color:"#0ABAB5", fontSize:12, fontWeight:"700"}}>Pull to refresh</Text></TouchableOpacity>
        <View style={{flexDirection:"row", gap:8, alignItems:"center"}}>{isLive && <View style={{flexDirection:"row", alignItems:"center", backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:3, borderRadius:12, gap:4}}><View style={{width:6, height:6, borderRadius:3, backgroundColor:"#22c55e"}}/><Text style={{fontSize:10, fontWeight:"900", color:"#16a34a"}}>LIVE</Text></View>}<Text style={{fontSize:10, color:"#94a3b8"}}>{lastUpdate}</Text></View>
      </View>
      {loading && <ActivityIndicator style={{ marginTop:30 }} color="#0ABAB5" />}
      <View style={{gap:14}}>
        {jobs.map((job, idx)=>{
          const allQs = (job.quotations||[]).sort((a:any,b:any)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const qLatest = allQs[0];
          const jobTotal = Number(job.total_amount || job.total || job.quotation_total || job.estimated_cost || 0);
          const quotationTotal = Number(qLatest?.total || 0);
          const effectiveTotal = jobTotal > 0 ? jobTotal : quotationTotal;
          const effectiveLabour = job.labour_cost ?? qLatest?.labour ?? 0;
          const effectiveMaterials = job.materials_cost ?? qLatest?.materials ?? 0;
          const effectiveFee = job.service_fee ?? qLatest?.service_fee ?? 200;
          const effectiveMaterialsList = job.materials_list || qLatest?.materials_list || "";
          const hasUpdate = allQs.length>1 || (jobTotal>0 && jobTotal !== quotationTotal);
          const s = getStatusUI(job.status, job.payment_status);
          const jobMedia = media[job.id] || [];
          const jobInqs = inquiries[job.id] || [];
          const completion = jobMedia.find((m:any)=>m.type==='completion');
          const isPaid = job.payment_status === 'PAID';
          const isApproving = approvingId===job.id;
          return (
            <View key={job.id} style={{backgroundColor:"white", padding:16, borderRadius:14, borderWidth:2, borderColor: hasUpdate? "#0ABAB5" : "#e2e8f0"}}>
              <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}><Text style={{fontWeight:"800"}}>{job.job_number}</Text><View style={{flexDirection:"row", alignItems:"center", gap:4, backgroundColor:s.bg, paddingHorizontal:8, paddingVertical:4, borderRadius:20}}><Ionicons name={s.icon} size={12} color={s.color} /><Text style={{fontSize:10, fontWeight:"800", color:s.color}}>{s.text}</Text></View></View>
              <Text style={{marginTop:4, fontWeight:"600"}}>{job.category} @ {job.building_name}</Text>
              <Text style={{fontSize:12, color:"#64748b", marginTop:2}}>{job.street} • Estate: {job.estate || job.building_name}</Text>
              <View style={{backgroundColor:s.bg, padding:10, borderRadius:8, marginTop:10}}><Text style={{fontSize:12, fontWeight:"700", color:s.color}}>{s.desc}</Text></View>
              {jobMedia.length > 0 && (<View style={{marginTop:12}}><Text style={{fontWeight:"800", fontSize:12}}>Evidence ({jobMedia.length})</Text><View style={{flexDirection:"row", gap:8, marginTop:8, flexWrap:"wrap"}}>{jobMedia.map((m:any,i:number)=>(<View key={i}><Image source={{uri: m.url}} style={{width:90, height:90, borderRadius:8, backgroundColor:"#e2e8f0"}}/><Text style={{fontSize:9, fontWeight:"800", marginTop:2}}>{m.type?.toUpperCase()}</Text></View>))}</View></View>)}
              {(qLatest || jobTotal>0) ? (
                <View style={{backgroundColor:"#ffffff", borderRadius:16, marginTop:12, borderWidth:2, borderColor:"#0ABAB5", overflow:"hidden"}}>
                  <View style={{ padding:14 }}>
                    <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
                      <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                        <Text style={{fontWeight:"900", fontSize:18, color:"#0A1931"}}>KES {effectiveTotal.toLocaleString()}</Text>
                        <View style={{ backgroundColor:"#0ABAB5", paddingHorizontal:6, paddingVertical:2, borderRadius:6 }}><Text style={{ fontSize:9, fontWeight:"900", color:"white" }}>LATEST</Text></View>
                      </View>
                      <Text style={{ fontSize:10, fontWeight:"700", color:"#5b21b6", backgroundColor:"#ede9fe", paddingHorizontal:8, paddingVertical:3, borderRadius:10 }}>{qLatest?.status || job.status}</Text>
                    </View>
                    <Text style={{fontSize:11, marginTop:6, color:"#475569"}}>Labour {effectiveLabour} + Materials {effectiveMaterials} + Fee {effectiveFee}</Text>
                    <Text style={{fontSize:10, color:"#94a3b8", marginTop:2}}>Updated: {safeDate(job.updated_at || qLatest?.created_at)}</Text>
                    {effectiveMaterialsList ? <View style={{ backgroundColor:"#f8fafc", borderRadius:10, padding:10, marginTop:8 }}><Text style={{ fontSize:10, fontWeight:"800" }}>MATERIALS</Text><Text style={{ fontSize:11, marginTop:4 }}>{effectiveMaterialsList}</Text></View> : null}
                    {allQs.length>0 && (
                      <View style={{ backgroundColor:"#f1f5f9", borderRadius:10, padding:10, marginTop:10 }}>
                        <Text style={{ fontSize:9, fontWeight:"800", color:"#334155" }}>QUOTATION HISTORY ({allQs.length})</Text>
                        {allQs.map((old:any,i:number)=>(
                          <View key={i} style={{ flexDirection:"row", justifyContent:"space-between", marginTop:6, backgroundColor: i===0 && old.total===effectiveTotal ? "#dcfce7" : "white", padding:6, borderRadius:6 }}>
                            <Text style={{ fontSize:11, fontWeight: i===0 ? "800":"400", color: i===0 ? "#166534":"#64748b" }}>{old.quotation_number || `Quote ${i+1}`}: KES {Number(old.total||0).toLocaleString()} • {safeDate(old.created_at)}</Text>
                            <Text style={{ fontSize:9, color:"#94a3b8", fontWeight:"700" }}>{old.status}</Text>
                          </View>
                        ))}
                        {hasUpdate && jobTotal>0 && jobTotal !== quotationTotal && (
                          <View style={{ backgroundColor:"#fffbeb", padding:6, borderRadius:6, marginTop:6 }}>
                            <Text style={{ fontSize:10, color:"#92400e", fontWeight:"700" }}>Admin updated to KES {jobTotal.toLocaleString()} — this is current price</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  {(qLatest?.status==='PENDING' || job.status==='QUOTATION_PREPARED') && (
                    <View style={{ padding:12, borderTopWidth:1, borderTopColor:"#f1f5f9" }}>
                      <TouchableOpacity onPress={()=>approve(job,qLatest,effectiveTotal)} disabled={isApproving} style={{ backgroundColor: isApproving ? "#94a3b8" : "#0ABAB5", padding:14, borderRadius:12, flexDirection:"row", justifyContent:"center", gap:8 }}>
                        {isApproving ? <ActivityIndicator color="white" /> : <Ionicons name="checkmark-circle" size={18} color="white" />}
                        <Text style={{color:"white", fontWeight:"900", fontSize:14}}>{isApproving ? "Approving..." : `Approve KES ${effectiveTotal.toLocaleString()}`}</Text>
                      </TouchableOpacity>
                      <View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
                        <TouchableOpacity onPress={()=>{ setInquiryJob(job); setInquiryQ(qLatest); setShowInquiry(true); }} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:11, borderRadius:12, flexDirection:"row", justifyContent:"center", gap:6 }}><Ionicons name="chatbubble-ellipses-outline" size={14} color="#0A1931" /><Text style={{ fontWeight:"700", fontSize:12 }}>Ask Question</Text></TouchableOpacity>
                        <TouchableOpacity onPress={()=>openDeclineModal(job,qLatest)} style={{ flex:1, borderWidth:1, borderColor:"#fee2e2", padding:11, borderRadius:12, flexDirection:"row", justifyContent:"center", gap:6 }}><Ionicons name="close-circle" size={14} color="#dc2626" /><Text style={{ fontWeight:"700", fontSize:12, color:"#dc2626" }}>Decline</Text></TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ) : <Text style={{marginTop:8, fontSize:12, color:"#94a3b8"}}>Waiting for quotation...</Text>}
              {jobInqs.length > 0 && (
                <View style={{ backgroundColor:"#fff", borderRadius:14, marginTop:12, borderWidth:1, borderColor:"#e2e8f0", overflow:"hidden" }}>
                  <View style={{ backgroundColor:"#f8fafc", paddingHorizontal:12, paddingVertical:8, flexDirection:"row", justifyContent:"space-between", borderBottomWidth:1, borderBottomColor:"#f1f5f9" }}><View style={{ flexDirection:"row", alignItems:"center", gap:6 }}><Ionicons name="chatbubbles" size={14} color="#0A1931" /><Text style={{ fontWeight:"800", fontSize:11 }}>Conversation ({jobInqs.length})</Text></View><Text style={{ fontSize:9, fontWeight:"800", color:"#0ABAB5", backgroundColor:"#ccfbf1", paddingHorizontal:6, paddingVertical:2, borderRadius:10 }}>LIVE</Text></View>
                  <View style={{ padding:10, gap:10 }}>
                    {jobInqs.map((inq:any,i:number)=>(
                      <View key={i} style={{ gap:6 }}>
                        <View style={{ flexDirection:"row", gap:8 }}><View style={{ width:26, height:26, borderRadius:13, backgroundColor: inq.type==='DECLINE' ? "#fee2e2" : "#0A1931", justifyContent:"center", alignItems:"center" }}><Text style={{ color:"white", fontSize:9, fontWeight:"900" }}>{inq.type==='DECLINE' ? "!" : "You"}</Text></View><View style={{ flex:1, backgroundColor: inq.type==='DECLINE' ? "#fef2f2" : "#f1f5f9", borderRadius:10, padding:9, borderWidth:1, borderColor: inq.type==='DECLINE' ? "#fecaca" : "#e2e8f0" }}><Text style={{ fontSize:9, fontWeight:"800", color:"#64748b" }}>{inq.type==='DECLINE' ? "YOU DECLINED" : "YOU"} • {safeDate(inq.created_at)}</Text><Text style={{ fontSize:12, color:"#0A1931", marginTop:3 }}>{inq.message}</Text></View></View>
                        {inq.admin_reply && (<View style={{ flexDirection:"row", gap:8, marginLeft:34 }}><View style={{ width:26, height:26, borderRadius:13, backgroundColor:"#0ABAB5", justifyContent:"center", alignItems:"center" }}><Ionicons name="shield-checkmark" size={10} color="white" /></View><View style={{ flex:1, backgroundColor:"#f0fdfa", borderRadius:10, padding:9, borderWidth:1, borderColor:"#ccfbf1" }}><Text style={{ fontSize:9, fontWeight:"800", color:"#0f766e" }}>ADMIN • {inq.status}</Text><Text style={{ fontSize:12, color:"#134e4a", marginTop:3, fontWeight:"600" }}>{inq.admin_reply}</Text></View></View>)}
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {job.status === 'COMPLETED' &&!isPaid && completion && (<TouchableOpacity onPress={()=>openMpesaPay(job,effectiveTotal)} style={{backgroundColor:"#0A1931", padding:16, borderRadius:12, marginTop:12, flexDirection:"row", justifyContent:"center", gap:8}}><Ionicons name="card" size={18} color="white" /><Text style={{color:"white", fontWeight:"900"}}>Verify & Pay KES {effectiveTotal} via MPESA</Text></TouchableOpacity>)}
              {isPaid && (<View style={{backgroundColor:"#dcfce7", padding:12, borderRadius:10, marginTop:12, flexDirection:"row", justifyContent:"center", gap:6}}><Ionicons name="checkmark-done-circle" size={16} color="#166534" /><Text style={{fontWeight:"800", color:"#166534"}}>PAID & COMPLETED</Text></View>)}
            </View>
          )
        })}
        {jobs.length===0 &&!loading && <Text style={{textAlign:"center", marginTop:40, color:"#94a3b8"}}>No jobs yet</Text>}
      </View>

      <Modal visible={showPay} transparent animationType="slide"><View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end"}}><View style={{backgroundColor:"white", padding:20, borderTopLeftRadius:20, borderTopRightRadius:20}}><Text style={{fontSize:20, fontWeight:"900"}}>MPESA Payment KES {payJob?.effectiveTotal}</Text><TextInput value={mpesaPhone} onChangeText={setMpesaPhone} keyboardType="phone-pad" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:12}}/><TextInput value={mpesaPin} onChangeText={setMpesaPin} secureTextEntry placeholder="MPESA PIN" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:8}}/><TouchableOpacity onPress={processMpesaPayment} disabled={loadingPay} style={{backgroundColor:"#0ABAB5", padding:16, borderRadius:12, marginTop:16}}>{loadingPay? <ActivityIndicator color="white"/> : <Text style={{color:"white", textAlign:"center", fontWeight:"900"}}>PAY NOW</Text>}</TouchableOpacity><TouchableOpacity onPress={()=>setShowPay(false)} style={{padding:12, marginTop:8}}><Text style={{textAlign:"center", color:"#64748b"}}>Cancel</Text></TouchableOpacity></View></View></Modal>

      <Modal visible={showInquiry} transparent animationType="slide"><View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end"}}><View style={{backgroundColor:"white", padding:20, borderTopLeftRadius:20, borderTopRightRadius:20}}><Text style={{fontSize:18, fontWeight:"900"}}>Ask about quotation</Text><TextInput placeholder="e.g. Can you explain materials cost?" value={inquiryText} onChangeText={setInquiryText} multiline style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:12, height:100, textAlignVertical:"top", backgroundColor:"#f8fafc" }} /><View style={{ flexDirection:"row", gap:10, marginTop:16 }}><TouchableOpacity onPress={()=>setShowInquiry(false)} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12, alignItems:"center" }}><Text style={{ fontWeight:"700" }}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={sendInquiry} disabled={sendingInquiry || !inquiryText.trim()} style={{ flex:1, backgroundColor: !inquiryText.trim() ? "#94a3b8" : "#0A1931", padding:14, borderRadius:12, alignItems:"center" }}>{sendingInquiry ? <ActivityIndicator color="white" /> : <Text style={{ color:"white", fontWeight:"800" }}>Send</Text>}</TouchableOpacity></View></View></View></Modal>

      <Modal visible={showDecline} transparent animationType="slide"><View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end"}}><View style={{backgroundColor:"white", padding:20, borderTopLeftRadius:20, borderTopRightRadius:20}}><Text style={{fontSize:18, fontWeight:"900"}}>Decline Quotation</Text><Text style={{color:"#64748b", fontSize:12, marginTop:6}}>For {declineJob?.job_number} — Reason helps admin</Text><TextInput placeholder="e.g. Too expensive..." value={declineReason} onChangeText={setDeclineReason} multiline style={{ borderWidth:1, borderColor:"#fee2e2", borderRadius:12, padding:14, marginTop:12, height:100, textAlignVertical:"top", backgroundColor:"#fef2f2" }} /><View style={{ flexDirection:"row", gap:10, marginTop:16 }}><TouchableOpacity onPress={()=>setShowDecline(false)} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12, alignItems:"center" }}><Text style={{ fontWeight:"700" }}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={confirmDecline} disabled={!!decliningId || !declineReason.trim()} style={{ flex:1, backgroundColor: !declineReason.trim() ? "#94a3b8" : "#dc2626", padding:14, borderRadius:12, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:6 }}>{decliningId ? <ActivityIndicator color="white" /> : <Ionicons name="close-circle" size={14} color="white" />}<Text style={{ color:"white", fontWeight:"800" }}>{decliningId ? "Declining..." : "Confirm Decline"}</Text></TouchableOpacity></View></View></View></Modal>

    </ScrollView>
    </View>
  )
}