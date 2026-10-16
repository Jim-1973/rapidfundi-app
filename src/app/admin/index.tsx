import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Linking, Modal, Platform } from "react-native";
import { supabase } from "../../../lib/supabase";
import { createClient } from '@supabase/supabase-js';

const supabaseTemp = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

export default function Admin() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [plumbers, setPlumbers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [quote, setQuote] = useState({ labour: "", materials: "", fee: "200", notes: "" });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'jobs'|'plumbers'>('jobs');
  const [showAdd, setShowAdd] = useState(false);
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pPass, setPPass] = useState("Rapid@2026");
  const [pSkill, setPSkill] = useState("Water Supply");
  const [editJobModal, setEditJobModal] = useState<any>(null);
  const [editPlumberModal, setEditPlumberModal] = useState<any>(null);
  const [search, setSearch] = useState("");

  const getStatusColor = (status: string) => {
    switch(status){
      case 'UNDER_REVIEW': return { border: "#fbbf24", bg: "#fef3c7", dot: "#f59e0b", label: "UNDER REVIEW" };
      case 'QUOTATION_PREPARED': return { border: "#a78bfa", bg: "#ede9fe", dot: "#8b5cf6", label: "QUOTE READY" };
      case 'QUOTATION_APPROVED': return { border: "#2dd4bf", bg: "#ccfbf1", dot: "#0ABAB5", label: "APPROVED" };
      case 'ASSIGNED': return { border: "#4ade80", bg: "#dcfce7", dot: "#22c55e", label: "ASSIGNED" };
      case 'COMPLETED': return { border: "#22c55e", bg: "#dcfce7", dot: "#16a34a", label: "COMPLETED" };
      default: return { border: "#e2e8f0", bg: "#f1f5f9", dot: "#94a3b8", label: status };
    }
  };

  const fetchJobs = async () => {
    const { data } = await supabase.from('jobs').select('*, plumbers(name, plumber_number, phone)').order('created_at', { ascending: false });
    setJobs(data || []);
    const { data: pl } = await supabase.from('plumbers').select('*').order('created_at', {ascending:false});
    setPlumbers(pl||[]);
  };
  useEffect(()=>{ fetchJobs() }, []);

  const formatPhoneForWhatsApp = (phone: string) => {
    let p = phone.replace(/\s+/g, '').replace('+','');
    if(p.startsWith('0')) p = '254' + p.substring(1);
    if(!p.startsWith('254')) p = '254' + p;
    return p;
  };

  const sendWhatsAppCredentials = async (phone: string, email: string, tempPassword: string, name: string) => {
    const formatted = formatPhoneForWhatsApp(phone);
    const message = `Hello ${name}! 👋\n\nYou have been registered as a plumber on RAPIDFUNDI 🔧\n\n*LOGIN DETAILS:*\nEmail: ${email}\nTemp Password: ${tempPassword}\n\n⚠️ Change password on first login.\n\nWelcome aboard!`;
    const whatsappUrl = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    console.log("Opening WhatsApp:", whatsappUrl);
    if (Platform.OS === 'web') {
      // @ts-ignore
      window.open(whatsappUrl, '_blank');
    } else {
      try {
        const can = await Linking.canOpenURL(whatsappUrl);
        if(can) await Linking.openURL(whatsappUrl);
        else Alert.alert("WhatsApp", message);
      } catch { Alert.alert("WhatsApp", message); }
    }
  };

  const addPlumberDirectly = async () => {
    if(!pName ||!pEmail ||!pPhone){ Alert.alert("Fill all fields"); return; }
    setLoading(true);
    try{
      const { data, error } = await supabaseTemp.auth.signUp({
        email: pEmail.trim(), password: pPass,
        options: { data: { role: "plumber", full_name: pName } }
      });
      if(error) throw error;
      const userId = data.user?.id;
      if(!userId) throw new Error("DISABLE Confirm email in Supabase > Auth > Email");
      const plumberNumber = `PLM-${Date.now().toString().slice(-5)}`;
      const { error: dbError } = await supabase.from('plumbers').insert({
        user_id: userId, name: pName, email: pEmail.trim(), phone: pPhone,
        plumber_number: plumberNumber, rating: 5.0, active: true,
        must_change_password: true, status: 'AVAILABLE', skills: [pSkill]
      });
      if(dbError) throw dbError;
      await sendWhatsAppCredentials(pPhone, pEmail.trim(), pPass, pName);
      Alert.alert("Added ✅", `${pName} - WhatsApp opened`);
      setShowAdd(false); setPName(""); setPEmail(""); setPPhone(""); setPPass("Rapid@2026");
      fetchJobs();
    } catch(e:any){ Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  const deleteJob = (job:any) => {
    Alert.alert("Delete Job?", `${job.job_number} will be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setLoading(true);
        await supabase.from('quotations').delete().eq('job_id', job.id);
        await supabase.from('job_media').delete().eq('job_id', job.id);
        await supabase.from('jobs').delete().eq('id', job.id);
        fetchJobs(); setLoading(false);
      }}
    ]);
  };
  const updateJob = async () => {
    if(!editJobModal) return;
    setLoading(true);
    await supabase.from('jobs').update({
      category: editJobModal.category, building_name: editJobModal.building_name,
      street: editJobModal.street, status: editJobModal.status, description: editJobModal.description
    }).eq('id', editJobModal.id);
    setEditJobModal(null); fetchJobs(); setLoading(false);
  };
  const deletePlumber = (p:any) => {
    Alert.alert("Delete Plumber?", `${p.name} will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setLoading(true);
        await supabase.from('jobs').update({ assigned_plumber_id: null, status: 'QUOTATION_APPROVED' }).eq('assigned_plumber_id', p.id);
        await supabase.from('plumbers').delete().eq('id', p.id);
        fetchJobs(); setLoading(false);
      }}
    ]);
  };
  const updatePlumber = async () => {
    if(!editPlumberModal) return;
    setLoading(true);
    await supabase.from('plumbers').update({
      name: editPlumberModal.name, phone: editPlumberModal.phone, email: editPlumberModal.email, skills: [editPlumberModal.skills], active: editPlumberModal.active
    }).eq('id', editPlumberModal.id);
    setEditPlumberModal(null); fetchJobs(); setLoading(false);
  };
  const toggleActive = async (p:any) => { await supabase.from('plumbers').update({ active:!p.active }).eq('id', p.id); fetchJobs(); };

  const openJob = async (job:any) => {
    setSelected(job);
    const { data } = await supabase.from('job_media').select('*').eq('job_id', job.id).order('created_at',{ascending:false});
    setMedia(data || []);
  };
  const createQuotation = async () => {
    if(!selected) return;
    const total = (parseFloat(quote.labour)||0)+(parseFloat(quote.materials)||0)+(parseFloat(quote.fee)||0);
    setLoading(true);
    const qNum = `RFQ-${selected.job_number.split('-').pop()}`;
    await supabase.from('quotations').insert({ job_id: selected.id, quotation_number: qNum, labour: parseFloat(quote.labour)||0, materials: parseFloat(quote.materials)||0, service_fee: parseFloat(quote.fee)||0, total, notes: quote.notes, status: 'PENDING' });
    await supabase.from('jobs').update({ status: 'QUOTATION_PREPARED' }).eq('id', selected.id);
    Alert.alert("Success", `KES ${total} sent`); setSelected(null); fetchJobs(); setLoading(false);
  };
  const assignPlumber = async (plumber:any) => {
    setLoading(true);
    await supabase.from('jobs').update({ assigned_plumber_id: plumber.id, status: 'ASSIGNED' }).eq('id', selected.id);
    setSelected(null); fetchJobs(); setLoading(false);
  };

  const filteredJobs = jobs.filter(j => `${j.job_number} ${j.category} ${j.building_name}`.toLowerCase().includes(search.toLowerCase()));

  if(selected){
    const c = getStatusColor(selected.status);
    return (
      <ScrollView style={{ flex:1, backgroundColor:"white" }} contentContainerStyle={{ padding:20, paddingTop:50 }}>
        <TouchableOpacity onPress={()=>setSelected(null)}><Text style={{ color:"#0ABAB5", fontWeight:"800" }}>← Back</Text></TouchableOpacity>
        <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:16 }}>
          <Text style={{ fontSize:22, fontWeight:"900" }}>{selected.job_number}</Text>
          <Text style={{ fontSize:11, fontWeight:"800", backgroundColor: c.bg, paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}>{c.label}</Text>
        </View>
        <View style={{ backgroundColor:"#f8fafc", padding:16, borderRadius:16, marginTop:16 }}>
          <Text style={{ fontWeight:"800" }}>{selected.category}</Text>
          <Text style={{ marginTop:6 }}>{selected.description}</Text>
          <Text style={{ marginTop:8, fontWeight:"600" }}>{selected.building_name}, {selected.street}</Text>
        </View>
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:16 }}>
          {media.map((m,i)=>(<Image key={i} source={{uri: m.url}} style={{ width:100, height:100, borderRadius:12 }} />))}
        </View>
        {selected.status === 'UNDER_REVIEW' && (
          <View style={{ backgroundColor:"#fffbeb", padding:16, borderRadius:16, marginTop:20, borderWidth:1, borderColor:"#fde68a" }}>
            <Text style={{ fontWeight:"800" }}>Create Quotation</Text>
            <TextInput placeholder="Labour" keyboardType="numeric" value={quote.labour} onChangeText={t=>setQuote({...quote, labour:t})} style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:12, backgroundColor:"white" }} />
            <TextInput placeholder="Materials" keyboardType="numeric" value={quote.materials} onChangeText={t=>setQuote({...quote, materials:t})} style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:8, backgroundColor:"white" }} />
            <TouchableOpacity onPress={createQuotation} style={{ backgroundColor:"#0A1931", padding:16, borderRadius:12, marginTop:16 }}><Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>SEND QUOTATION</Text></TouchableOpacity>
          </View>
        )}
        {selected.status === 'QUOTATION_APPROVED' && (
          <View style={{ backgroundColor:"#f0fdfa", padding:16, borderRadius:16, marginTop:20 }}>
            <Text style={{ fontWeight:"800" }}>Assign Plumber</Text>
            {plumbers.filter(p=>p.active).map(p=>(
              <TouchableOpacity key={p.id} onPress={()=>assignPlumber(p)} style={{ backgroundColor:"white", padding:14, borderRadius:12, marginTop:10, borderWidth:1 }}><Text style={{ fontWeight:"800" }}>{p.plumber_number} - {p.name}</Text></TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    )
  }

  return (
    <View style={{ flex:1, backgroundColor:"#f8fafc" }}>
    <ScrollView contentContainerStyle={{ padding:20, paddingTop:50 }}>
      <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
        <View><Text style={{ fontSize:28, fontWeight:"900" }}>Admin Panel</Text><Text style={{ color:"#64748b" }}>{jobs.length} jobs • {plumbers.length} plumbers</Text></View>
        <TouchableOpacity onPress={fetchJobs} style={{ backgroundColor:"white", padding:10, borderRadius:12, borderWidth:1, borderColor:"#e2e8f0" }}><Text>↻</Text></TouchableOpacity>
      </View>
      <TextInput placeholder="🔍 Search" value={search} onChangeText={setSearch} style={{ backgroundColor:"white", borderRadius:14, padding:14, marginTop:16, borderWidth:1, borderColor:"#e2e8f0" }}/>
      <View style={{ flexDirection:"row", gap:8, marginTop:16 }}>
        <TouchableOpacity onPress={()=>setTab('jobs')} style={{ flex:1, backgroundColor: tab==='jobs'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='jobs'? "white" : "#0A1931" }}>Jobs ({jobs.length})</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('plumbers')} style={{ flex:1, backgroundColor: tab==='plumbers'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='plumbers'? "white" : "#0A1931" }}>Plumbers ({plumbers.length})</Text></TouchableOpacity>
      </View>
      <TouchableOpacity onPress={()=>setShowAdd(!showAdd)} style={{ backgroundColor:"#0ABAB5", padding:16, borderRadius:14, marginTop:16 }}><Text style={{ color:"white", textAlign:"center", fontWeight:"900" }}>{showAdd? "✕ Close" : "+ Add Plumber (WhatsApp)"}</Text></TouchableOpacity>
      {showAdd && (
        <View style={{backgroundColor:"white", borderRadius:20, padding:20, marginTop:16, borderWidth:1, borderColor:"#e2e8f0"}}>
          <Text style={{fontSize:18, fontWeight:"900"}}>New Plumber</Text>
          <TextInput placeholder="Full Name" value={pName} onChangeText={setPName} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:16, backgroundColor:"#f8fafc"}}/>
          <TextInput placeholder="Email" value={pEmail} onChangeText={setPEmail} autoCapitalize="none" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
          <TextInput placeholder="Phone 0712..." value={pPhone} onChangeText={setPPhone} keyboardType="phone-pad" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
          <TextInput placeholder="Temp Password Rapid@2026" value={pPass} onChangeText={setPPass} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
          <View style={{flexDirection:"row", gap:10, marginTop:16}}>
            <TouchableOpacity onPress={()=>setShowAdd(false)} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12}}><Text style={{textAlign:"center", fontWeight:"700"}}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={addPlumberDirectly} disabled={loading} style={{flex:2, backgroundColor:"#0A1931", padding:14, borderRadius:12}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Add & WhatsApp</Text>}</TouchableOpacity>
          </View>
        </View>
      )}
      {tab==='jobs'? (
        <View style={{ gap:12, marginTop:20 }}>
          {filteredJobs.map(job=>{
            const c = getStatusColor(job.status);
            return (
            <View key={job.id} style={{ backgroundColor:"white", padding:16, borderRadius:20, borderWidth:1, borderColor: c.border }}>
              <TouchableOpacity onPress={()=>openJob(job)}>
                <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}><View style={{ width:8, height:8, borderRadius:4, backgroundColor:c.dot }} /><Text style={{ fontWeight:"900", fontSize:13 }}>{job.job_number}</Text></View>
                  <Text style={{ fontSize:10, fontWeight:"800", backgroundColor: c.bg, paddingHorizontal:10, paddingVertical:4, borderRadius:20 }}>{c.label}</Text>
                </View>
                <Text style={{ fontWeight:"700", marginTop:10 }}>{job.category}</Text>
                <Text style={{ fontSize:12, color:"#64748b" }} numberOfLines={1}>{job.description}</Text>
                <Text style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>📍 {job.building_name}, {job.street}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection:"row", gap:8, marginTop:12, borderTopWidth:1, borderTopColor:"#f1f5f9", paddingTop:12 }}>
                <TouchableOpacity onPress={()=>setEditJobModal(job)} style={{ flex:1, backgroundColor:"#f1f5f9", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12 }}>✏️ Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>deleteJob(job)} style={{ flex:1, backgroundColor:"#fef2f2", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12, color:"#dc2626" }}>🗑️ Delete</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>openJob(job)} style={{ flex:1, backgroundColor:"#0A1931", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12, color:"white" }}>View →</Text></TouchableOpacity>
              </View>
            </View>
          )})}
        </View>
      ) : (
        <View style={{ gap:12, marginTop:20 }}>
          {plumbers.map(p=>(
            <View key={p.id} style={{ backgroundColor:"white", padding:16, borderRadius:20, borderWidth:1, borderColor:"#e2e8f0" }}>
              <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
                <View style={{ flex:1 }}><Text style={{ fontWeight:"900" }}>{p.plumber_number} • {p.name}</Text><Text style={{ fontSize:12, color:"#64748b" }}>{p.email} • {p.phone}</Text></View>
                <TouchableOpacity onPress={()=>toggleActive(p)} style={{ backgroundColor: p.active? "#dcfce7" : "#f1f5f9", paddingHorizontal:12, paddingVertical:6, borderRadius:20, alignSelf:"flex-start" }}><Text style={{ fontSize:11, fontWeight:"800" }}>{p.active? "Active" : "Inactive"}</Text></TouchableOpacity>
              </View>
              <View style={{ flexDirection:"row", gap:8, marginTop:12 }}>
                <TouchableOpacity onPress={()=>setEditPlumberModal({...p, skills: p.skills?.[0]||""})} style={{ flex:1, backgroundColor:"#f1f5f9", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12 }}>✏️ Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={()=>deletePlumber(p)} style={{ flex:1, backgroundColor:"#fef2f2", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12, color:"#dc2626" }}>🗑️ Delete</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>

    <Modal visible={!!editJobModal} transparent animationType="slide">
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" }}>
        <View style={{ backgroundColor:"white", borderTopLeftRadius:24, borderTopRightRadius:24, padding:20 }}>
          <Text style={{ fontSize:18, fontWeight:"900" }}>Edit {editJobModal?.job_number}</Text>
          <TextInput value={editJobModal?.category} onChangeText={t=>setEditJobModal({...editJobModal, category:t})} placeholder="Category" style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:16 }}/>
          <TextInput value={editJobModal?.building_name} onChangeText={t=>setEditJobModal({...editJobModal, building_name:t})} placeholder="Building" style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10 }}/>
          <TextInput value={editJobModal?.description} onChangeText={t=>setEditJobModal({...editJobModal, description:t})} placeholder="Description" multiline style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, height:80 }}/>
          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:12 }}>
            {['UNDER_REVIEW','QUOTATION_PREPARED','QUOTATION_APPROVED','ASSIGNED','COMPLETED'].map(s=>(
              <TouchableOpacity key={s} onPress={()=>setEditJobModal({...editJobModal, status:s})} style={{ backgroundColor: editJobModal?.status===s? "#0A1931" : "white", borderWidth:1, borderColor:"#e2e8f0", paddingHorizontal:12, paddingVertical:8, borderRadius:20 }}>
                <Text style={{ fontSize:11, fontWeight:"700", color: editJobModal?.status===s? "white" : "#334155" }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection:"row", gap:10, marginTop:20 }}>
            <TouchableOpacity onPress={()=>setEditJobModal(null)} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12 }}><Text style={{ textAlign:"center" }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={updateJob} style={{ flex:1, backgroundColor:"#0ABAB5", padding:14, borderRadius:12 }}><Text style={{ textAlign:"center", color:"white", fontWeight:"800" }}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <Modal visible={!!editPlumberModal} transparent animationType="slide">
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" }}>
        <View style={{ backgroundColor:"white", borderTopLeftRadius:24, borderTopRightRadius:24, padding:20 }}>
          <Text style={{ fontSize:18, fontWeight:"900" }}>Edit {editPlumberModal?.name}</Text>
          <TextInput value={editPlumberModal?.name} onChangeText={t=>setEditPlumberModal({...editPlumberModal, name:t})} placeholder="Name" style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:16 }}/>
          <TextInput value={editPlumberModal?.email} onChangeText={t=>setEditPlumberModal({...editPlumberModal, email:t})} placeholder="Email" style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10 }}/>
          <TextInput value={editPlumberModal?.phone} onChangeText={t=>setEditPlumberModal({...editPlumberModal, phone:t})} placeholder="Phone" style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10 }}/>
          <View style={{ flexDirection:"row", gap:10, marginTop:20 }}>
            <TouchableOpacity onPress={()=>setEditPlumberModal(null)} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12 }}><Text style={{ textAlign:"center" }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={updatePlumber} style={{ flex:1, backgroundColor:"#0A1931", padding:14, borderRadius:12 }}><Text style={{ textAlign:"center", color:"white", fontWeight:"800" }}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  )
}