import { View, Text, TouchableOpacity, Alert } from "react-native";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ReceiptData, ReceiptRole } from "../lib/receipts";

const getHtml = (r: ReceiptData, role: ReceiptRole) => {
  const date = new Date(r.created_at || Date.now()).toLocaleString();
  const isPlumber = role === 'plumber';

  if(isPlumber){
    const statusLabel = r.status === 'PAID' ? 'PAID' : 'PENDING - End of Day Payout';
    const statusColor = r.status === 'PAID' ? '#dcfce7' : '#fef3c7';
    return `
    <html><body style="font-family: sans-serif; padding: 30px; color: #0A1931">
      <div style="text-align:center; border-bottom: 3px solid #0A1931; padding-bottom: 20px">
        <h1 style="margin:0">🔧 RapidFundi</h1>
        <p style="color:#0ABAB5; font-weight:700">Plumber Payout Receipt</p>
        <p style="background:${statusColor}; display:inline-block; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:800">${statusLabel}</p>
      </div>
      <div style="margin-top:20px">
        <p><strong>Receipt No:</strong> ${r.receipt_number}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Job No:</strong> ${r.job_number}</p>
        <p><strong>Location:</strong> ${r.building_name || ''} ${r.estate || ''}</p>
      </div>
      <div style="background:#f0fdfa; padding:20px; border-radius:12px; margin-top:20px; border:1px solid #0ABAB5">
        <p>Labour Charge: KES ${r.labour.toLocaleString()}</p>
        <h2 style="color:#0A1931">Your Payout (50%): KES ${r.plumber_share.toLocaleString()}</h2>
        <p style="font-size:12px; color:#64748b">${r.status === 'PAID' ? 'Paid - Check M-Pesa' : 'You will be paid at end of day'}</p>
      </div>
      <p style="text-align:center; margin-top:40px; color:#94a3b8; font-size:11px">Thank you for working with RapidFundi</p>
    </body></html>`;
  }

  // Customer & Admin
  const isAdmin = role === 'admin';
  return `
  <html><body style="font-family: sans-serif; padding: 30px; color: #0A1931">
    <div style="text-align:center; border-bottom: 3px solid #0A1931; padding-bottom: 20px">
      <h1 style="margin:0">🔧 RapidFundi</h1>
      <p style="color:#64748b">Professional Plumbing Services</p>
      <p style="background:${r.status==='PAID' ? '#dcfce7' : '#fef3c7'}; display:inline-block; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:800">${r.status} - ${r.type}</p>
    </div>
    <div style="margin-top:20px">
      <p><strong>Receipt No:</strong> ${r.receipt_number}</p>
      <p><strong>Job No:</strong> ${r.job_number}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Location:</strong> ${r.building_name || ''}, ${r.estate || ''}</p>
      <p><strong>Materials:</strong> ${r.materials_list || '-'}</p>
    </div>
    <table style="width:100%; margin-top:20px; border-collapse:collapse">
      <tr style="background:#f8fafc"><td style="padding:12px; border:1px solid #e2e8f0">Labour</td><td style="padding:12px; border:1px solid #e2e8f0; text-align:right">KES ${r.labour.toLocaleString()}</td></tr>
      <tr><td style="padding:12px; border:1px solid #e2e8f0">Materials</td><td style="padding:12px; border:1px solid #e2e8f0; text-align:right">KES ${r.materials_cost.toLocaleString()}</td></tr>
      <tr style="background:#0A1931; color:white; font-weight:900"><td style="padding:14px">TOTAL</td><td style="padding:14px; text-align:right">KES ${r.total.toLocaleString()}</td></tr>
      ${isAdmin ? `<tr style="background:#fef3c7"><td style="padding:10px; border:1px solid #e2e8f0">Plumber Share 50% (ADMIN ONLY)</td><td style="padding:10px; border:1px solid #e2e8f0; text-align:right">KES ${r.plumber_share.toLocaleString()}</td></tr>` : ''}
    </table>
    <p style="text-align:center; margin-top:40px; color:#94a3b8; font-size:11px">RapidFundi - Paid after completion</p>
  </body></html>`;
};

export default function ReceiptView({ receipt, role = 'customer' }: { receipt: ReceiptData, role: ReceiptRole }) {
  const print = async () => {
    try{
      const html = getHtml(receipt, role);
      const { uri } = await Print.printToFileAsync({ html });
      if(await Sharing.isAvailableAsync()){
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      } else {
        await Print.printAsync({ html });
      }
    }catch(e:any){ Alert.alert("Failed", e.message); }
  };

  return (
    <View style={{ backgroundColor:"white", borderRadius:16, padding:16, borderWidth:1, borderColor:"#e2e8f0" }}>
      <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
        <Text style={{ fontWeight:"900", fontSize:16 }}>🔧 RapidFundi</Text>
        <Text style={{ backgroundColor: receipt.status==='PAID' ? "#dcfce7" : receipt.status==='UNPAID' ? "#fef3c7" : "#fef3c7", paddingHorizontal:10, paddingVertical:4, borderRadius:12, fontSize:10, fontWeight:"800" }}>
          {receipt.status === 'UNPAID' && receipt.type === 'PLUMBER_PAYOUT' ? '⏳ PENDING' : receipt.status}
        </Text>
      </View>
      <Text style={{ fontSize:12, color:"#64748b", marginTop:8 }}>{receipt.receipt_number} • {receipt.job_number}</Text>
      
      {role === 'plumber' ? (
        <>
          <Text style={{ marginTop:12, fontSize:13 }}>Labour: KES {receipt.labour.toLocaleString()}</Text>
          <Text style={{ fontWeight:"900", fontSize:18, marginTop:6, color:"#0A1931" }}>Your Payout: KES {receipt.plumber_share.toLocaleString()} (50%)</Text>
          <Text style={{ fontSize:11, color: receipt.status==='PAID' ? "#16a34a" : "#d97706", marginTop:4, fontWeight:"700" }}>
            {receipt.status==='PAID' ? '✅ Paid - Check M-Pesa' : '⏳ To be paid end of day'}
          </Text>
        </>
      ) : (
        <>
          <Text style={{ marginTop:12, fontSize:12 }}>{receipt.materials_list}</Text>
          <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:12 }}><Text>Labour</Text><Text>KES {receipt.labour.toLocaleString()}</Text></View>
          <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:6 }}><Text>Materials</Text><Text>KES {receipt.materials_cost.toLocaleString()}</Text></View>
          <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:10, borderTopWidth:1, borderColor:"#f1f5f9", paddingTop:10 }}><Text style={{fontWeight:"900"}}>TOTAL</Text><Text style={{fontWeight:"900"}}>KES {receipt.total.toLocaleString()}</Text></View>
          {role==='admin' && <Text style={{ marginTop:8, fontSize:11, color:"#d97706" }}>Plumber: KES {receipt.plumber_share.toLocaleString()} • Yours: KES {(receipt.labour - receipt.plumber_share).toLocaleString()}</Text>}
        </>
      )}

      <TouchableOpacity onPress={print} style={{ backgroundColor:"#0A1931", padding:12, borderRadius:10, marginTop:14 }}>
        <Text style={{ color:"white", textAlign:"center", fontWeight:"800", fontSize:12 }}>📄 Print / Share PDF</Text>
      </TouchableOpacity>
    </View>
  );
}