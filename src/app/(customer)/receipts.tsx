import { useEffect, useState } from "react";
import { ScrollView, Text, ActivityIndicator, View, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../../../lib/supabase";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function CustomerReceipts(){
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ (async()=>{
    try{
      const { data: { user } } = await supabase.auth.getUser();
      if(user){
        const { data } = await supabase.from('receipts').select('*').eq('customer_id', user.id).in('type', ['QUOTATION','FINAL']).order('created_at', {ascending: false});
        setReceipts(data||[]);
      }
    }catch(e){ console.log(e); }
    finally{ setLoading(false); }
  })(); },[]);

  const printReceipt = async (r:any) => {
    try{
      const html = `
      <html><body style="font-family:sans-serif; padding:30px; color:#0A1931">
        <div style="text-align:center; border-bottom:3px solid #0A1931; padding-bottom:20px">
          <h1>🔧 RapidFundi</h1>
          <p style="background:${r.status==='PAID' ? '#dcfce7' : '#fef3c7'}; display:inline-block; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:800">${r.status} - ${r.type}</p>
        </div>
        <p><strong>Receipt No:</strong> ${r.receipt_number}</p>
        <p><strong>Job No:</strong> ${r.job_number}</p>
        <p><strong>Date:</strong> ${new Date(r.created_at).toLocaleString()}</p>
        <p><strong>Materials:</strong> ${r.materials_list||'-'}</p>
        <table style="width:100%; margin-top:20px; border-collapse:collapse">
          <tr style="background:#f8fafc"><td style="padding:12px; border:1px solid #e2e8f0">Labour</td><td style="padding:12px; border:1px solid #e2e8f0; text-align:right">KES ${r.labour?.toLocaleString()}</td></tr>
          <tr><td style="padding:12px; border:1px solid #e2e8f0">Materials</td><td style="padding:12px; border:1px solid #e2e8f0; text-align:right">KES ${r.materials_cost?.toLocaleString()}</td></tr>
          <tr style="background:#0A1931; color:white; font-weight:900"><td style="padding:14px">TOTAL</td><td style="padding:14px; text-align:right">KES ${r.total?.toLocaleString()}</td></tr>
        </table>
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if(await Sharing.isAvailableAsync()){ await Sharing.shareAsync(uri); } else { await Print.printAsync({ html }); }
    }catch(e:any){ Alert.alert("Failed", e.message); }
  };

  if(loading) return <View style={{flex:1, justifyContent:"center", alignItems:"center"}}><ActivityIndicator/></View>;

  return (
    <ScrollView style={{flex:1, backgroundColor:"#f1f5f9"}} contentContainerStyle={{padding:16, paddingTop:60, gap:12, paddingBottom:100}}>
      <Text style={{fontSize:22, fontWeight:"900", color:"#0A1931"}}>My Receipts</Text>
      {receipts.map((r:any)=>(
        <View key={r.id} style={{backgroundColor:"white", borderRadius:16, padding:16, borderWidth:1, borderColor:"#e2e8f0"}}>
          <View style={{flexDirection:"row", justifyContent:"space-between"}}><Text style={{fontWeight:"900"}}>🔧 RapidFundi</Text><Text style={{backgroundColor:r.status==='PAID' ? "#dcfce7" : "#fef3c7", paddingHorizontal:10, paddingVertical:4, borderRadius:12, fontSize:10, fontWeight:"800"}}>{r.status}</Text></View>
          <Text style={{fontSize:12, color:"#64748b", marginTop:6}}>{r.receipt_number} • {r.job_number}</Text>
          <Text style={{marginTop:10, fontSize:12}}>{r.materials_list}</Text>
          <View style={{flexDirection:"row", justifyContent:"space-between", marginTop:10}}><Text>Labour</Text><Text>KES {r.labour?.toLocaleString()}</Text></View>
          <View style={{flexDirection:"row", justifyContent:"space-between", marginTop:6}}><Text>Materials</Text><Text>KES {r.materials_cost?.toLocaleString()}</Text></View>
          <View style={{flexDirection:"row", justifyContent:"space-between", marginTop:10, borderTopWidth:1, borderColor:"#f1f5f9", paddingTop:10}}><Text style={{fontWeight:"900"}}>TOTAL</Text><Text style={{fontWeight:"900"}}>KES {r.total?.toLocaleString()}</Text></View>
          <TouchableOpacity onPress={()=>printReceipt(r)} style={{backgroundColor:"#0A1931", padding:12, borderRadius:10, marginTop:12}}><Text style={{color:"white", textAlign:"center", fontWeight:"800", fontSize:12}}>📄 Print / Share PDF</Text></TouchableOpacity>
        </View>
      ))}
      {receipts.length===0 && <Text style={{color:"#94a3b8", textAlign:"center", marginTop:30}}>No receipts yet</Text>}
    </ScrollView>
  );
}