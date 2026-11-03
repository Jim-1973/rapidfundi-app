import { useEffect, useState } from "react";
import { ScrollView, Text, ActivityIndicator, View, TouchableOpacity, Alert, Image } from "react-native";
import { supabase } from "../../../lib/supabase";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const LOGO_URL = "https://qyqaqnkxtmsrrctknhxi.supabase.co/storage/v1/object/public/public-assets/logo.png";

export default function PlumberReceipts(){
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ (async()=>{
    try{
      const { data: { user } } = await supabase.auth.getUser();
      if(user){
        const { data: pl } = await supabase.from('plumbers').select('id').eq('user_id', user.id).single();
        if(pl){
          const { data } = await supabase.from('receipts').select('*, jobs(building_name, estate)').eq('plumber_id', pl.id).in('type', ['PLUMBER_PAYOUT','FINAL']).order('created_at', {ascending: false});
          setReceipts(data||[]);
        }
      }
    }catch(e){ console.log(e); }
    finally{ setLoading(false); }
  })(); },[]);

  const printReceipt = async (r:any) => {
    const isPayout = r.type === 'PLUMBER_PAYOUT';
    const html = `
    <html>
    <head><meta charset="utf-8" /><style>
      body { font-family: -apple-system, sans-serif; padding:24px; color:#0A1931; }
      .header { display:flex; align-items:center; gap:12px; border-bottom:3px solid #0A1931; padding-bottom:16px; margin-bottom:20px; }
    </style></head>
    <body>
      <div class="header">
        <img src="${LOGO_URL}" style="width:60px; height:60px; object-fit:contain;" />
        <div>
          <h1 style="margin:0; font-weight:900;">Rapid<span style="color:#0ABAB5;">Fundi</span></h1>
          <p style="margin:0; font-size:12px; color:#64748b;">Professional Plumbing • 0722819877</p>
        </div>
        <div style="flex:1; text-align:right;">
          <h2 style="margin:0;">${isPayout ? 'PAYOUT' : 'FINAL RECEIPT'}</h2>
          <p style="margin:4px 0 0; font-size:11px; color:#64748b;">${r.receipt_number}</p>
        </div>
      </div>
      
      <p><strong>Receipt:</strong> ${r.receipt_number}</p>
      <p><strong>Job:</strong> ${r.job_number} - ${r.jobs?.building_name || ''} ${r.jobs?.estate || ''}</p>
      <p><strong>Status:</strong> ${r.status} | <strong>Type:</strong> ${r.type}</p>
      <div style="background:${isPayout ? '#f0fdfa' : '#dcfce7'}; padding:20px; border-radius:12px; margin-top:20px; border:1px solid #e2e8f0;">
        <p>Labour: KES ${r.labour?.toLocaleString()}</p>
        <p>Materials: KES ${r.materials_cost?.toLocaleString()}</p>
        <h2>${isPayout ? `Your Payout (50%): KES ${r.plumber_share?.toLocaleString()}` : `Total Paid by Customer: KES ${r.total?.toLocaleString()}`}</h2>
        <p style="background:${r.status==='PAID' ? '#dcfce7' : '#fef3c7'}; display:inline-block; padding:6px 12px; border-radius:20px; font-weight:800; font-size:12px;">${r.status==='PAID' ? '✅ PAID' : '⏳ PENDING - End of day'}</p>
        ${!isPayout ? `<p style="margin-top:10px; font-size:12px; color:#16a34a; font-weight:700">✅ Customer has paid - Job completed</p>` : ''}
      </div>
      <div style="margin-top:24px; text-align:center; border-top:1px solid #e2e8f0; padding-top:12px;">
        <p style="font-size:11px; color:#94a3b8;">Thank you for working with RapidFundi • 0722819877</p>
        <p style="font-size:10px; color:#94a3b8;">${r.receipt_number} • Generated on ${new Date().toLocaleString('en-KE')}</p>
      </div>
    </body></html>`;
    try{ const { uri } = await Print.printToFileAsync({ html }); if(await Sharing.isAvailableAsync()){ await Sharing.shareAsync(uri); } else { await Print.printAsync({ html }); } }catch(e:any){ Alert.alert(e.message); }
  };

  if(loading) return <View style={{flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"white"}}><Image source={{uri: LOGO_URL}} style={{width:60, height:60, resizeMode:'contain', marginBottom:12}} /><ActivityIndicator color="#0ABAB5" /></View>;

  return (
    <ScrollView style={{flex:1, backgroundColor:"#f1f5f9"}} contentContainerStyle={{padding:16, paddingTop:16, gap:12, paddingBottom:100}}>
      {/* LOGO HEADER */}
      <View style={{flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'white', padding:12, borderRadius:16, borderWidth:1, borderColor:'#e2e8f0', marginBottom:4}}>
        <Image source={{uri: LOGO_URL}} style={{width:40, height:40, resizeMode:'contain'}} />
        <View style={{flex:1}}>
          <Text style={{fontWeight:'900', fontSize:16, color:'#0A1931'}}>Rapid<Text style={{color:'#0ABAB5'}}>Fundi</Text></Text>
          <Text style={{fontSize:11, color:'#64748b', fontWeight:'600'}}>Plumber Receipts</Text>
        </View>
        <View style={{backgroundColor:'#f1f5f9', paddingHorizontal:10, paddingVertical:6, borderRadius:20}}>
          <Text style={{fontSize:11, fontWeight:'800', color:'#0A1931'}}>{receipts.length} receipts</Text>
        </View>
      </View>

      <Text style={{fontSize:18, fontWeight:"900", color:"#0A1931", marginTop:8}}>My Receipts - After Customer Pays</Text>
      <Text style={{fontSize:11, color:"#64748b", marginBottom:4}}>Payout = 50% Labour - Paid end of day after customer payment</Text>
      {receipts.map((r:any)=>{
        const isPayout = r.type === 'PLUMBER_PAYOUT';
        return (
        <View key={r.id} style={{backgroundColor:"white", borderRadius:16, padding:16, borderWidth:1, borderColor: isPayout ? "#e2e8f0" : "#bbf7d0"}}>
          <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:'center'}}>
            <View style={{flexDirection:'row', alignItems:'center', gap:8, flex:1}}>
              <Image source={{uri: LOGO_URL}} style={{width:20, height:20, resizeMode:'contain'}} />
              <Text style={{fontWeight:"900", flex:1}}>{r.job_number} - {r.jobs?.building_name}</Text>
            </View>
            <Text style={{fontSize:9, backgroundColor:"#f1f5f9", paddingHorizontal:8, paddingVertical:3, borderRadius:8, fontWeight:"800"}}>{r.type}</Text>
          </View>
          <Text style={{fontSize:10, marginTop:6, backgroundColor:r.status==='PAID' ? "#dcfce7" : "#fef3c7", alignSelf:"flex-start", paddingHorizontal:10, paddingVertical:4, borderRadius:12, fontWeight:"800"}}>{r.status==='PAID' ? '✅ PAID' : '⏳ PENDING - End of day'}</Text>
          {!isPayout && <Text style={{fontSize:11, color:"#16a34a", marginTop:6, fontWeight:"700"}}>✅ Customer Paid - KES {r.total?.toLocaleString()}</Text>}
          <Text style={{marginTop:10, fontSize:13, color:'#64748b'}}>Labour: KES {r.labour?.toLocaleString()}</Text>
          <Text style={{fontWeight:"900", fontSize:18, marginTop:6, color:"#0A1931"}}>{isPayout ? `Payout: KES ${r.plumber_share?.toLocaleString()} (50%)` : `Total: KES ${r.total?.toLocaleString()}`}</Text>
          <TouchableOpacity onPress={()=>printReceipt(r)} style={{backgroundColor:"#0A1931", padding:12, borderRadius:10, marginTop:12, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:6}}><Text style={{color:"white", textAlign:"center", fontWeight:"800", fontSize:12}}>📄 Print / Share PDF with Logo</Text></TouchableOpacity>
        </View>
        );
      })}
      {receipts.length===0 && <View style={{alignItems:'center', marginTop:40}}><Image source={{uri: LOGO_URL}} style={{width:60, height:60, resizeMode:'contain', opacity:0.5, marginBottom:12}} /><Text style={{color:"#94a3b8", textAlign:"center"}}>No payouts yet - Complete a job first</Text></View>}
    </ScrollView>
  );
}