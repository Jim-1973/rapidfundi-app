import { View, Text, TouchableOpacity, Alert } from "react-native";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ReceiptData, ReceiptRole, generateReceiptHTML, generatePlumberPayoutHTML } from "../../lib/receipts";
import { Ionicons } from "@expo/vector-icons";

const getHtml = (r: ReceiptData, role: ReceiptRole) => {
  const date = new Date(r.created_at || Date.now()).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
  const isPlumber = role === 'plumber';

  if(isPlumber){
    return generatePlumberPayoutHTML({
      receiptNumber: r.receipt_number,
      jobNumber: r.job_number,
      date,
      plumberName: (r as any).plumbers?.name || '',
      building: r.building_name || (r as any).jobs?.building_name || '',
      estate: r.estate || (r as any).jobs?.estate || '',
      category: (r as any).category || 'Plumbing',
      labour: r.labour,
      plumber_share: r.plumber_share,
      total: r.total,
      status: r.status,
    });
  }

  // Customer & Admin - professional
  return generateReceiptHTML({
    receiptNumber: r.receipt_number,
    jobNumber: r.job_number,
    date,
    building: r.building_name || (r as any).jobs?.building_name || '',
    estate: r.estate || (r as any).jobs?.estate || '',
    category: (r as any).category || 'Plumbing',
    labour: r.labour,
    materials_cost: r.materials_cost,
    materials_list: r.materials_list,
    total: r.total,
    amount: r.total,
  });
};

export default function ReceiptView({ receipt, role = 'customer' }: { receipt: ReceiptData, role: ReceiptRole }) {
  const print = async () => {
    try{
      const html = getHtml(receipt, role);
      const { uri } = await Print.printToFileAsync({ html });
      if(await Sharing.isAvailableAsync()){
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: receipt.receipt_number });
      } else {
        await Print.printAsync({ html });
      }
    }catch(e:any){ Alert.alert("Failed", e.message); }
  };

  const isPlumber = role === 'plumber';
  const payout = receipt.plumber_share;
  const labour = receipt.labour;

  return (
    <View style={{ backgroundColor:"white", borderRadius:20, borderWidth:1, borderColor:"#e2e8f0", overflow:"hidden" }}>
      {/* HEADER */}
      <View style={{ backgroundColor:"#0A1931", padding:16, flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
        <View>
          <Text style={{ color:"white", fontWeight:"900", fontSize:18 }}>RapidFundi</Text>
          <Text style={{ color:"#94a3b8", fontSize:10, marginTop:2 }}>{isPlumber ? "PLUMBER PAYMENT CLAIM" : "Professional Plumbing Services"}</Text>
        </View>
        <View style={{ backgroundColor: receipt.status==='PAID' ? "#22c55e" : "#f59e0b", paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}>
          <Text style={{ color:"white", fontSize:10, fontWeight:"900" }}>{receipt.status==='UNPAID' && isPlumber ? '⏳ UNPAID CLAIM' : receipt.status}</Text>
        </View>
      </View>

      {/* META */}
      <View style={{ padding:16 }}>
        <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
          <View><Text style={{ fontSize:11, color:"#94a3b8" }}>Receipt No</Text><Text style={{ fontSize:12, fontWeight:"800", marginTop:2 }}>{receipt.receipt_number}</Text></View>
          <View style={{ alignItems:"flex-end" }}><Text style={{ fontSize:11, color:"#94a3b8" }}>Job No</Text><Text style={{ fontSize:12, fontWeight:"800", marginTop:2 }}>{receipt.job_number}</Text></View>
        </View>

        <View style={{ backgroundColor:"#f8fafc", borderRadius:12, padding:12, marginTop:14, borderWidth:1, borderColor:"#e2e8f0" }}>
          <Text style={{ fontSize:10, fontWeight:"800", color:"#94a3b8", letterSpacing:1 }}>JOB DETAILS</Text>
          <Text style={{ fontSize:12, marginTop:6 }} numberOfLines={1}>{receipt.building_name || (receipt as any).jobs?.building_name || ''} • {receipt.estate || (receipt as any).jobs?.estate || ''}</Text>
          {receipt.materials_list ? <Text style={{ fontSize:11, color:"#475569", marginTop:4 }} numberOfLines={2}>Materials: {receipt.materials_list}</Text> : null}
        </View>

        {isPlumber ? (
          <View style={{ backgroundColor:"#f0fdfa", borderRadius:14, padding:14, marginTop:14, borderWidth:1, borderColor:"#99f6e0" }}>
            <Text style={{ fontSize:10, fontWeight:"900", letterSpacing:1, color:"#0A1931" }}>EARNINGS - 50% OF LABOUR</Text>
            <View style={{ marginTop:10, gap:6 }}>
              <View style={{ flexDirection:"row", justifyContent:"space-between" }}><Text style={{ fontSize:12, color:"#475569" }}>Labour Charged</Text><Text style={{ fontSize:12, fontWeight:"700" }}>KES {labour.toLocaleString()}</Text></View>
              <View style={{ flexDirection:"row", justifyContent:"space-between" }}><Text style={{ fontSize:12, color:"#475569" }}>Company Cut (50%)</Text><Text style={{ fontSize:12 }}>KES {(labour - payout).toLocaleString()}</Text></View>
              <View style={{ flexDirection:"row", justifyContent:"space-between", borderTopWidth:1, borderTopColor:"#0A1931", paddingTop:8, marginTop:4 }}><Text style={{ fontWeight:"900", fontSize:13 }}>YOUR PAYOUT</Text><Text style={{ fontWeight:"900", fontSize:18, color:"#0A1931" }}>KES {payout.toLocaleString()}</Text></View>
            </View>
            <View style={{ backgroundColor: receipt.status==='PAID' ? "#dcfce7" : "#fef3c7", padding:10, borderRadius:10, marginTop:12, alignItems:"center" }}>
              <Text style={{ fontWeight:"800", fontSize:12, color: receipt.status==='PAID' ? "#166534" : "#92400e" }}>{receipt.status==='PAID' ? '✅ Paid - Check M-Pesa' : '⏳ Unpaid - Claim for payout end of day'}</Text>
            </View>
            <Text style={{ fontSize:10, color:"#64748b", marginTop:8, textAlign:"center" }}>This document is a valid claim for payment. Present to admin with ID.</Text>
          </View>
        ) : (
          <View style={{ marginTop:14, gap:8 }}>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}><Text style={{ fontSize:12, color:"#64748b" }}>Labour</Text><Text style={{ fontSize:12, fontWeight:"700" }}>KES {receipt.labour.toLocaleString()}</Text></View>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}><Text style={{ fontSize:12, color:"#64748b" }}>Materials</Text><Text style={{ fontSize:12, fontWeight:"700" }}>KES {receipt.materials_cost.toLocaleString()}</Text></View>
            <View style={{ flexDirection:"row", justifyContent:"space-between", backgroundColor:"#0A1931", padding:12, borderRadius:10, marginTop:4 }}><Text style={{ color:"white", fontWeight:"900" }}>TOTAL PAID</Text><Text style={{ color:"white", fontWeight:"900" }}>KES {receipt.total.toLocaleString()}</Text></View>
          </View>
        )}

        <TouchableOpacity onPress={print} style={{ backgroundColor:"#0A1931", padding:14, borderRadius:12, marginTop:16, flexDirection:"row", justifyContent:"center", alignItems:"center", gap:8 }}>
          <Ionicons name="download" size={16} color="white"/><Text style={{ color:"white", fontWeight:"900", fontSize:12 }}>{isPlumber ? 'Download Claim PDF' : 'Download Receipt PDF'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}