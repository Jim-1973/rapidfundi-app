import { useEffect, useState } from "react";
import { ScrollView, Text, ActivityIndicator, View, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../../../lib/supabase";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function PlumberReceipts(){
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ (async()=>{
    try{
      const { data: { user } } = await supabase.auth.getUser();
      if(user){
        const { data: pl } = await supabase.from('plumbers').select('id').eq('user_id', user.id).single();
        if(pl){
          // FIX: Show both PAYOUT + FINAL so plumber sees receipt after customer pays
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
    <html><body style="font-family:sans-serif; padding:30px; color:#0A1931">
      <h1>🔧 RapidFundi - ${isPayout ? 'Payout' : 'Final Receipt'}</h1>
      <p><strong>Receipt:</strong> ${r.receipt_number}</p>
      <p><strong>Job:</strong> ${r.job_number}</p>
      <p><strong>Status:</strong> ${r.status}</p>
      <p><strong>Type:</strong> ${r.type}</p>
      <div style="background:${isPayout ? '#f0fdfa' : '#dcfce7'}; padding:20px; border-radius:12px; margin-top:20px">
        <p>Labour: KES ${r.labour?.toLocaleString()}</p>
        <p>Materials: KES ${r.materials_cost?.toLocaleString()}</p>
        <h2>${isPayout ? `Your Payout (50%): KES ${r.plumber_share?.toLocaleString()}` : `Total Paid by Customer: KES ${r.total?.toLocaleString()}`}</h2>
        <p>${r.status==='PAID' ? '✅ PAID' : '⏳ PENDING - End of day'}</p>
        ${!isPayout ? `<p style="margin-top:10px; font-size:12px; color:#16a34a">✅ Customer has paid - Job completed</p>` : ''}
      </div>
    </body></html>`;
    try{ const { uri } = await Print.printToFileAsync({ html }); if(await Sharing.isAvailableAsync()){ await Sharing.shareAsync(uri); } else { await Print.printAsync({ html }); } }catch(e:any){ Alert.alert(e.message); }
  };

  if(loading) return <View style={{flex:1, justifyContent:"center", alignItems:"center"}}><ActivityIndicator/></View>;

  return (
    <ScrollView style={{flex:1, backgroundColor:"#f1f5f9"}} contentContainerStyle={{padding:16, paddingTop:60, gap:12, paddingBottom:100}}>
      <Text style={{fontSize:22, fontWeight:"900"}}>My Receipts - After Customer Pays</Text>
      <Text style={{fontSize:12, color:"#64748b"}}>Payout = 50% Labour - Paid end of day after customer payment</Text>
      {receipts.map((r:any)=>{
        const isPayout = r.type === 'PLUMBER_PAYOUT';
        return (
        <View key={r.id} style={{backgroundColor:"white", borderRadius:16, padding:16, borderWidth:1, borderColor: isPayout ? "#e2e8f0" : "#bbf7d0"}}>
          <View style={{flexDirection:"row", justifyContent:"space-between"}}>
            <Text style={{fontWeight:"900"}}>{r.job_number} - {r.jobs?.building_name}</Text>
            <Text style={{fontSize:9, backgroundColor:"#f1f5f9", paddingHorizontal:8, paddingVertical:3, borderRadius:8, fontWeight:"800"}}>{r.type}</Text>
          </View>
          <Text style={{fontSize:10, marginTop:6, backgroundColor:r.status==='PAID' ? "#dcfce7" : "#fef3c7", alignSelf:"flex-start", paddingHorizontal:10, paddingVertical:4, borderRadius:12, fontWeight:"800"}}>{r.status==='PAID' ? '✅ PAID' : '⏳ PENDING - End of day'}</Text>
          {!isPayout && <Text style={{fontSize:11, color:"#16a34a", marginTop:6, fontWeight:"700"}}>✅ Customer Paid - KES {r.total?.toLocaleString()}</Text>}
          <Text style={{marginTop:10}}>Labour: KES {r.labour?.toLocaleString()}</Text>
          <Text style={{fontWeight:"900", fontSize:18, marginTop:6}}>{isPayout ? `Payout: KES ${r.plumber_share?.toLocaleString()} (50%)` : `Total: KES ${r.total?.toLocaleString()}`}</Text>
          <TouchableOpacity onPress={()=>printReceipt(r)} style={{backgroundColor:"#0A1931", padding:12, borderRadius:10, marginTop:12}}><Text style={{color:"white", textAlign:"center", fontWeight:"800", fontSize:12}}>📄 Print / Share PDF</Text></TouchableOpacity>
        </View>
        );
      })}
      {receipts.length===0 && <Text style={{color:"#94a3b8", textAlign:"center", marginTop:30}}>No payouts yet - Complete a job first</Text>}
    </ScrollView>
  );
}