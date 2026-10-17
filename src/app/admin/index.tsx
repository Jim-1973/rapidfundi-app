import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Linking, Modal, Platform } from "react-native";
import { supabase, supabaseTemp, notifyCustomer, notifyPlumber } from "../../../lib/supabase";

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
  const [pError, setPError] = useState("");
  const [pSuccess, setPSuccess] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const getStatusColor = (status: string) => {
    switch(status){
      case 'UNDER_REVIEW': return { border: "#fbbf24", bg: "#fef3c7", dot: "#f59e0b", label: "UNDER REVIEW" };
      case 'QUOTATION_PREPARED': return { border: "#a78bfa", bg: "#ede9fe", dot: "#8b5cf6", label: "QUOTE READY" };
      case 'QUOTATION_APPROVED': return { border: "#2dd4bf", bg: "#ccfbf1", dot: "#0ABAB5", label: "APPROVED" };
      case 'ASSIGNED': return { border: "#4ade80", bg: "#dcfce7", dot: "#22c55e", label: "ASSIGNED" };
      case 'EN_ROUTE': return { border: "#f59e0b", bg: "#ffedd5", dot: "#f59e0b", label: "ON THE WAY" };
      case 'ARRIVED': return { border: "#3b82f6", bg: "#dbeafe", dot: "#2563eb", label: "WORK ONGOING" };
      case 'COMPLETED': return { border: "#22c55e", bg: "#dcfce7", dot: "#16a34a", label: "COMPLETED" };
      default: return { border: "#e2e8f0", bg: "#f1f5f9", dot: "#94a3b8", label: status };
    }
  };

  const fetchJobs = async (showLoader = false) => {
    try{
      if(showLoader) setLoading(true);
      const { data } = await supabase.from('jobs').select('*, plumbers(name, plumber_number, phone)').order('created_at', { ascending: false });
      setJobs(data || []);
      const { data: pl } = await supabase.from('plumbers').select('*').order('created_at', {ascending:false});
      setPlumbers(pl||[]);
      setLastUpdate(new Date().toLocaleTimeString());
    }catch(e){ console.error(e); } finally { if(showLoader) setLoading(false); }
  };

  useEffect(()=>{ 
    fetchJobs(true);
    const channel = supabase
      .channel('admin-realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plumbers' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_media' }, () => fetchJobs())
      .subscribe((status) => { if(status === 'SUBSCRIBED') setIsLive(true); });
    return () => { supabase.removeChannel(channel); setIsLive(false); }
  }, []);

  const formatPhoneForWhatsApp = (phone: string) => {
    let p = phone.replace(/\s+/g, '').replace('+','');
    if(p.startsWith('0')) p = '254' + p.substring(1);
    if(!p.startsWith('254')) p = '254' + p;
    return p;
  };

  const addPlumberDirectly = async () => {
    setPError(""); setPSuccess("");
    if(!pName.trim()){ setPError("Full name is required."); return; }
    if(!pEmail.trim()){ setPError("Email address is required."); return; }
    if(!/\S+@\S+\.\S+/.test(pEmail.trim())){ setPError("Invalid email format."); return; }
    if(!pPhone.trim()){ setPError("Phone number is required."); return; }
    if(pPhone.replace(/\D/g,"").length < 9){ setPError("Phone too short."); return; }
    if(pPass.length < 6){ setPError("Temp password must be at least 6 chars."); return; }

    const emailTrimmed = pEmail.trim().toLowerCase();
    const formattedWA = formatPhoneForWhatsApp(pPhone);
    const baseUrl = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.origin : 'https://rapidfundi.com') : 'https://rapidfundi.com';
    const loginLink = `${baseUrl}/login`;
    const message = `Hello ${pName}! 👋\n\nYou have been registered as a plumber on RAPIDFUNDI 🔧\n\n*LOGIN DETAILS:*\nEmail: ${emailTrimmed}\nTemp Password: ${pPass}\n\n👉 LOGIN HERE: ${loginLink}\n\n1. Login with temp password\n2. You will be asked to set a new password\n3. Then you can access your jobs\n\nWelcome aboard! 🚀`;
    const whatsappUrl = `https://wa.me/${formattedWA}?text=${encodeURIComponent(message)}`;

    setLoading(true);
    try{
      const { data: authData, error: authError } = await supabaseTemp.auth.signUp({
        email: emailTrimmed, password: pPass, options: { data: { role: "plumber", full_name: pName } }
      });
      if(authError){
        if(authError.message.toLowerCase().includes("already registered") || (authError as any).code === "user_already_exists"){
          setPError(`Email ${emailTrimmed} already exists. Delete from Supabase > Auth > Users.`);
          return;
        }
        throw new Error(authError.message);
      }
      const userId = authData.user?.id;
      if(!userId) throw new Error("Confirm email is ON. Turn it OFF in Supabase > Auth > Providers > Email");

      const plumberNumber = `PLM-${Date.now().toString().slice(-5)}`;
      const payload = { user_id: userId, name: pName.trim(), email: emailTrimmed, phone: pPhone.trim(), plumber_number: plumberNumber, rating: 5.0, active: true, must_change_password: true, status: 'AVAILABLE', skills: [pSkill] };
      const { data: inserted, error: dbError } = await supabase.from('plumbers').insert(payload).select();
      if(dbError) throw new Error(dbError.message);
      if(!inserted || inserted.length === 0) throw new Error("RLS blocked insert.");

      try{
        if(Platform.OS === 'web'){ window.open(whatsappUrl, '_blank'); } else { await Linking.openURL(whatsappUrl); }
      }catch(e){}

      setPSuccess(`${pName} added as ${plumberNumber}!`);
      setShowAdd(false); setPName(""); setPEmail(""); setPPhone(""); setPPass("Rapid@2026");
    }catch(e:any){ setPError(e.message); }finally{ setLoading(false); }
  };

  const confirmDelete = async (title: string, message: string, onConfirm: () => Promise<void>) => {
    if(Platform.OS === 'web'){
      const ok = (window as any).confirm(`${title}\n\n${message}`);
      if(ok) await onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onConfirm }
      ]);
    }
  };

  const deleteJob = async (job:any) => {
    await confirmDelete("Delete Job?", `${job.job_number} will be deleted permanently.`, async () => {
      setLoading(true);
      try{
        await supabase.from('quotations').delete().eq('job_id', job.id);
        await supabase.from('job_media').delete().eq('job_id', job.id);
        const { error } = await supabase.from('jobs').delete().eq('id', job.id);
        if(error) throw error;
      }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
    });
  };

  const updateJob = async () => {
    if(!editJobModal) return;
    setLoading(true);
    try{
      const { error } = await supabase.from('jobs').update({
        category: editJobModal.category, building_name: editJobModal.building_name,
        street: editJobModal.street, status: editJobModal.status, description: editJobModal.description
      }).eq('id', editJobModal.id);
      if(error) throw error;
      setEditJobModal(null);
    }catch(e:any){ Alert.alert("Update Failed", e.message); } finally { setLoading(false); }
  };

  const deletePlumber = async (p:any) => {
    await confirmDelete("Delete Plumber?", `${p.name} will be removed permanently.`, async () => {
      setLoading(true);
      try{
        await supabase.from('jobs').update({ assigned_plumber_id: null, status: 'QUOTATION_APPROVED' }).eq('assigned_plumber_id', p.id);
        const { error } = await supabase.from('plumbers').delete().eq('id', p.id);
        if(error) throw error;
      }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
    });
  };

  const updatePlumber = async () => {
    if(!editPlumberModal) return;
    setLoading(true);
    try{
      const { error } = await supabase.from('plumbers').update({
        name: editPlumberModal.name, phone: editPlumberModal.phone, email: editPlumberModal.email, skills: [editPlumberModal.skills?.[0] || editPlumberModal.skills], active: editPlumberModal.active
      }).eq('id', editPlumberModal.id);
      if(error) throw error;
      setEditPlumberModal(null);
    }catch(e:any){ Alert.alert("Update Failed", e.message); } finally { setLoading(false); }
  };

  const toggleActive = async (p:any) => { 
    const { error } = await supabase.from('plumbers').update({ active:!p.active }).eq('id', p.id);
    if(error){ Alert.alert("Failed", error.message); return; }
  };

  const openJob = async (job:any) => {
    setSelected(job);
    const { data } = await supabase.from('job_media').select('*').eq('job_id', job.id).order('created_at',{ascending:false});
    setMedia(data || []);
  };

  // === NOTIFICATION TRIGGER 1: QUOTATION READY ===
  const createQuotation = async () => {
    if(!selected) return;
    if(!quote.labour || !quote.materials){ Alert.alert("Fill labour & materials"); return; }
    setLoading(true);
    try{
      const total = (parseFloat(quote.labour)||0)+(parseFloat(quote.materials)||0)+(parseFloat(quote.fee)||0);
      const qNum = `RFQ-${selected.job_number.split('-').pop()}`;
      await supabase.from('quotations').insert({ job_id: selected.id, quotation_number: qNum, labour: parseFloat(quote.labour)||0, materials: parseFloat(quote.materials)||0, service_fee: parseFloat(quote.fee)||0, total, notes: quote.notes, status: 'PENDING' });
      await supabase.from('jobs').update({ status: 'QUOTATION_PREPARED' }).eq('id', selected.id);
      
      // 🔔 NOTIFY CUSTOMER - QUOTATION READY
      if(selected.customer_id){
        await notifyCustomer(
          selected.customer_id,
          "💰 Quotation Ready!",
          `Your job ${selected.job_number} quotation is KES ${total} (${qNum}). Open My Jobs to approve.`,
          "QUOTATION",
          selected.id
        );
      }

      setSelected(null);
      Alert.alert("Success", "Quotation sent & customer notified 🔔");
    }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
  };

  // === NOTIFICATION TRIGGER 2: PLUMBER ASSIGNED ===
  const assignPlumber = async (plumber:any) => {
    setLoading(true);
    try{
      await supabase.from('jobs').update({ assigned_plumber_id: plumber.id, status: 'ASSIGNED' }).eq('id', selected.id);
      
      // 🔔 NOTIFY PLUMBER
      if(plumber.user_id){
        await notifyPlumber(
          plumber.user_id,
          "🔧 New Job Assigned!",
          `You have been assigned ${selected.job_number} at ${selected.building_name}, ${selected.street}. Check Plumber App now.`,
          "ASSIGNMENT",
          selected.id
        );
      }
      
      // 🔔 NOTIFY CUSTOMER - PLUMBER ASSIGNED
      if(selected.customer_id){
        await notifyCustomer(
          selected.customer_id,
          "👷 Plumber Assigned!",
          `${plumber.name} (${plumber.plumber_number}) assigned to ${selected.job_number}. He will arrive in 30 mins.`,
          "ASSIGNMENT",
          selected.id
        );
      }

      setSelected(null);
      Alert.alert("Assigned", `${plumber.name} notified 🔔`);
    }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
  };

  const filteredJobs = jobs.filter(j => `${j.job_number} ${j.category} ${j.building_name} ${j.street} ${j.description}`.toLowerCase().includes(search.toLowerCase()));
  const filteredPlumbers = plumbers.filter(p => `${p.plumber_number} ${p.name} ${p.email} ${p.phone}`.toLowerCase().includes(search.toLowerCase()));

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
            <TouchableOpacity onPress={createQuotation} style={{ backgroundColor:"#0A1931", padding:16, borderRadius:12, marginTop:16 }}><Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>SEND QUOTATION + NOTIFY CUSTOMER</Text></TouchableOpacity>
          </View>
        )}
        {selected.status === 'QUOTATION_APPROVED' && (
          <View style={{ backgroundColor:"#f0fdfa", padding:16, borderRadius:16, marginTop:20 }}>
            <Text style={{ fontWeight:"800" }}>Assign Plumber (will notify both)</Text>
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
      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start" }}>
        <View>
          <View style={{flexDirection:"row", alignItems:"center", gap:8}}>
            <Text style={{ fontSize:28, fontWeight:"900" }}>Admin Panel</Text>
            {isLive && <View style={{flexDirection:"row", alignItems:"center", backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:3, borderRadius:12, gap:4}}><View style={{width:6, height:6, borderRadius:3, backgroundColor:"#22c55e"}}/><Text style={{fontSize:10, fontWeight:"900", color:"#16a34a"}}>LIVE</Text></View>}
          </View>
          <Text style={{ color:"#64748b" }}>{jobs.length} jobs • {plumbers.length} plumbers {lastUpdate ? `• Updated ${lastUpdate}` : ""}</Text>
        </View>
        <TouchableOpacity onPress={()=>fetchJobs(true)} style={{ backgroundColor:"white", padding:10, borderRadius:12, borderWidth:1, borderColor:"#e2e8f0" }}><Text>↻</Text></TouchableOpacity>
      </View>
      <TextInput placeholder="🔍 Search jobs or plumbers" value={search} onChangeText={setSearch} style={{ backgroundColor:"white", borderRadius:14, padding:14, marginTop:16, borderWidth:1, borderColor:"#e2e8f0" }}/>
      <View style={{ flexDirection:"row", gap:8, marginTop:16 }}>
        <TouchableOpacity onPress={()=>setTab('jobs')} style={{ flex:1, backgroundColor: tab==='jobs'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='jobs'? "white" : "#0A1931" }}>Jobs ({filteredJobs.length})</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('plumbers')} style={{ flex:1, backgroundColor: tab==='plumbers'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='plumbers'? "white" : "#0A1931" }}>Plumbers ({filteredPlumbers.length})</Text></TouchableOpacity>
      </View>
      <TouchableOpacity onPress={()=>{ setPError(""); setPSuccess(""); setShowAdd(!showAdd); }} style={{ backgroundColor:"#0ABAB5", padding:16, borderRadius:14, marginTop:16 }}><Text style={{ color:"white", textAlign:"center", fontWeight:"900" }}>{showAdd? "✕ Close" : "+ Add Plumber (WhatsApp)"}</Text></TouchableOpacity>
      {showAdd && (
        <View style={{backgroundColor:"white", borderRadius:20, padding:20, marginTop:16, borderWidth:1, borderColor:"#e2e8f0"}}>
          <Text style={{fontSize:18, fontWeight:"900"}}>New Plumber</Text>
          <TextInput placeholder="Full Name *" value={pName} onChangeText={(t)=>{ setPName(t); if(pError) setPError(""); }} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:16, backgroundColor:"#f8fafc"}}/>
          <TextInput placeholder="Email *" value={pEmail} onChangeText={(t)=>{ setPEmail(t); if(pError) setPError(""); }} autoCapitalize="none" keyboardType="email-address" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
          <TextInput placeholder="Phone 0712... *" value={pPhone} onChangeText={(t)=>{ setPPhone(t); if(pError) setPError(""); }} keyboardType="phone-pad" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
          <TextInput placeholder="Temp Password Rapid@2026 *" value={pPass} onChangeText={setPPass} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
          {pError ? (<View style={{ backgroundColor:"#fef2f2", padding:12, borderRadius:10, marginTop:12, borderWidth:1, borderColor:"#fecaca" }}><Text style={{ color:"#dc2626", fontSize:12, fontWeight:"700" }}>⚠️ {pError}</Text></View>) : null}
          {pSuccess ? (<View style={{ backgroundColor:"#f0fdf4", padding:12, borderRadius:10, marginTop:12, borderWidth:1, borderColor:"#bbf7d0" }}><Text style={{ color:"#16a34a", fontSize:12, fontWeight:"700" }}>✅ {pSuccess}</Text></View>) : null}
          <View style={{flexDirection:"row", gap:10, marginTop:16}}>
            <TouchableOpacity onPress={()=>{ setShowAdd(false); setPError(""); setPSuccess(""); }} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12}}><Text style={{textAlign:"center", fontWeight:"700"}}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={addPlumberDirectly} disabled={loading} style={{flex:2, backgroundColor: loading ? "#94a3b8" : "#0A1931", padding:14, borderRadius:12}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Add & WhatsApp</Text>}</TouchableOpacity>
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
          {filteredJobs.length===0 && <Text style={{textAlign:"center", color:"#94a3b8", marginTop:20}}>No jobs match "{search}"</Text>}
        </View>
      ) : (
        <View style={{ gap:12, marginTop:20 }}>
          {filteredPlumbers.map(p=>(
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
          {filteredPlumbers.length===0 && <Text style={{textAlign:"center", color:"#94a3b8", marginTop:20}}>No plumbers match "{search}"</Text>}
        </View>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>

    <Modal visible={!!editJobModal} transparent animationType="slide">
      <View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"center", padding:20}}>
        <View style={{backgroundColor:"white", borderRadius:20, padding:20}}>
          <Text style={{fontWeight:"900", fontSize:18}}>Edit Job {editJobModal?.job_number || ""}</Text>
          <TextInput value={editJobModal?.category || ""} onChangeText={t=>setEditJobModal({...editJobModal, category:t})} placeholder="Category" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:12}}/>
          <TextInput value={editJobModal?.building_name || ""} onChangeText={t=>setEditJobModal({...editJobModal, building_name:t})} placeholder="Building" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/>
          <TextInput value={editJobModal?.street || ""} onChangeText={t=>setEditJobModal({...editJobModal, street:t})} placeholder="Street" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/>
          <TextInput value={editJobModal?.status || ""} onChangeText={t=>setEditJobModal({...editJobModal, status:t})} placeholder="Status UNDER_REVIEW" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/>
          <TextInput value={editJobModal?.description || ""} onChangeText={t=>setEditJobModal({...editJobModal, description:t})} placeholder="Description" multiline style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8, height:80}}/>
          <View style={{flexDirection:"row", gap:10, marginTop:16}}>
            <TouchableOpacity onPress={()=>setEditJobModal(null)} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12}}><Text style={{textAlign:"center", fontWeight:"700"}}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={updateJob} disabled={loading} style={{flex:1, backgroundColor:"#0A1931", padding:14, borderRadius:12}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Save</Text>}</TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <Modal visible={!!editPlumberModal} transparent animationType="slide">
      <View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"center", padding:20}}>
        <View style={{backgroundColor:"white", borderRadius:20, padding:20}}>
          <Text style={{fontWeight:"900", fontSize:18}}>Edit {editPlumberModal?.plumber_number || ""}</Text>
          <TextInput value={editPlumberModal?.name || ""} onChangeText={t=>setEditPlumberModal({...editPlumberModal, name:t})} placeholder="Full Name" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:12}}/>
          <TextInput value={editPlumberModal?.email || ""} onChangeText={t=>setEditPlumberModal({...editPlumberModal, email:t})} placeholder="Email" autoCapitalize="none" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/>
          <TextInput value={editPlumberModal?.phone || ""} onChangeText={t=>setEditPlumberModal({...editPlumberModal, phone:t})} placeholder="Phone" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/>
          <TextInput value={String(editPlumberModal?.skills || "")} onChangeText={t=>setEditPlumberModal({...editPlumberModal, skills:t})} placeholder="Skill" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/>
          <View style={{flexDirection:"row", gap:10, marginTop:16}}>
            <TouchableOpacity onPress={()=>setEditPlumberModal(null)} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12}}><Text style={{textAlign:"center", fontWeight:"700"}}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={updatePlumber} disabled={loading} style={{flex:1, backgroundColor:"#0A1931", padding:14, borderRadius:12}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Save Plumber</Text>}</TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    </View>
  )
}