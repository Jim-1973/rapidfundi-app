import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, TextInput, Modal, ActivityIndicator, Linking, Platform, RefreshControl } from "react-native";
import { supabase, toEAT } from "../../../lib/supabase";
import { payWithMpesa } from "../../../lib/mpesa";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from 'expo-location';

let MapView:any=null, Marker:any=null, UrlTile:any=null;
if(Platform.OS!=='web'){ try{ const M=require('react-native-maps'); MapView=M.default; Marker=M.Marker; UrlTile=M.UrlTile; }catch{} }

const safeDate=(d:any)=>{ try{ const dt=new Date(d); return isNaN(dt.getTime())?"—":dt.toLocaleString("en-KE",{timeZone:"Africa/Nairobi"});}catch{return "—";} };
const getDistanceKm=(a:number,b:number,c:number,d:number)=>{ const R=6371, dLa=(c-a)*Math.PI/180, dLo=(d-b)*Math.PI/180, e=Math.sin(dLa/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dLo/2)**2; return R*2*Math.atan2(Math.sqrt(e),Math.sqrt(1-e)); };

export default function MyJobs(){
  const router=useRouter();
  const [jobs,setJobs]=useState<any[]>([]);
  const [media,setMedia]=useState<Record<string,any[]>>({});
  const [showPay,setShowPay]=useState(false);
  const [payJob,setPayJob]=useState<any>(null);
  const [mpesaPhone,setMpesaPhone]=useState("");
  const [loadingPay,setLoadingPay]=useState(false);
  const [payingJobId,setPayingJobId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [isLive,setIsLive]=useState(false);
  const [lastUpdate,setLastUpdate]=useState("");
  const [userId,setUserId]=useState<string|null>(null);
  const [showDecline,setShowDecline]=useState(false);
  const [declineReason,setDeclineReason]=useState("");
  const [declineJob,setDeclineJob]=useState<any>(null);
  const [declineQ,setDeclineQ]=useState<any>(null);
  const [approvingId,setApprovingId]=useState<string|null>(null);
  const [showPlumberModal,setShowPlumberModal]=useState(false);
  const [activePlumberJob,setActivePlumberJob]=useState<any>(null);
  const [customerLoc,setCustomerLoc]=useState<any>(null);

  const getStatusUI=(status:string,payment_status?:string)=>{
    if(status==='completed_awaiting_payment') return {text:"Awaiting Payment",icon:"card" as const,bg:"#fef3c7",color:"#92400e"};
    if(status==='paid'||payment_status==='PAID') return {text:"Paid",icon:"checkmark-done" as const,bg:"#dcfce7",color:"#166534"};
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
      const {data:myJobs,error}=await supabase.from('jobs').select('*').eq('customer_id',user.id).order('created_at',{ascending:false});
      if(error) throw error;
      let enriched=myJobs||[];
      for(let i=0;i<enriched.length;i++){
        const job=enriched[i];
        try{ const {data}=await supabase.from('quotations').select('*').eq('job_id',job.id).order('created_at',{ascending:false}); if(data?.length) enriched[i].quotations=data; }catch{}
        try{ if(job.assigned_plumber_id){ const {data}=await supabase.from('plumbers').select('name,plumber_number,phone').eq('id',job.assigned_plumber_id).single(); if(data) enriched[i].plumbers=data; } }catch{}
      }
      setJobs(enriched);
      if(enriched.length){
        const newMedia:Record<string,any[]>={};
        for(const j of enriched){
          try{
            const {data}=await supabase.from('job_media').select('*').eq('job_id',j.id).order('created_at',{ascending:true});
            if(data){ newMedia[j.id]=data.map((item:any)=>{ if(!item.url||item.url.startsWith('http')) return item; const {data}=supabase.storage.from('job-evidence').getPublicUrl(item.url); return {...item,url:data.publicUrl}; }); }
          }catch{}
        }
        setMedia(newMedia);
      }
    }catch(e:any){ console.log(e); }
    finally{ setLoading(false); setRefreshing(false); setLastUpdate(new Date().toLocaleTimeString("en-KE",{timeZone:"Africa/Nairobi"})); }
  };

  const onRefresh=()=>{ setRefreshing(true); fetchJobs(); };
  useFocusEffect(useCallback(()=>{ fetchJobs(); (async()=>{ try{ const {status}=await Location.requestForegroundPermissionsAsync(); if(status==='granted'){ const loc=await Location.getCurrentPositionAsync({}); setCustomerLoc(loc.coords); } }catch{} })(); },[]));

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

  // FIXED: NO BLINK - NO INTERVAL, DEBOUNCED
  const processMpesaPayment=async()=>{
    if(!payJob||payingJobId) return;
    const digits=mpesaPhone.replace(/\D/g,"");
    if(digits.length<9){ Alert.alert("Invalid","Enter valid M-Pesa number e.g. 0712345678"); return; }
    setPayingJobId(payJob.id); setLoadingPay(true);
    try{
      let f=mpesaPhone.replace(/\s/g,"").replace(/^0/,"254").replace(/^\+/,"");
      if(f.match(/^7/)||f.match(/^1/)) f="254"+f;
      if(!f.startsWith("254")) f="254"+digits.slice(-9);
      await payWithMpesa(payJob.id,f,payJob.effectiveTotal);
      setShowPay(false);
      Alert.alert("Payment Sent","M-Pesa prompt sent to "+mpesaPhone+". Enter PIN on phone. KES "+payJob.effectiveTotal.toLocaleString(),[{text:"OK",onPress:()=>setTimeout(()=>fetchJobs(),2000)}]);
    }catch(e:any){
      let msg=e.message||"Failed";
      if(msg.toLowerCase().includes("non-2xx")) msg="Payment service temporarily unavailable. Please try again.";
      Alert.alert("Error",msg);
    }finally{ setLoadingPay(false); setPayingJobId(null); }
  };

  return (
    <View style={{flex:1,backgroundColor:"#f8fafc"}}>
    <ScrollView style={{flex:1}} contentContainerStyle={{padding:16,paddingTop:12,paddingBottom:30}} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A1931" />}>
      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <View><Text style={{fontWeight:"900",fontSize:20,color:"#0A1931"}}>My Jobs</Text><Text style={{fontSize:11,color:"#64748b",marginTop:2}}>{jobs.length} jobs • {lastUpdate} EAT</Text></View>
        <View style={{flexDirection:"row",gap:8,alignItems:"center"}}>
          {isLive&&<View style={{flexDirection:"row",alignItems:"center",backgroundColor:"#dcfce7",paddingHorizontal:8,paddingVertical:4,borderRadius:12,gap:4}}><View style={{width:6,height:6,borderRadius:3,backgroundColor:"#22c55e"}}/><Text style={{fontSize:10,fontWeight:"800",color:"#166534"}}>LIVE</Text></View>}
          <TouchableOpacity onPress={onRefresh} style={{backgroundColor:"white",width:36,height:36,borderRadius:12,justifyContent:"center",alignItems:"center",borderWidth:1,borderColor:"#e2e8f0"}}><Ionicons name="refresh" size={16} color="#0A1931"/></TouchableOpacity>
        </View>
      </View>

      {loading&&<View style={{marginTop:40,alignItems:"center"}}><ActivityIndicator color="#0A1931"/><Text style={{marginTop:8,color:"#64748b",fontSize:12}}>Loading...</Text></View>}

      <View style={{gap:12}}>
        {jobs.map((job)=>{
          const allQs=(job.quotations||[]).sort((a:any,b:any)=> new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
          const qLatest=allQs[0];
          const effectiveTotal=Number(job.total_amount||0)>0?Number(job.total_amount):Number(qLatest?.total||0);
          const s=getStatusUI(job.status,job.payment_status);
          const jobMedia=media[job.id]||[];
          const isPaid=job.status==='paid'||job.payment_status==='PAID';
          const isAwaiting=job.status==='completed_awaiting_payment';
          const plumber=job.plumbers;
          return (
            <View key={job.id} style={{backgroundColor:"white",borderRadius:20,borderWidth:1,borderColor:isAwaiting?"#f59e0b":"#e2e8f0",overflow:"hidden"}}>
              <View style={{padding:16}}>
                <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
                  <View style={{flexDirection:"row",alignItems:"center",gap:8}}><View style={{backgroundColor:"#f1f5f9",paddingHorizontal:8,paddingVertical:4,borderRadius:8}}><Text style={{fontWeight:"800",fontSize:11,color:"#0A1931"}}>{job.job_number}</Text></View><Text style={{fontSize:11,color:"#94a3b8"}}>{safeDate(job.created_at).split(',')[0]}</Text></View>
                  <View style={{flexDirection:"row",alignItems:"center",gap:4,backgroundColor:s.bg,paddingHorizontal:10,paddingVertical:5,borderRadius:20}}><Ionicons name={s.icon} size={12} color={s.color}/><Text style={{fontSize:10,fontWeight:"800",color:s.color}}>{s.text}</Text></View>
                </View>
                <Text style={{marginTop:10,fontWeight:"800",fontSize:15,color:"#0A1931"}}>{job.category} • {job.building_name}</Text>
                <View style={{flexDirection:"row",alignItems:"center",gap:4,marginTop:4}}><Ionicons name="location-outline" size={12} color="#94a3b8"/><Text style={{fontSize:12,color:"#64748b"}}>{job.estate} {job.street? "• "+job.street:""}</Text></View>

                {isAwaiting&&(
                  <View style={{marginTop:14,backgroundColor:"#f8fafc",borderRadius:16,borderWidth:1,borderColor:"#e2e8f0",overflow:"hidden"}}>
                    <View style={{flexDirection:"row",padding:12,gap:12,alignItems:"center"}}>
                      {job.final_photo_url||jobMedia.find((m:any)=>m.type==='completion_final')? <Image source={{uri:job.final_photo_url||jobMedia.find((m:any)=>m.type==='completion_final')?.url}} style={{width:64,height:64,borderRadius:12}}/> : <View style={{width:64,height:64,borderRadius:12,backgroundColor:"#dcfce7",justifyContent:"center",alignItems:"center"}}><Ionicons name="checkmark" size={24} color="#16a34a"/></View>}
                      <View style={{flex:1}}><Text style={{fontWeight:"800",color:"#0A1931",fontSize:13}}>Work completed</Text><Text style={{fontSize:11,color:"#64748b",marginTop:2}}>{toEAT(job.completed_at)} EAT</Text><Text style={{fontSize:12,color:"#0A1931",marginTop:2,fontWeight:"700"}}>KES {effectiveTotal.toLocaleString()}</Text></View>
                    </View>
                    <View style={{padding:12,paddingTop:0}}>
                      <TouchableOpacity onPress={()=>openMpesaPay(job,effectiveTotal)} style={{backgroundColor:"#0A1931",padding:14,borderRadius:12,alignItems:"center"}}><Text style={{color:"white",fontWeight:"800",fontSize:14}}>Pay via M-Pesa</Text></TouchableOpacity>
                      <Text style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:6}}>Secured by M-Pesa</Text>
                    </View>
                  </View>
                )}

                {isPaid&&(
                  <View style={{marginTop:14,backgroundColor:"#f0fdf4",borderRadius:12,padding:12,flexDirection:"row",gap:10,alignItems:"center"}}><View style={{width:32,height:32,borderRadius:16,backgroundColor:"#dcfce7",justifyContent:"center",alignItems:"center"}}><Ionicons name="checkmark" size={16} color="#16a34a"/></View><View style={{flex:1}}><Text style={{fontWeight:"800",color:"#166534",fontSize:12}}>Payment Confirmed</Text><Text style={{fontSize:11,color:"#15803d"}}>{toEAT(job.paid_at)} EAT</Text></View><Text style={{fontWeight:"800",fontSize:12,color:"#166534"}}>KES {effectiveTotal.toLocaleString()}</Text></View>
                )}

                {effectiveTotal>0&&!isAwaiting&&!isPaid&&qLatest&&(
                  <View style={{marginTop:12,backgroundColor:"white",borderRadius:12,borderWidth:1,borderColor:"#e2e8f0",padding:12}}>
                    <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text style={{fontWeight:"900",fontSize:16,color:"#0A1931"}}>KES {effectiveTotal.toLocaleString()}</Text><Text style={{fontSize:10,fontWeight:"700",color:"#5b21b6",backgroundColor:"#ede9fe",paddingHorizontal:8,paddingVertical:4,borderRadius:8}}>{qLatest.status}</Text></View>
                    {(qLatest?.status==='PENDING'||job.status==='QUOTATION_PREPARED')&&(
                      <View style={{flexDirection:"row",gap:8,marginTop:10}}>
                        <TouchableOpacity onPress={()=>approve(job,qLatest,effectiveTotal)} disabled={!!approvingId} style={{flex:1,backgroundColor:approvingId?"#94a3b8":"#0A1931",padding:12,borderRadius:10,flexDirection:"row",justifyContent:"center",gap:6,alignItems:"center"}}>{approvingId===job.id?<ActivityIndicator color="white" size="small"/>:<Ionicons name="checkmark" size={16} color="white"/>}<Text style={{color:"white",fontWeight:"800",fontSize:13}}>{approvingId===job.id?"Processing...":"Approve"}</Text></TouchableOpacity>
                        <TouchableOpacity onPress={()=>{ setDeclineJob(job); setDeclineQ(qLatest); setShowDecline(true); }} style={{paddingHorizontal:16,paddingVertical:12,borderRadius:10,borderWidth:1,borderColor:"#e2e8f0"}}><Text style={{fontWeight:"700",fontSize:13,color:"#64748b"}}>Decline</Text></TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          )
        })}
      </View>

      <Modal visible={showPay} transparent animationType="slide">
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"flex-end"}}>
          <View style={{backgroundColor:"white",padding:24,borderTopLeftRadius:24,borderTopRightRadius:24,paddingBottom:40}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text style={{fontSize:18,fontWeight:"900",color:"#0A1931"}}>Confirm Payment</Text><TouchableOpacity onPress={()=>setShowPay(false)} style={{width:32,height:32,borderRadius:16,backgroundColor:"#f1f5f9",justifyContent:"center",alignItems:"center"}}><Ionicons name="close" size={18} color="#0A1931"/></TouchableOpacity></View>
            <View style={{backgroundColor:"#f8fafc",borderRadius:16,padding:16,marginTop:16,borderWidth:1,borderColor:"#e2e8f0"}}>
              <Text style={{fontSize:10,fontWeight:"800",color:"#94a3b8"}}>JOB REFERENCE</Text><Text style={{fontWeight:"800",marginTop:4,fontSize:14,color:"#0A1931"}}>{payJob?.job_number} • {payJob?.category}</Text>
              <View style={{flexDirection:"row",justifyContent:"space-between",marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:"#e2e8f0"}}><Text style={{fontSize:13,color:"#64748b"}}>Amount Due</Text><Text style={{fontWeight:"900",fontSize:18,color:"#0A1931"}}>KES {payJob?.effectiveTotal?.toLocaleString()}</Text></View>
            </View>
            <View style={{marginTop:20}}><Text style={{fontSize:12,fontWeight:"800",color:"#0A1931",marginBottom:8}}>M-Pesa Phone</Text><TextInput value={mpesaPhone} onChangeText={setMpesaPhone} keyboardType="phone-pad" placeholder="0712 345 678" placeholderTextColor="#94a3b8" style={{borderWidth:1.5,borderColor:"#e2e8f0",borderRadius:12,padding:14,fontSize:15,fontWeight:"600",color:"#0A1931"}}/></View>
            <TouchableOpacity onPress={processMpesaPayment} disabled={loadingPay} activeOpacity={0.8} style={{backgroundColor:loadingPay?"#94a3b8":"#0A1931",padding:16,borderRadius:14,marginTop:20,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:8,opacity:loadingPay?0.8:1}}>
              {loadingPay? <View style={{flexDirection:"row",alignItems:"center",gap:8}}><ActivityIndicator color="white" size="small"/><Text style={{color:"white",fontWeight:"800"}}>Sending...</Text></View> : <><Ionicons name="shield-checkmark" size={18} color="white"/><Text style={{color:"white",fontWeight:"900",fontSize:14}}>Pay via M-Pesa</Text></>}
            </TouchableOpacity>
            <Text style={{fontSize:11,color:"#94a3b8",textAlign:"center",marginTop:12}}>Secured by M-Pesa • STK push to your phone</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  )
}
