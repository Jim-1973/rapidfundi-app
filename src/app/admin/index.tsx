import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Linking } from "react-native";
import { supabase } from "../../../lib/supabase";

export default function Admin() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [quote, setQuote] = useState({ labour: "", materials: "", fee: "200", notes: "" });
  const [loading, setLoading] = useState(false);
  const [plumbers, setPlumbers] = useState<any[]>([]);

  // ADD PLUMBER STATES
  const [showAdd, setShowAdd] = useState(false);
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pPass, setPPass] = useState("123456");
  const [pSkill, setPSkill] = useState("Water Supply");

  const getStatusColor = (status: string) => {
    switch(status){
      case 'UNDER_REVIEW': return { border: "#f59e0b", bg: "#fef3c7", label: "UNDER REVIEW" };
      case 'QUOTATION_PREPARED': return { border: "#8b5cf6", bg: "#ede9fe", label: "QUOTATION READY" };
      case 'QUOTATION_APPROVED': return { border: "#0ABAB5", bg: "#ccfbf1", label: "APPROVED" };
      case 'ASSIGNED': return { border: "#22c55e", bg: "#dcfce7", label: "ASSIGNED" };
      case 'EN_ROUTE': return { border: "#f97316", bg: "#ffedd5", label: "EN ROUTE" };
      case 'ARRIVED': return { border: "#3b82f6", bg: "#dbeafe", label: "WORK ONGOING" };
      case 'COMPLETED': return { border: "#16a34a", bg: "#dcfce7", label: "COMPLETED" };
      default: return { border: "#e2e8f0", bg: "#f1f5f9", label: status };
    }
  };

  const fetchJobs = async () => {
    const { data } = await supabase.from('jobs').select('*, plumbers(name, plumber_number, phone)').order('created_at', { ascending: false });
    setJobs(data || []);
    const { data: pl } = await supabase.from('plumbers').select('*').order('created_at', {ascending:false});
    setPlumbers(pl||[]);
  };

  useEffect(()=>{ fetchJobs() }, []);

  // --- NEW: WHATSAPP SENDER ---
  const formatPhoneForWhatsApp = (phone: string) => {
    let p = phone.replace(/\s+/g, '').replace('+','');
    if(p.startsWith('0')) p = '254' + p.substring(1);
    if(!p.startsWith('254')) p = '254' + p;
    return p;
  };

  const sendWhatsAppCredentials = async (phone: string, email: string, tempPassword: string, name: string) => {
    const formatted = formatPhoneForWhatsApp(phone);
    const message = `Hello ${name}! 👋\n\nYou have been registered as a plumber on RAPIDFUNDI 🔧\n\n*LOGIN DETAILS:*\nEmail: ${email}\nTemp Password: ${tempPassword}\nLogin Link: https://rapidfundi.com/plumber/login\n\n⚠️ You will be asked to change your password on first login.\n\nWelcome aboard!`;

    const whatsappUrl = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(whatsappUrl);
    } catch (e) {
      console.log("WhatsApp open failed", e);
      Alert.alert("WhatsApp", `Copy this message to send to ${phone}:\n\n${message}`);
    }
  };

  // --- FIXED: INSERT BEFORE SIGNOUT + WHATSAPP ---
  const addPlumberDirectly = async () => {
    if(!pName ||!pEmail ||!pPhone){ Alert.alert("Fill all fields"); return; }
    setLoading(true);
    try{
      const { data, error } = await supabase.auth.signUp({
        email: pEmail.trim(),
        password: pPass,
        options: { data: { role: "plumber", full_name: pName } }
      });
      if(error) throw error;

      const userId = data.user?.id;
      if(!userId) throw new Error("User not created - disable confirm email in Supabase Auth settings.");

      const plumberNumber = `PLM-${Date.now().toString().slice(-5)}`;

      const { error: dbError } = await supabase.from('plumbers').insert({
        user_id: userId,
        name: pName,
        email: pEmail.trim(),
        phone: pPhone,
        plumber_number: plumberNumber,
        rating: 5.0,
        active: true,
        must_change_password: true,
        status: 'AVAILABLE',
        skills: [pSkill]
      });
      if(dbError) throw dbError;

      await supabase.auth.signOut();

      // --- SEND WHATSAPP WITH LOGIN DETAILS ---
      await sendWhatsAppCredentials(pPhone, pEmail.trim(), pPass, pName);

      Alert.alert("Plumber Added ✅", `${pName}\nWhatsApp with login details opened.\n\nEmail: ${pEmail}\nPass: ${pPass}`);
      setShowAdd(false);
      setPName(""); setPEmail(""); setPPhone(""); setPPass("123456"); setPSkill("Water Supply");
      fetchJobs();
    } catch(e:any){
      console.log(e);
      Alert.alert("Error adding", e.message);
    } finally {
      setLoading(false);
    }
  };

  const openJob = async (job:any) => {
    setSelected(job);
    const { data } = await supabase.from('job_media').select('*').eq('job_id', job.id).order('created_at',{ascending:false});
    setMedia(data || []);
  };

  const createQuotation = async () => {
    if(!selected) return;
    const labour = parseFloat(quote.labour) || 0;
    const materials = parseFloat(quote.materials) || 0;
    const fee = parseFloat(quote.fee) || 0;
    const total = labour + materials + fee;
    setLoading(true);
    const qNum = `RFQ-${selected.job_number.split('-').pop()}`;
    const { error } = await supabase.from('quotations').insert({
      job_id: selected.id, quotation_number: qNum,
      labour, materials, service_fee: fee, total,
      notes: quote.notes, status: 'PENDING'
    });
    if(error){ Alert.alert("Error", error.message); setLoading(false); return; }
    await supabase.from('jobs').update({ status: 'QUOTATION_PREPARED' }).eq('id', selected.id);
    Alert.alert("Success", `Quotation ${qNum} - KES ${total} sent`);
    setSelected(null); setQuote({ labour: "", materials: "", fee: "200", notes: "" });
    fetchJobs(); setLoading(false);
  };

  const assignPlumber = async (plumber:any) => {
    setLoading(true);
    const { error } = await supabase.from('jobs').update({ assigned_plumber_id: plumber.id, status: 'ASSIGNED' }).eq('id', selected.id);
    if(error){ Alert.alert("Error", error.message); }
    else { Alert.alert("Assigned", `${plumber.name} assigned`); setSelected(null); fetchJobs(); }
    setLoading(false);
  };

  if(selected){
    const c = getStatusColor(selected.status);
    return (
      <ScrollView style={{ flex:1, backgroundColor:"white" }} contentContainerStyle={{ padding:20, paddingTop:50 }}>
        <TouchableOpacity onPress={()=>setSelected(null)}><Text style={{ color:"#0ABAB5", fontWeight:"700" }}>← Back to Jobs</Text></TouchableOpacity>
        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
          <Text style={{ fontSize:22, fontWeight:"900" }}>{selected.job_number}</Text>
          <Text style={{ fontSize:11, fontWeight:"800", backgroundColor: c.bg, borderColor: c.border, borderWidth:1, paddingHorizontal:10, paddingVertical:5, borderRadius:20 }}>{c.label}</Text>
        </View>
        {selected.plumbers && <Text style={{ marginTop:6, fontWeight:"700", color:"#0A1931" }}>Plumber: {selected.plumbers.name} ({selected.plumbers.plumber_number}) • {selected.plumbers.phone}</Text>}
        <View style={{ backgroundColor:"#f8fafc", padding:16, borderRadius:12, marginTop:16 }}>
          <Text style={{ fontWeight:"700" }}>{selected.category}</Text>
          <Text style={{ marginTop:6 }}>{selected.description}</Text>
          <Text style={{ marginTop:8, fontWeight:"700" }}>Location: {selected.building_name}, {selected.street} - Floor {selected.floor}</Text>
          <Text style={{ fontSize:12, color:"#64748b", marginTop:4 }}>Customer: {selected.customer_email || 'guest'}</Text>
        </View>
        <Text style={{ fontWeight:"800", marginTop:16 }}>Evidence ({media.length})</Text>
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:8 }}>
          {media.map((m,i)=>(
            <View key={i}><Image source={{uri: m.url}} style={{ width:100, height:100, borderRadius:8 }} /><Text style={{ fontSize:10 }}>{m.type}</Text></View>
          ))}
        </View>

        {selected.status === 'UNDER_REVIEW' && (
          <View style={{ backgroundColor:"#fff7ed", padding:16, borderRadius:12, marginTop:20, borderWidth:1, borderColor:"#fed7aa" }}>
            <Text style={{ fontWeight:"800" }}>Create Quotation</Text>
            <TextInput placeholder="Labour KES" keyboardType="numeric" value={quote.labour} onChangeText={t=>setQuote({...quote, labour:t})} style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:12, backgroundColor:"white" }} />
            <TextInput placeholder="Materials KES" keyboardType="numeric" value={quote.materials} onChangeText={t=>setQuote({...quote, materials:t})} style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:8, backgroundColor:"white" }} />
            <TextInput placeholder="Fee KES" value={quote.fee} onChangeText={t=>setQuote({...quote, fee:t})} style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:8, backgroundColor:"white" }} />
            <Text style={{ marginTop:10, fontWeight:"800" }}>Total: KES {(parseFloat(quote.labour||"0")+parseFloat(quote.materials||"0")+parseFloat(quote.fee||"0"))}</Text>
            <TouchableOpacity onPress={createQuotation} disabled={loading} style={{ backgroundColor:"#0A1931", padding:16, borderRadius:12, marginTop:16 }}>
              {loading? <ActivityIndicator color="white"/> : <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>SEND QUOTATION</Text>}
            </TouchableOpacity>
          </View>
        )}

        {selected.status === 'QUOTATION_APPROVED' && (
          <View style={{ backgroundColor:"#f0fdfa", padding:16, borderRadius:12, marginTop:20 }}>
            <Text style={{ fontWeight:"800" }}>Assign Plumber</Text>
            {plumbers.filter(p=>p.active).map(p=>(
              <TouchableOpacity key={p.id} onPress={()=>assignPlumber(p)} style={{ backgroundColor:"white", padding:14, borderRadius:12, marginTop:10, borderWidth:1 }}>
                <Text style={{ fontWeight:"800" }}>{p.plumber_number} - {p.name} ⭐{p.rating}</Text>
                <Text style={{ fontSize:12 }}>{p.email} • {p.phone}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    )
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#f8fafc" }} contentContainerStyle={{ padding:20, paddingTop:50 }}>
      <Text style={{ fontSize:28, fontWeight:"900" }}>Admin Panel</Text>
      <Text style={{ color:"#64748b" }}>{jobs.length} jobs • {plumbers.length} plumbers</Text>

      <TouchableOpacity onPress={()=>setShowAdd(!showAdd)} style={{ backgroundColor:"#0A1931", padding:16, borderRadius:12, marginTop:16 }}>
        <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>{showAdd? "Close Form" : "+ Add Plumber (with WhatsApp)"}</Text>
      </TouchableOpacity>

      {showAdd && (
        <View style={{backgroundColor:"white", borderRadius:16, padding:20, marginTop:16, borderWidth:2, borderColor:"#0ABAB5"}}>
          <Text style={{fontSize:20, fontWeight:"900"}}>Add Plumber</Text>
          <Text style={{fontSize:12, color:"#64748b", marginTop:2}}>Will auto-send WhatsApp with login details</Text>
          <TextInput placeholder="Full Name" value={pName} onChangeText={setPName} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:16}}/>
          <TextInput placeholder="Email (for login)" value={pEmail} onChangeText={setPEmail} autoCapitalize="none" keyboardType="email-address" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:10}}/>
          <TextInput placeholder="Phone e.g. 0712345678" value={pPhone} onChangeText={setPPhone} keyboardType="phone-pad" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:10}}/>
          <TextInput placeholder="Temp Password" value={pPass} onChangeText={setPPass} secureTextEntry style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:10}}/>
          <TextInput placeholder="Specialty" value={pSkill} onChangeText={setPSkill} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, padding:12, marginTop:10}}/>
          <View style={{flexDirection:"row", gap:10, marginTop:16}}>
            <TouchableOpacity onPress={()=>setShowAdd(false)} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:10}}><Text style={{textAlign:"center"}}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={addPlumberDirectly} disabled={loading} style={{flex:1, backgroundColor:"#0ABAB5", padding:14, borderRadius:10}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Add & Send WhatsApp</Text>}</TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ backgroundColor:"white", padding:12, borderRadius:12, marginTop:12 }}>
        <Text style={{fontWeight:"800"}}>Plumbers ({plumbers.length}):</Text>
        {plumbers.map(p=>(
          <Text key={p.id} style={{fontSize:12, marginTop:4}}>• {p.name} - {p.email} {p.must_change_password? "(Must change pass)" : ""}</Text>
        ))}
      </View>

      <View style={{ gap:12, marginTop:20 }}>
        {jobs.map(job=>{
          const c = getStatusColor(job.status);
          return (
          <TouchableOpacity key={job.id} onPress={()=>openJob(job)} style={{ backgroundColor:"white", padding:16, borderRadius:14, borderWidth:1, borderColor: c.border }}>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
              <Text style={{ fontWeight:"800", fontSize:13 }}>{job.job_number}</Text>
              <Text style={{ fontSize:10, fontWeight:"700", backgroundColor: c.bg, paddingHorizontal:8, paddingVertical:3, borderRadius:20 }}>{c.label}</Text>
            </View>
            <Text style={{ fontWeight:"700", marginTop:6 }}>{job.category}</Text>
            <Text style={{ fontSize:12, color:"#64748b" }}>{job.building_name}, {job.street}</Text>
          </TouchableOpacity>
        )})}
      </View>

      <TouchableOpacity onPress={fetchJobs} style={{ marginTop:20, padding:12, borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, marginBottom:40 }}>
        <Text style={{ textAlign:"center" }}>↻ Refresh</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}