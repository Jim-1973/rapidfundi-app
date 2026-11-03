import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, TextInput, Modal, ActivityIndicator, Platform, RefreshControl, Linking } from "react-native";
import { supabase, toEAT } from "../../../lib/supabase";
import { payWithMpesa, ensureReceiptExists } from "../../../lib/mpesa";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { generateReceiptHTML, getReceiptsByJob } from "../../../lib/receipts";
import NotificationBell from "../../components/NotificationBell";
import AsyncStorage from '@react-native-async-storage/async-storage';

const safeDate=(d:any)=>{ try{ const dt=new Date(d); return isNaN(dt.getTime())?"—":dt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"});}catch{return "—";} };

const ADMIN_DISPLAY = "0722819877";
const ADMIN_PHONE = "254722819877";
const ADMIN_WHATSAPP = `https://wa.me/${ADMIN_PHONE}?text=Hi RapidFundi Admin, I need help with my job`;
const LOGO_URL = "https://qyqaqnkxtmsrrctknhxi.supabase.co/storage/v1/object/public/public-assets/logo.png";

export default function MyJobs(){
  const router=useRouter();
  const [jobs,setJobs]=useState<any[]>([]);
  const [media,setMedia]=useState<Record<string,any[]>>({});
  const [receiptsMap,setReceiptsMap]=useState<Record<string,any>>({});
  const [showPay,setShowPay]=useState(false);
  const [payJob,setPayJob]=useState<any>(null);
  const [mpesaPhone,setMpesaPhone]=useState("");
  const [loadingPay,setLoadingPay]=useState(false);
  const [payingJobId,setPayingJobId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [userId,setUserId]=useState<string|null>(null);
  const [approvingId,setApprovingId]=useState<string|null>(null);
  const [activeTab,setActiveTab]=useState<"ACTIVE"|"HISTORY">("ACTIVE");
  const [menuOpen,setMenuOpen]=useState(false);
  const [showPaySuccess,setShowPaySuccess]=useState(false);
  const [lastPaidJob,setLastPaidJob]=useState<any>(null);
  const [downloadingId,setDownloadingId]=useState<string|null>(null);
  const [customerName,setCustomerName]=useState("");

  const getStatusUI=(status:string,payment_status?:string)=>{
    if(status==='completed_awaiting_payment') return {text:"Awaiting Payment",icon:"card" as const,bg:"#fef3c7",color:"#92400e"};
    if(status==='paid'||payment_status==='PAID'||status==='PAID') return {text:"Paid",icon:"checkmark-done" as const,bg:"#dcfce7",color:"#166534"};
    if(status==='COMPLETED') return {text:"Completed",icon:"checkmark-done" as const,bg:"#dbeafe",color:"#1e40af"};
    switch(status){
      case 'UNDER_REVIEW': return {text:"Under Review",icon:"time" as const,bg:"#f1f5f9",color:"#64748b"};
      case 'QUOTATION_PREPARED': return {text:"Quotation Ready",icon:"receipt" as const,bg:"#ede9fe",color:"#5b21b6"};
      case 'QUOTATION_APPROVED': return {text:"Approved",icon:"checkmark" as const,bg:"#e0f2fe",color:"#075985"};
      case 'ASSIGNED': return {text:"Plumber Assigned",icon:"person" as const,bg:"#dcfce7",color:"#166534"};
      case 'EN_ROUTE': return {text:"On The Way",icon:"bicycle" as const,bg:"#ffedd5",color:"#9a3412"};
      case 'ARRIVED': return {text:"In Progress",icon:"construct" as const,bg:"#dbeafe",color:"#1e40af"};
      case 'DECLINED': return {text:"Declined",icon:"close" as const,bg:"#fee2e2",color:"#991b1b"};
      default: return {text:status,icon:"time" as const,bg:"#f1f5f9",color:"#334155"};
    }
  };

  const fetchJobs=async()=>{
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){ setLoading(false); setRefreshing(false); router.replace("/login" as any); return; }
      setUserId(user.id);
      try{
        const {data:cust} = await supabase.from('customers').select('full_name, name, first_name').eq('id', user.id).maybeSingle();
        const full = cust?.full_name || (cust as any)?.name || (cust as any)?.first_name || user.user_metadata?.full_name || user.email?.split('@')[0] || "";
        if(full) setCustomerName(full.split(" ")[0]);
      }catch{}
      const {data:myJobs, error} = await supabase.from('jobs').select('*').eq('customer_id',user.id).order('created_at',{ascending:false});
      if(error) throw error;
      let enriched=myJobs||[];
      for(let i=0;i<enriched.length;i++){
        const job=enriched[i];
        try{ const {data}=await supabase.from('quotations').select('*').eq('job_id',job.id).order('created_at',{ascending:false}); if(data?.length) enriched[i].quotations=data; }catch{}
        try{ if(job.assigned_plumber_id){ const {data}=await supabase.from('plumbers').select('name,plumber_number,phone').eq('id',job.assigned_plumber_id).single(); if(data) enriched[i].plumbers=data; } }catch{}
      }
      setJobs(enriched);
      const newReceipts:Record<string,any>={};
      for(const j of enriched){
        try{ const r = await getReceiptsByJob(j.id); const final = r.find((x:any)=> x.type==='FINAL') || r[0]; if(final) newReceipts[j.id]=final; }catch{}
      }
      setReceiptsMap(newReceipts);
      if(enriched.length){
        const newMedia:Record<string,any[]>={};
        for(const j of enriched){
          try{
            const {data}=await supabase.from('job_media').select('*').eq('job_id',j.id).order('created_at',{ascending:true});
            if(data){ newMedia[j.id]=data.map((item:any)=>{ if(!item.url||item.url.startsWith('http')) return item; const {data:pub}=supabase.storage.from('job-evidence').getPublicUrl(item.url); return {...item,url:pub.publicUrl}; }); }
          }catch{}
        }
        setMedia(newMedia);
      }
    }catch(e:any){ console.log(e); }
    finally{ setLoading(false); setRefreshing(false); }
  };

  const onRefresh=()=>{ setRefreshing(true); fetchJobs(); };
  useFocusEffect(useCallback(()=>{ fetchJobs(); },[]));

  const approve=async(job:any,q:any,total:number)=>{
    const run=async()=>{ setApprovingId(job.id); try{ if(q?.id) await supabase.from('quotations').update({status:'APPROVED',total}).eq('id',q.id); await supabase.from('jobs').update({status:'QUOTATION_APPROVED'}).eq('id',job.id); await fetchJobs(); }catch(e:any){ Alert.alert("Failed",e.message);}finally{ setApprovingId(null);} };
    Alert.alert("Approve?","Approve KES "+total.toLocaleString()+"?",[{text:"Cancel",style:"cancel"},{text:"Approve",onPress:run}]);
  };

  const openMpesaPay=async(job:any,total:number)=>{
    setPayJob({...job,effectiveTotal:total});
    try{
      const {data:{user}}=await supabase.auth.getUser();
      const {data}=await supabase.from('customers').select('phone').eq('id',user?.id).maybeSingle();
      setMpesaPhone(data?.phone||(user?.user_metadata as any)?.phone||"");
    }catch{ setMpesaPhone(""); }
    setShowPay(true);
  };

  const downloadReceipt=async(job:any)=>{
    if(downloadingId) return;
    try{
      setDownloadingId(job.id);
      let receipt = receiptsMap[job.id];
      const effectiveTotal = Number(job.total_amount||0) > 0 ? Number(job.total_amount) : Number(receipt?.total || job.quotations?.[0]?.total || 0);
      if(!receipt){
        try {
          const created = await ensureReceiptExists(job.id, effectiveTotal || 0);
          if(created){ receipt = created; setReceiptsMap(prev=> ({...prev, [job.id]: created})); }
        } catch {}
      }
      const receiptNumber = receipt?.receipt_number || `RCPT-${job.job_number}-${Date.now().toString().slice(-5)}`;
      const html = generateReceiptHTML({
        receiptNumber, jobNumber: job.job_number,
        date: safeDate(receipt?.created_at || job.paid_at || job.completed_at || new Date()),
        category: job.category, building: job.building_name, estate: job.estate,
        labour: receipt?.labour || 0, materials_cost: receipt?.materials_cost || effectiveTotal,
        materials_list: receipt?.materials_list || [], amount: effectiveTotal, total: effectiveTotal
      });
      if(Platform.OS==='web'){ const win=window.open("","_blank"); if(win){ win.document.write(html); win.document.close(); setTimeout(()=>win.print(),500); } }
      else{ await Print.printAsync({ html }); }
    }catch(e:any){ Alert.alert("Print failed", e.message); }
    finally{ setDownloadingId(null); }
  };

  const processMpesaPayment=async()=>{
    if(!payJob||payingJobId) return;
    const digits=mpesaPhone.replace(/\D/g,"");
    if(digits.length<9){ Alert.alert("Invalid","Enter valid M-Pesa number"); return; }
    setPayingJobId(payJob.id); setLoadingPay(true);
    try{
      let f=mpesaPhone.replace(/\s/g,"").replace(/^0/,"254").replace(/^\+/,"");
      if(f.match(/^7/)||f.match(/^1/)) f="254"+f;
      if(!f.startsWith("254")) f="254"+digits.slice(-9);
      await payWithMpesa(payJob.id,f,payJob.effectiveTotal);
      setShowPay(false);
      setLastPaidJob({...payJob, effectiveTotal: payJob.effectiveTotal});
      setShowPaySuccess(true);
      setTimeout(()=>fetchJobs(),2000);
    }catch(e:any){ Alert.alert("Error",e.message||"Failed"); }
    finally{ setLoadingPay(false); setPayingJobId(null); }
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    Alert.alert("Logout?", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => {
        try { await supabase.auth.signOut(); await AsyncStorage.clear(); } catch {}
        router.replace("/login" as any);
      }}
    ]);
  };

  const activeJobs=jobs.filter(j=>!["paid","PAID","COMPLETED","CANCELLED","DECLINED"].includes(j.status) && j.payment_status!=='PAID');
  const historyJobs=jobs.filter(j=>["paid","PAID","COMPLETED","CANCELLED","DECLINED"].includes(j.status) || j.payment_status==='PAID');

  return (
    <View style={{flex:1,backgroundColor:"#f8fafc"}}>
      {/* FINAL PROFESSIONAL HEADER - ONLY ONE - NO UPPER DUPLICATE */}
      <View style={{backgroundColor:'white', paddingHorizontal:16, paddingTop:50, paddingBottom:12, borderBottomWidth:1, borderBottomColor:'#e2e8f0'}}>
        <View style={{ 
          flexDirection:'row', justifyContent:'space-between', alignItems:'center',
          backgroundColor:'#f8fafc', paddingHorizontal:14, paddingVertical:12, borderRadius:16, borderWidth:1, borderColor:'#e2e8f0'
        }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <Image source={{uri: LOGO_URL}} style={{width:38, height:38, resizeMode:'contain', borderRadius:8, backgroundColor:'white'}} />
            <View>
              <Text style={{fontSize:12, color:'#64748b', fontWeight:'600'}}>RapidFundi</Text>
              <Text style={{fontSize:16, fontWeight:'900', color:'#0A1931'}}>My Jobs • {customerName || ''}</Text>
            </View>
          </View>
          <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
            {userId ? <NotificationBell userId={userId} role="customer" /> : null}
            <TouchableOpacity onPress={()=>setMenuOpen(true)} style={{ backgroundColor:"white", width:38, height:38, borderRadius:10, justifyContent:"center", alignItems:"center", borderWidth:1, borderColor:'#e2e8f0' }}>
              <Ionicons name="menu" size={18} color="#0A1931"/>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{flexDirection:"row", backgroundColor:"#f1f5f9", marginTop:12, borderRadius:12, padding:4}}>
          <TouchableOpacity onPress={()=>setActiveTab("ACTIVE")} style={{flex:1, backgroundColor: activeTab==="ACTIVE"?"#0A1931":"transparent", padding:10, borderRadius:8, alignItems:"center"}}><Text style={{color: activeTab==="ACTIVE"?"white":"#64748b", fontWeight:"800", fontSize:12}}>Active ({activeJobs.length})</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setActiveTab("HISTORY")} style={{flex:1, backgroundColor: activeTab==="HISTORY"?"#0A1931":"transparent", padding:10, borderRadius:8, alignItems:"center"}}><Text style={{color: activeTab==="HISTORY"?"white":"#64748b", fontWeight:"800", fontSize:11}}>History • Receipts ({historyJobs.length})</Text></TouchableOpacity>
        </View>
      </View>

    <ScrollView style={{flex:1}} contentContainerStyle={{padding:12,paddingBottom:24}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ABAB5" />}>
      {loading&&<View style={{marginTop:40,alignItems:"center"}}><ActivityIndicator color="#0ABAB5"/><Text style={{marginTop:8,color:"#64748b",fontSize:12}}>Loading jobs...</Text></View>}
      <View style={{gap:12, marginTop:8}}>
        {(activeTab==="ACTIVE"? activeJobs : historyJobs).map((job)=>{
          const allQs=(job.quotations||[]).sort((a:any,b:any)=> new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
          const qLatest=allQs[0];
          const effectiveTotal=Number(job.total_amount||0)>0?Number(job.total_amount):Number(qLatest?.total||0);
          const s=getStatusUI(job.status,job.payment_status);
          const jobMedia=media[job.id]||[];
          const isPaid=job.status==='paid'||job.payment_status==='PAID'||job.status==='PAID';
          const isAwaiting=job.status==='completed_awaiting_payment';
          const receipt=receiptsMap[job.id];
          return (
            <View key={job.id} style={{backgroundColor:"white",borderRadius:16,borderWidth:1,borderColor:isAwaiting?"#f59e0b":isPaid?"#16a34a":"#e2e8f0",overflow:"hidden"}}>
              <View style={{padding:16}}>
                <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                  <View style={{flexDirection:"row",alignItems:"center",gap:8}}><View style={{backgroundColor:"#f1f5f9",paddingHorizontal:8,paddingVertical:4,borderRadius:8}}><Text style={{fontWeight:"800",fontSize:11,color:"#0A1931"}}>{job.job_number}</Text></View><Text style={{fontSize:11,color:"#94a3b8"}}>{safeDate(job.created_at).split(',')[0]}</Text></View>
                  <View style={{flexDirection:"row",alignItems:"center",gap:4,backgroundColor:s.bg,paddingHorizontal:10,paddingVertical:5,borderRadius:20}}><Ionicons name={s.icon} size={12} color={s.color}/><Text style={{fontSize:10,fontWeight:"800",color:s.color}}>{s.text}</Text></View>
                </View>
                <Text style={{marginTop:10,fontWeight:"800",fontSize:15,color:"#0A1931"}}>{job.category} • {job.building_name}</Text>
                <View style={{flexDirection:"row",alignItems:"center",gap:4,marginTop:4}}><Ionicons name="location-outline" size={12} color="#94a3b8"/><Text style={{fontSize:12,color:"#64748b"}}>{job.estate} {job.street? "• "+job.street:""}</Text></View>
                {isAwaiting&&(
                  <View style={{marginTop:14,backgroundColor:"#f8fafc",borderRadius:12,borderWidth:1,borderColor:"#e2e8f0",overflow:"hidden"}}>
                    <View style={{flexDirection:"row",padding:12,gap:12,alignItems:"center"}}>
                      {job.final_photo_url||jobMedia.find((m:any)=>m.type==='completion_final')? <Image source={{uri:job.final_photo_url||jobMedia.find((m:any)=>m.type==='completion_final')?.url}} style={{width:64,height:64,borderRadius:12}}/> : <View style={{width:64,height:64,borderRadius:12,backgroundColor:"#dcfce7",justifyContent:"center",alignItems:"center"}}><Ionicons name="checkmark" size={24} color="#16a34a"/></View>}
                      <View style={{flex:1}}><Text style={{fontWeight:"800",color:"#0A1931",fontSize:13}}>Work completed</Text><Text style={{fontSize:11,color:"#64748b",marginTop:2}}>{toEAT(job.completed_at)} EAT</Text><Text style={{fontSize:13,color:"#0A1931",marginTop:2,fontWeight:"800"}}>KES {effectiveTotal.toLocaleString()}</Text></View>
                    </View>
                    <View style={{padding:12,paddingTop:0}}>
                      <TouchableOpacity onPress={()=>openMpesaPay(job,effectiveTotal)} style={{backgroundColor:"#0A1931",padding:14,borderRadius:12,alignItems:"center"}}><Text style={{color:"white",fontWeight:"800",fontSize:14}}>Pay via M-Pesa</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
                {isPaid&&(
                  <View style={{marginTop:14,backgroundColor:"#f0fdf4",borderRadius:12,padding:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center", borderWidth:1, borderColor:"#dcfce7"}}>
                    <View style={{flexDirection:"row",gap:10,alignItems:"center", flex:1}}>
                      <View style={{width:32,height:32,borderRadius:16,backgroundColor:"#16a34a",justifyContent:"center",alignItems:"center"}}><Ionicons name="checkmark" size={16} color="white"/></View>
                      <View style={{flex:1}}><Text style={{fontWeight:"800",color:"#14532d",fontSize:12}}>Payment Confirmed</Text><Text style={{fontSize:10,color:"#15803d"}}>{receipt? safeDate(receipt.created_at): toEAT(job.paid_at)} • KES {effectiveTotal.toLocaleString()}</Text></View>
                    </View>
                    <TouchableOpacity onPress={()=>downloadReceipt(job)} disabled={downloadingId===job.id} style={{backgroundColor:"#0ABAB5", paddingHorizontal:12, paddingVertical:8, borderRadius:20, flexDirection:"row", alignItems:"center", gap:4}}>
                      {downloadingId===job.id? <ActivityIndicator color="white" size="small"/> : <><Ionicons name="download-outline" size={14} color="white"/><Text style={{color:"white", fontWeight:"700", fontSize:11}}>Receipt</Text></>}
                    </TouchableOpacity>
                  </View>
                )}
                {effectiveTotal>0&&!isAwaiting&&!isPaid&&qLatest&&(
                  <View style={{marginTop:12,backgroundColor:"white",borderRadius:12,borderWidth:1,borderColor:"#e2e8f0",padding:12}}>
                    <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text style={{fontWeight:"900",fontSize:16,color:"#0A1931"}}>KES {effectiveTotal.toLocaleString()}</Text><Text style={{fontSize:10,fontWeight:"700",color:"#5b21b6",backgroundColor:"#ede9fe",paddingHorizontal:8,paddingVertical:4,borderRadius:8}}>{qLatest.status}</Text></View>
                    {(qLatest?.status==='PENDING'||job.status==='QUOTATION_PREPARED')&&(
                      <TouchableOpacity onPress={()=>approve(job,qLatest,effectiveTotal)} disabled={!!approvingId} style={{marginTop:10,backgroundColor:approvingId?"#94a3b8":"#0A1931",padding:12,borderRadius:10,flexDirection:"row",justifyContent:"center",gap:6,alignItems:"center"}}>{approvingId===job.id?<ActivityIndicator color="white" size="small"/>:<Ionicons name="checkmark" size={16} color="white"/>}<Text style={{color:"white",fontWeight:"800",fontSize:13}}>{approvingId===job.id?"Processing...":"Approve Quotation"}</Text></TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          )
        })}
        {/* EMPTY STATES - NO REQUEST PLUMBER BUTTON */}
        {(activeTab==="HISTORY" && historyJobs.length===0 && !loading) && <View style={{alignItems:'center', marginTop:60}}><View style={{backgroundColor:'#f1f5f9', width:80, height:80, borderRadius:40, justifyContent:'center', alignItems:'center'}}><Ionicons name="receipt-outline" size={36} color="#94a3b8"/></View><Text style={{color:"#0A1931", marginTop:12, fontWeight:'700'}}>No completed jobs yet</Text><Text style={{color:"#94a3b8", fontSize:12, marginTop:4}}>Your paid jobs and receipts will appear here</Text></View>}
        {(activeTab==="ACTIVE" && activeJobs.length===0 && !loading) && <View style={{alignItems:'center', marginTop:60}}><View style={{backgroundColor:'#f1f5f9', width:80, height:80, borderRadius:40, justifyContent:'center', alignItems:'center'}}><Ionicons name="construct-outline" size={36} color="#94a3b8"/></View><Text style={{color:"#0A1931", marginTop:12, fontWeight:'700'}}>No active jobs</Text><Text style={{color:"#94a3b8", fontSize:12, marginTop:4, textAlign:'center'}}>Your ongoing plumbing requests will appear here</Text></View>}
      </View>
    </ScrollView>

      <Modal visible={showPay} transparent animationType="slide">
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"}}>
          <View style={{backgroundColor:"white",padding:24,borderTopLeftRadius:24,borderTopRightRadius:24,paddingBottom:40}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text style={{fontSize:18,fontWeight:"900",color:"#0A1931"}}>Confirm Payment</Text><TouchableOpacity onPress={()=>setShowPay(false)} style={{width:32,height:32,borderRadius:16,backgroundColor:"#f1f5f9",justifyContent:"center",alignItems:"center"}}><Ionicons name="close" size={18} color="#0A1931"/></TouchableOpacity></View>
            <View style={{backgroundColor:"#f8fafc",borderRadius:16,padding:16,marginTop:16,borderWidth:1,borderColor:"#e2e8f0"}}>
              <Text style={{fontSize:10,fontWeight:"800",color:"#94a3b8"}}>JOB REFERENCE</Text><Text style={{fontWeight:"800",marginTop:4,fontSize:14,color:"#0A1931"}}>{payJob?.job_number} • {payJob?.category}</Text>
              <View style={{flexDirection:"row",justifyContent:"space-between",marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:"#e2e8f0"}}><Text style={{fontSize:13,color:"#64748b"}}>Amount Due</Text><Text style={{fontWeight:"900",fontSize:18,color:"#0A1931"}}>KES {payJob?.effectiveTotal?.toLocaleString()}</Text></View>
            </View>
            <View style={{marginTop:20}}><Text style={{fontSize:12,fontWeight:"800",color:"#0A1931",marginBottom:8}}>M-Pesa Phone</Text><TextInput value={mpesaPhone} onChangeText={setMpesaPhone} keyboardType="phone-pad" placeholder="0712 345 678" placeholderTextColor="#94a3b8" style={{borderWidth:1.5,borderColor:"#e2e8f0",borderRadius:12,padding:14,fontSize:15,fontWeight:"600",color:"#0A1931"}}/></View>
            <TouchableOpacity onPress={processMpesaPayment} disabled={loadingPay} style={{backgroundColor:loadingPay?"#94a3b8":"#0A1931",padding:16,borderRadius:14,marginTop:20,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:8}}>
              {loadingPay? <><ActivityIndicator color="white" size="small"/><Text style={{color:"white",fontWeight:"800"}}>Sending...</Text></> : <><Ionicons name="shield-checkmark" size={18} color="white"/><Text style={{color:"white",fontWeight:"900",fontSize:14}}>Pay via M-Pesa</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="slide">
        <View style={{flex:1, backgroundColor:"#00000055", justifyContent:"flex-end"}}>
          <View style={{backgroundColor:"white", borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40}}>
            <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                <Image source={{uri: LOGO_URL}} style={{width:32, height:32, borderRadius:8}} />
                <View><Text style={{fontSize:16, fontWeight:"900"}}>Hi {customerName} 👋</Text><Text style={{fontSize:11, color:'#94a3b8'}}>RapidFundi • By Lantei</Text></View>
              </View>
              <TouchableOpacity onPress={()=>setMenuOpen(false)} style={{backgroundColor:"#f1f5f9", width:32, height:32, borderRadius:16, justifyContent:"center", alignItems:"center"}}><Ionicons name="close" size={18}/></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={()=>{setMenuOpen(false); onRefresh();}} style={{flexDirection:"row", alignItems:"center", backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:14, marginTop:20}}>
              <View style={{backgroundColor:"#0A1931", width:40, height:40, borderRadius:12, justifyContent:"center", alignItems:"center"}}><Ionicons name="refresh" size={20} color="white"/></View>
              <View style={{marginLeft:12}}><Text style={{fontWeight:"800"}}>Refresh Jobs</Text><Text style={{fontSize:11, color:"#64748b"}}>Pull latest status</Text></View>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>{setMenuOpen(false); Linking.openURL(ADMIN_WHATSAPP);}} style={{flexDirection:"row", alignItems:"center", backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:14, marginTop:10}}>
              <View style={{backgroundColor:"#25D366", width:40, height:40, borderRadius:12, justifyContent:"center", alignItems:"center"}}><Ionicons name="logo-whatsapp" size={20} color="white"/></View>
              <View style={{marginLeft:12}}><Text style={{fontWeight:"800"}}>WhatsApp Admin</Text><Text style={{fontSize:11, color:"#64748b"}}>{ADMIN_DISPLAY}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={{flexDirection:"row", alignItems:"center", backgroundColor:"#fef2f2", padding:14, borderRadius:14, marginTop:16, borderWidth:1, borderColor:"#fecaca"}}>
              <View style={{backgroundColor:"#ef4444", width:40, height:40, borderRadius:12, justifyContent:"center", alignItems:"center"}}><Ionicons name="log-out-outline" size={20} color="white"/></View>
              <View style={{marginLeft:12}}><Text style={{fontWeight:"800", color:"#dc2626"}}>Logout</Text><Text style={{fontSize:11, color:"#f87171"}}>Sign out</Text></View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPaySuccess} transparent animationType="fade">
        <View style={{flex:1, backgroundColor:"#00000088", justifyContent:"center", padding:20}}>
          <View style={{backgroundColor:"white", borderRadius:20, padding:24, alignItems:"center"}}>
            <View style={{backgroundColor:"#dcfce7", width:70, height:70, borderRadius:35, justifyContent:"center", alignItems:"center"}}><Ionicons name="checkmark" size={40} color="#16a34a"/></View>
            <Text style={{fontSize:22, fontWeight:"900", marginTop:16, color:"#0A1931"}}>Payment Successful</Text>
            <Text style={{textAlign:"center", color:"#64748b", marginTop:8, fontSize:13}}>KES {lastPaidJob?.effectiveTotal?.toLocaleString()} confirmed.</Text>
            <TouchableOpacity onPress={()=>{ const j=jobs.find(x=>x.id===lastPaidJob?.id) || lastPaidJob; if(j) downloadReceipt(j); }} style={{backgroundColor:"#0ABAB5", width:"100%", padding:16, borderRadius:12, marginTop:20, flexDirection:"row", justifyContent:"center", alignItems:"center", gap:8}}><Ionicons name="download-outline" size={18} color="white"/><Text style={{color:"white", fontWeight:"800"}}>Download Receipt</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{ setShowPaySuccess(false); router.push("/(customer)" as any); }} style={{backgroundColor:"#0A1931", width:"100%", padding:16, borderRadius:12, marginTop:10}}><Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Go Home</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}