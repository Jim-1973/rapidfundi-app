import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator, Linking, Modal, Platform, Dimensions, Vibration } from "react-native";
import { supabase, supabaseTemp } from "../../../lib/supabase";
import { notifyCustomer, notifyPlumber } from "../../../lib/notifications";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AdminJobTimeline from "./job-timeline";

// FIXED FOR EXPO GO - safe Audio + Notifications (MUST KEEP THIS CHECK)
let Audio: any = null;
let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    const Constants = require('expo-constants').default;
    const isExpoGo = Constants?.appOwnership === 'expo' || Constants?.executionEnvironment === 'storeClient';
    if (!isExpoGo) {
      Audio = require('expo-av').Audio;
      Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        } as any),
      });
    }
  } catch {}
}

const W = Dimensions.get("window").width;
const IS_WEB = Platform.OS === 'web' && W > 900;
const ESTATES = ["Westlands","Kasarani","Kilimani","CBD","Lavington","Karen","Embakasi","Parklands","South B","Eastlands","Langata","Rongai","Kileleshwa","Syokimau"];

export default function Admin() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [plumbers, setPlumbers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [selectedInquiries, setSelectedInquiries] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [quote, setQuote] = useState({ labour: "", materials: "", materialsList: "", fee: "4", notes: "" });
  const [adminReply, setAdminReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'dashboard'|'jobs'|'plumbers'|'customers'>('dashboard');
  const [showAdd, setShowAdd] = useState(false);
  const [pName, setPName] = useState(""); const [pEmail, setPEmail] = useState(""); const [pPhone, setPPhone] = useState(""); const [pPass, setPPass] = useState("Rapid@2026"); const [pSkill, setPSkill] = useState("Water Supply"); const [pLocation, setPLocation] = useState("Westlands");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [cName, setCName] = useState(""); const [cEmail, setCEmail] = useState(""); const [cPhone, setCPhone] = useState(""); const [cPass, setCPass] = useState("Customer@2026"); const [cLocation, setCLocation] = useState("Westlands");
  const [editPlumberModal, setEditPlumberModal] = useState<any>(null); const [editCustomerModal, setEditCustomerModal] = useState<any>(null);
  const [search, setSearch] = useState(""); const [pError, setPError] = useState(""); const [pSuccess, setPSuccess] = useState(""); const [isLive, setIsLive] = useState(false); const [lastUpdate, setLastUpdate] = useState<string>(""); const [newJobAlert, setNewJobAlert] = useState<any>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const soundRef = useRef<any>(null);

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
      const { data: jobsData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
      let enrichedJobs = jobsData || [];
      if(enrichedJobs.length > 0){
        const plumberIds = enrichedJobs.filter((j:any)=>j.assigned_plumber_id).map((j:any)=>j.assigned_plumber_id);
        if(plumberIds.length > 0){
          const { data: plForJobs } = await supabase.from('plumbers').select('id, name, plumber_number, phone, estate, location').in('id', plumberIds);
          enrichedJobs = enrichedJobs.map((j:any) => ({ ...j, plumbers: plForJobs?.find((p:any)=>p.id===j.assigned_plumber_id) || null }));
        }
      }
      setJobs(enrichedJobs);
      const { data: pl } = await supabase.from('plumbers').select('*').order('created_at', {ascending:false});
      setPlumbers(pl||[]);
      const { data: cust } = await supabase.from('customers').select('*').order('created_at', {ascending:false});
      setCustomers(cust||[]);
      const { data: inq } = await supabase.from('job_inquiries').select('*, jobs(job_number, building_name, estate)').eq('status','PENDING').order('created_at', {ascending:false}).limit(20);
      setInquiries(inq||[]);
      setLastUpdate(new Date().toLocaleTimeString());
    }catch(e:any){ console.error(e); } finally { if(showLoader) setLoading(false); }
  };

  const setupSound = async () => {
    if (!Audio) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" }, { shouldPlay: false });
      soundRef.current = sound;
    } catch(e){}
  };
  const playSound = async () => { if (!Audio) return; try { await soundRef.current?.replayAsync(); } catch(e){} };

  useEffect(()=>{ 
    fetchJobs(true); setupSound();
    if(Platform.OS !== 'web' && Notifications) {
      try { Notifications.requestPermissionsAsync(); } catch {}
    }
    const channel = supabase.channel('admin-realtime-all-v4')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, async (payload) => {
        const nj = payload.new;
        setJobs(prev => [nj, ...prev]); setNewJobAlert({ ...nj, isNewJob: true });
        if(Platform.OS !== 'web') Vibration.vibrate([0, 400, 100, 400]);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch{}
        playSound();
        if(Notifications) {
          try { await Notifications.scheduleNotificationAsync({ content: { title: `🚨 NEW JOB ${nj.job_number}`, body: `${nj.category} - ${nj.building_name}, ${nj.estate}`, sound: true }, trigger: null }); } catch {}
        }
        setTimeout(()=> setNewJobAlert(null), 7000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plumbers' }, () => fetchJobs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => fetchJobs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_inquiries' }, async (payload) => {
        const inquiry = payload.new;
        const { data: job } = await supabase.from('jobs').select('job_number, building_name, estate').eq('id', inquiry.job_id).single();
        setNewJobAlert({ job_number: job?.job_number || 'JOB', category: "CUSTOMER QUESTION", building_name: inquiry.message.substring(0, 80), estate: job?.building_name || job?.estate, isInquiry: true, inquiry: inquiry, job_id: inquiry.job_id });
        fetchJobs();
        if(Platform.OS !== 'web') Vibration.vibrate([0, 500, 200, 500]);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch{}
        playSound();
        if(Notifications) {
          try { await Notifications.scheduleNotificationAsync({ content: { title: `💬 Question - ${job?.job_number}`, body: inquiry.message.substring(0, 120), sound: true }, trigger: null }); } catch {}
        }
        setTimeout(()=> setNewJobAlert(null), 12000);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => fetchJobs())
      .subscribe((status) => { if(status === 'SUBSCRIBED') setIsLive(true); });
    return () => { supabase.removeChannel(channel); try { soundRef.current?.unloadAsync(); } catch {} setIsLive(false); }
  }, []);

  const formatPhoneForWhatsApp = (phone: string) => {
    let p = phone.replace(/\s+/g, '').replace('+','');
    if(p.startsWith('0')) p = '254' + p.substring(1);
    if(!p.startsWith('254')) p = '254' + p;
    return p;
  };

  const addPlumberDirectly = async () => {
    setPError(""); setPSuccess("");
    if(!pName.trim()){ setPError("Full name required"); return; }
    if(!pEmail.trim()){ setPError("Email required"); return; }
    if(!pPhone.trim()){ setPError("Phone required"); return; }
    const emailTrimmed = pEmail.trim().toLowerCase();
    const formattedWA = formatPhoneForWhatsApp(pPhone);
    const baseUrl = Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.location.origin : 'https://rapidfundi.com') : 'https://rapidfundi.com';
    const loginLink = `${baseUrl}/login`;
    const message = `Hello ${pName}! 👋 You have been registered as a plumber in ${pLocation} on RAPIDFUNDI 🔧\n\nEmail: ${emailTrimmed}\nTemp Pass: ${pPass}\nLogin: ${loginLink}`;
    const whatsappUrl = `https://wa.me/${formattedWA}?text=${encodeURIComponent(message)}`;
    setLoading(true);
    try{
      const { data: authData, error: authError } = await supabaseTemp.auth.signUp({ email: emailTrimmed, password: pPass, options: { data: { role: "plumber", full_name: pName } } });
      if(authError) throw new Error(authError.message);
      const userId = authData.user?.id;
      if(!userId) throw new Error("Turn OFF Confirm email in Supabase > Auth");
      const plumberNumber = `PLM-${Date.now().toString().slice(-5)}`;
      const payload: any = { user_id: userId, name: pName.trim(), email: emailTrimmed, phone: pPhone.trim(), plumber_number: plumberNumber, rating: 5.0, active: true, must_change_password: true, status: 'AVAILABLE', skills: [pSkill], location: pLocation, estate: pLocation, coverage_area: [pLocation] };
      let { error: dbError } = await supabase.from('plumbers').insert(payload);
      if(dbError && dbError.message.includes('location')){
        const { location, estate, coverage_area, ...rest } = payload;
        const { error: e2 } = await supabase.from('plumbers').insert(rest);
        if(e2) throw e2;
      } else if(dbError) throw new Error(dbError.message);
      if(Platform.OS === 'web'){ window.open(whatsappUrl, '_blank'); } else { await Linking.openURL(whatsappUrl); }
      setPSuccess(`${pName} added in ${pLocation}!`); setShowAdd(false); setPName(""); setPEmail(""); setPPhone(""); fetchJobs();
    }catch(e:any){ setPError(e.message); }finally{ setLoading(false); }
  };

  const addCustomerDirectly = async () => {
    setPError(""); setPSuccess("");
    if(!cName.trim()){ setPError("Customer name required"); return; }
    if(!cEmail.trim()){ setPError("Email required"); return; }
    if(!cPhone.trim()){ setPError("Phone required"); return; }
    const emailTrimmed = cEmail.trim().toLowerCase();
    setLoading(true);
    try{
      const { data: authData, error: authError } = await supabaseTemp.auth.signUp({ email: emailTrimmed, password: cPass, options: { data: { role: "customer", full_name: cName } } });
      if(authError) throw new Error(authError.message);
      const userId = authData.user?.id;
      if(!userId) throw new Error("Turn OFF Confirm email");
      const payload: any = { user_id: userId, full_name: cName.trim(), email: emailTrimmed, phone: cPhone.trim(), location: cLocation, estate: cLocation };
      let { error: custErr } = await supabase.from('customers').insert(payload);
      if(custErr && custErr.message.includes('location')){
        const { location, estate, ...rest } = payload;
        const { error: e2 } = await supabase.from('customers').insert(rest);
        if(e2) throw e2;
      } else if(custErr) throw new Error(custErr.message);
      setPSuccess(`Customer ${cName} added in ${cLocation}!`); setShowAddCustomer(false); setCName(""); setCEmail(""); setCPhone(""); fetchJobs();
    }catch(e:any){ setPError(e.message); }finally{ setLoading(false); }
  };

  const confirmDelete = async (title: string, message: string, onConfirm: () => Promise<void>) => {
    if(Platform.OS === 'web'){ const ok = (window as any).confirm(`${title}\n\n${message}`); if(ok) await onConfirm(); } else { Alert.alert(title, message, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: onConfirm }]); }
  };

  const deletePlumber = async (p:any) => {
    await confirmDelete("Delete Plumber?", `${p.name} will be removed permanently.`, async () => {
      setLoading(true);
      try{ await supabase.from('jobs').update({ assigned_plumber_id: null, status: 'QUOTATION_APPROVED' }).eq('assigned_plumber_id', p.id); const { error } = await supabase.from('plumbers').delete().eq('id', p.id); if(error) throw error; fetchJobs(); }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
    });
  };
  const updatePlumber = async () => {
    if(!editPlumberModal) return; setLoading(true);
    try{ const { error } = await supabase.from('plumbers').update({ name: editPlumberModal.name, phone: editPlumberModal.phone, email: editPlumberModal.email, estate: editPlumberModal.estate, location: editPlumberModal.estate, active: editPlumberModal.active }).eq('id', editPlumberModal.id); if(error) throw error; setEditPlumberModal(null); fetchJobs(); }catch(e:any){ Alert.alert("Update Failed", e.message); } finally { setLoading(false); }
  };
  const deleteCustomer = async (c:any) => {
    await confirmDelete("Delete Customer?", `${c.full_name} will be removed.`, async () => {
      setLoading(true);
      try{ const { error } = await supabase.from('customers').delete().eq('id', c.id); if(error) throw error; fetchJobs(); }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
    });
  };
  const updateCustomer = async () => {
    if(!editCustomerModal) return; setLoading(true);
    try{ const { error } = await supabase.from('customers').update({ full_name: editCustomerModal.full_name, phone: editCustomerModal.phone, email: editCustomerModal.email, estate: editCustomerModal.estate, location: editCustomerModal.estate }).eq('id', editCustomerModal.id); if(error) throw error; setEditCustomerModal(null); fetchJobs(); }catch(e:any){ Alert.alert("Update Failed", e.message); } finally { setLoading(false); }
  };
  const toggleActive = async (p:any) => { const { error } = await supabase.from('plumbers').update({ active:!p.active }).eq('id', p.id); if(error){ Alert.alert("Failed", error.message); return; } fetchJobs(); };
  
  const openJob = async (job:any) => { 
    setSelected(job); 
    setSelectedInquiries([]); 
    setSelectedCustomer(null); 
    setAdminReply("");
    const { data } = await supabase.from('job_media').select('*').eq('job_id', job.id).order('created_at',{ascending:false}); 
    setMedia(data || []); 
    const { data: qData } = await supabase.from('job_inquiries').select('*').eq('job_id', job.id).eq('status','PENDING').order('created_at', {ascending:false});
    setSelectedInquiries(qData || []);
    if(job.customer_id){
      const { data: cust } = await supabase.from('customers').select('*').eq('user_id', job.customer_id).single();
      if(cust) setSelectedCustomer(cust);
      else {
        const { data: cust2 } = await supabase.from('customers').select('*').eq('id', job.customer_id).single();
        setSelectedCustomer(cust2 || null);
      }
    }
  };
  const openJobById = async (jobId: string) => {
    const { data } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if(data) openJob(data);
  };

  const resolveInquiry = async (inq:any) => {
    if(!adminReply.trim()){ Alert.alert("Reply required","Type your reply to customer before resolving"); return; }
    setLoading(true);
    try{
      await supabase.from('job_inquiries').update({ status: 'RESOLVED', admin_reply: adminReply, resolved_at: new Date().toISOString() }).eq('id', inq.id);
      if(selected?.customer_id){
        await notifyCustomer(selected.customer_id, `💬 Reply for ${selected.job_number}`, adminReply.substring(0,200), "INQUIRY_REPLY", selected.id);
      }
      Alert.alert("Replied & Resolved ✅", "Customer notified, inquiry removed from dashboard");
      setSelectedInquiries(prev => prev.filter(i=>i.id!==inq.id));
      setAdminReply("");
      if(selectedInquiries.length <= 1){
        setTimeout(async ()=>{ setSelected(null); await fetchJobs(true); }, 600);
      } else {
        await fetchJobs();
      }
    }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
  };

  const quickResolveWithoutReply = async (inq:any) => {
    Alert.alert("Resolve without reply?", "Customer will be notified question is resolved", [
      { text:"Cancel", style:"cancel" },
      { text:"Resolve", onPress: async ()=>{
        setLoading(true);
        try{
          await supabase.from('job_inquiries').update({ status: 'RESOLVED', resolved_at: new Date().toISOString() }).eq('id', inq.id);
          if(selected?.customer_id){ await notifyCustomer(selected.customer_id, `✅ Question Resolved - ${selected.job_number}`, "Your question has been marked as resolved. Check updated quotation.", "INQUIRY_RESOLVED", selected.id); }
          setSelectedInquiries(prev => prev.filter(i=>i.id!==inq.id));
          if(selectedInquiries.length <= 1){ setTimeout(async ()=>{ setSelected(null); await fetchJobs(true); }, 400); }
          else await fetchJobs();
        }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
      }}
    ])
  };

  const createQuotation = async () => {
    if(!selected) return; 
    if(!quote.labour || !quote.materials || !quote.materialsList){ 
      Alert.alert("Missing","Fill Labour, Materials Cost, and Materials List"); return; 
    } 
    setLoading(true);
    try{
      const total = (parseFloat(quote.labour)||0)+(parseFloat(quote.materials)||0)+(parseFloat(quote.fee)||0);
      const qNum = `RFQ-${selected.job_number.split('-').pop()}`;
      const { error: jobError } = await supabase.from('jobs').update({ status: 'QUOTATION_PREPARED', labour_cost: parseFloat(quote.labour), materials_cost: parseFloat(quote.materials), materials_list: quote.materialsList, total_amount: total, service_fee: parseFloat(quote.fee)||4, quotation_details: `Labour KES ${quote.labour} | Materials: ${quote.materialsList} = KES ${quote.materials} | Fee ${quote.fee}` }).eq('id', selected.id);
      if(jobError) throw new Error(jobError.message);
      try {
        await supabase.from('quotations').insert({ job_id: selected.id, quotation_number: qNum, labour: parseFloat(quote.labour)||0, materials: parseFloat(quote.materials)||0, materials_list: quote.materialsList, service_fee: parseFloat(quote.fee)||4, total, notes: quote.notes || adminReply, status: 'PENDING' });
      } catch(qErr){ console.log("Quotation insert warning:", qErr); }
      
      if(selected.customer_id){
        if(selectedInquiries.length > 0){
          const replyMsg = adminReply ? adminReply : "We have updated your quotation based on your question";
          await notifyCustomer(selected.customer_id, `💰 Updated Quotation - ${selected.job_number} - KES ${total.toLocaleString()}`, `${replyMsg} - New total KES ${total.toLocaleString()}: ${quote.materialsList}`, "QUOTATION_READY", selected.id);
          await supabase.from('job_inquiries').update({ status: 'RESOLVED', admin_reply: replyMsg, resolved_at: new Date().toISOString() }).eq('job_id', selected.id).eq('status','PENDING');
        } else {
          await notifyCustomer(selected.customer_id, `💰 Quotation Ready`, `${selected.job_number} - KES ${total.toLocaleString()}: Labour ${quote.labour} + Materials ${quote.materials} + Fee ${quote.fee}`, "QUOTATION_READY", selected.id);
        }
      }
      Alert.alert("Sent & Notified ✅", `KES ${total.toLocaleString()} sent to customer. ${selectedInquiries.length>0 ? "Customer question answered." : ""}`);
      setSelected(null); setSelectedInquiries([]); setQuote({ labour: "", materials: "", materialsList: "", fee: "4", notes: "" }); setAdminReply(""); fetchJobs(true);
    }catch(e:any){ Alert.alert("Failed: " + e.message); } finally { setLoading(false); }
  };

  const assignPlumber = async (plumber:any) => {
    if(selected.status !== 'QUOTATION_APPROVED'){ Alert.alert("Flow Error", `Customer must approve first. Current: ${selected.status}`); return; } setLoading(true);
    try{
      await supabase.from('jobs').update({ assigned_plumber_id: plumber.id, status: 'ASSIGNED' }).eq('id', selected.id);
      if(plumber.user_id){ await notifyPlumber(plumber.user_id, "🔧 New Job Assigned!", `You have been assigned ${selected.job_number} at ${selected.building_name}, ${selected.street}.`, "ASSIGNMENT", selected.id); }
      if(selected.customer_id){ await notifyCustomer(selected.customer_id, "👷 Plumber Assigned!", `${plumber.name} (${plumber.plumber_number}) assigned to ${selected.job_number}.`, "ASSIGNMENT", selected.id); }
      setSelected(null); fetchJobs(); Alert.alert("Assigned", `${plumber.name} notified 🔔`);
    }catch(e:any){ Alert.alert("Failed", e.message); } finally { setLoading(false); }
  };

  const filteredJobs = jobs.filter(j => `${j.job_number} ${j.category} ${j.building_name} ${j.street} ${j.description}`.toLowerCase().includes(search.toLowerCase()));
  const filteredPlumbers = plumbers.filter(p => `${p.plumber_number} ${p.name} ${p.email} ${p.phone} ${p.estate} ${p.location}`.toLowerCase().includes(search.toLowerCase()));
  const filteredCustomers = customers.filter((c:any) => `${c.full_name} ${c.email} ${c.phone} ${c.estate} ${c.location}`.toLowerCase().includes(search.toLowerCase()));
  const activePlumbers = plumbers.filter(p=>p.active).length; const pendingJobs = jobs.filter(j=>j.status==='UNDER_REVIEW').length; const completedToday = jobs.filter(j=>j.status==='COMPLETED' && new Date(j.created_at).toDateString()===new Date().toDateString()).length; const revenue = jobs.length * 2100 + 48500;

  const EstatePicker = ({ value, onChange }: any) => (
    <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:8 }}>
      {ESTATES.map(est=>(
        <TouchableOpacity key={est} onPress={()=>onChange(est)} style={{ backgroundColor: value===est ? "#0A1931" : "#f1f5f9", paddingHorizontal:12, paddingVertical:8, borderRadius:20, borderWidth: value===est ? 2 : 1, borderColor: value===est ? "#FACC15" : "#e2e8f0" }}>
          <Text style={{ color: value===est ? "white" : "#334155", fontSize:11, fontWeight:"700" }}>{est}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if(selected){
    const c = getStatusColor(selected.status);
    // FIXED: exact same region logic as initially - case-insensitive match on building_name, estate, street
    const sameRegionPlumbers = plumbers.filter(p=>p.active && (
      p.estate?.toLowerCase() === selected.building_name?.toLowerCase() || 
      p.location?.toLowerCase() === selected.building_name?.toLowerCase() ||
      p.estate?.toLowerCase() === selected.estate?.toLowerCase() ||
      p.location?.toLowerCase() === selected.estate?.toLowerCase() ||
      p.estate?.toLowerCase() === selected.street?.toLowerCase() ||
      p.coverage_area?.some((a:string)=> a?.toLowerCase() === selected.building_name?.toLowerCase())
    ));
    const otherPlumbers = plumbers.filter(p=>p.active && !sameRegionPlumbers.find(s=>s.id===p.id));
    const customerPhone = selectedCustomer?.phone || "";
    const waNumber = customerPhone ? formatPhoneForWhatsApp(customerPhone) : "";
    return (
      <ScrollView style={{ flex:1, backgroundColor:"white" }} contentContainerStyle={{ padding:20, paddingTop:50 }}>
        <TouchableOpacity onPress={()=>setSelected(null)}><Text style={{ color:"#0ABAB5", fontWeight:"800" }}>← Back to Dashboard</Text></TouchableOpacity>
        <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:16 }}><Text style={{ fontSize:22, fontWeight:"900" }}>{selected.job_number}</Text><Text style={{ fontSize:11, fontWeight:"800", backgroundColor: c.bg, paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}>{c.label}</Text></View>
        <View style={{ backgroundColor:"#f8fafc", padding:16, borderRadius:16, marginTop:16 }}><Text style={{ fontWeight:"800" }}>{selected.category}</Text><Text style={{ marginTop:6 }}>{selected.description}</Text><Text style={{ fontWeight:"600", marginTop:8 }}>📍 {selected.building_name}, {selected.street}</Text><Text style={{ marginTop:4, fontSize:12, color:"#0ABAB5", fontWeight:"700" }}>Region: {selected.building_name}</Text></View>
        {selected.plumbers && (<View style={{ backgroundColor:"#f0fdfa", borderWidth:1, borderColor:"#0ABAB5", padding:14, borderRadius:14, marginTop:12, flexDirection:"row", alignItems:"center", gap:12 }}><View style={{ width:44, height:44, borderRadius:22, backgroundColor:"#0A1931", justifyContent:"center", alignItems:"center" }}><Text style={{ color:"white", fontWeight:"900" }}>{selected.plumbers.name?.[0]}</Text></View><View style={{ flex:1 }}><Text style={{ fontSize:11, fontWeight:"800", color:"#0ABAB5" }}>ASSIGNED PLUMBER</Text><Text style={{ fontWeight:"900" }}>{selected.plumbers.name} • {selected.plumbers.plumber_number}</Text><Text style={{ fontSize:13 }}>📞 {selected.plumbers.phone}</Text></View></View>)}
        <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:16 }}>{media.map((m,i)=>(<Image key={i} source={{uri: m.url}} style={{ width:100, height:100, borderRadius:12 }} />))}</View>
        
        {selectedInquiries.length > 0 && (
          <View style={{ backgroundColor:"#fffbeb", borderWidth:1, borderColor:"#fde68a", borderRadius:16, marginTop:16, padding:16 }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
              <View style={{ backgroundColor:"#f59e0b", width:28, height:28, borderRadius:14, justifyContent:"center", alignItems:"center" }}><Ionicons name="chatbubble-ellipses" size={14} color="white" /></View>
              <Text style={{ fontWeight:"900", fontSize:14, color:"#92400e" }}>Customer Question ({selectedInquiries.length})</Text>
            </View>
            {selectedInquiries.map((inq:any)=>(
              <View key={inq.id} style={{ backgroundColor:"white", borderRadius:12, padding:14, marginTop:12, borderWidth:1, borderColor:"#fef3c7" }}>
                <Text style={{ fontSize:10, fontWeight:"800", color:"#94a3b8" }}>{new Date(inq.created_at).toLocaleString()}</Text>
                <Text style={{ fontSize:14, color:"#0A1931", marginTop:6, fontWeight:"600", lineHeight:20 }}>“{inq.message}”</Text>
              </View>
            ))}
            <Text style={{ fontSize:11, fontWeight:"800", marginTop:16, color:"#0A1931" }}>Your Reply</Text>
            <TextInput value={adminReply} onChangeText={setAdminReply} placeholder="Reply..." multiline style={{ backgroundColor:"white", borderWidth:1, borderColor:"#fde68a", borderRadius:12, padding:12, marginTop:8, minHeight:80, textAlignVertical:"top" }} />
            <TouchableOpacity onPress={()=>resolveInquiry(selectedInquiries[0])} disabled={loading} style={{ backgroundColor: loading ? "#94a3b8" : "#0A1931", padding:14, borderRadius:12, marginTop:12 }}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>Reply & Resolve</Text>}
            </TouchableOpacity>
          </View>
        )}

        {selected.status === 'UNDER_REVIEW' || (selected.status === 'QUOTATION_PREPARED' && selectedInquiries.length > 0) ? (
          <View style={{ backgroundColor:"#ffffff", borderRadius:20, marginTop:20, borderWidth:1, borderColor:"#e5e7eb", overflow:"hidden" }}>
            <View style={{ padding:20, borderBottomWidth:1, borderBottomColor:"#f1f5f9" }}>
              <Text style={{ fontWeight:"900", fontSize:15, color:"#0A1931" }}>{selectedInquiries.length > 0 ? "Update Quotation" : "Create Quotation"}</Text>
              <Text style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Service Fee is now KES 4</Text>
            </View>
            <View style={{ padding:20, gap:16 }}>
              <View>
                <Text style={{ fontSize:10, fontWeight:"800", color:"#475569", marginBottom:8 }}>LABOUR CHARGE</Text>
                <View style={{ flexDirection:"row", alignItems:"center", backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, paddingHorizontal:14 }}>
                  <Text style={{ fontWeight:"800", color:"#64748b", fontSize:12 }}>KES</Text>
                  <TextInput placeholder="2000" keyboardType="numeric" value={quote.labour} onChangeText={t=>setQuote({...quote, labour:t})} style={{ flex:1, paddingVertical:14, paddingHorizontal:10 }} />
                </View>
              </View>
              <View>
                <Text style={{ fontSize:10, fontWeight:"800", color:"#475569", marginBottom:8 }}>MATERIALS LIST</Text>
                <TextInput placeholder="e.g. 2x PVC Pipe @400" value={quote.materialsList} onChangeText={t=>setQuote({...quote, materialsList:t})} multiline style={{ backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, height:90, textAlignVertical:"top" }} />
              </View>
              <View>
                <Text style={{ fontSize:10, fontWeight:"800", color:"#475569", marginBottom:8 }}>MATERIALS COST</Text>
                <View style={{ flexDirection:"row", alignItems:"center", backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, paddingHorizontal:14 }}>
                  <Text style={{ fontWeight:"800", color:"#64748b", fontSize:12 }}>KES</Text>
                  <TextInput placeholder="3000" keyboardType="numeric" value={quote.materials} onChangeText={t=>setQuote({...quote, materials:t})} style={{ flex:1, paddingVertical:14, paddingHorizontal:10 }} />
                </View>
              </View>
              <View style={{ flexDirection:"row", alignItems:"center", backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, paddingHorizontal:14 }}>
                <Text style={{ fontWeight:"800", color:"#64748b", fontSize:12 }}>FEE KES</Text>
                <TextInput value={quote.fee} onChangeText={t=>setQuote({...quote, fee:t})} keyboardType="numeric" style={{ flex:1, paddingVertical:14, paddingHorizontal:10, fontWeight:"700" }} />
                <Text style={{ fontSize:10, color:"#0ABAB5", fontWeight:"800" }}>4 BOB</Text>
              </View>
              <View style={{ backgroundColor:"#0A1931", borderRadius:14, padding:16, flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
                <Text style={{ color:"#94a3b8", fontSize:10, fontWeight:"700" }}>TOTAL = Labour + Materials + Fee</Text>
                <Text style={{ color:"white", fontWeight:"900", fontSize:18 }}>KES {((parseFloat(quote.labour)||0)+(parseFloat(quote.materials)||0)+(parseFloat(quote.fee)||0)).toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={createQuotation} disabled={loading} style={{ backgroundColor: loading ? "#94a3b8" : "#0A1931", padding:16, borderRadius:12 }}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>{selectedInquiries.length > 0 ? "Update & Notify" : "Send Quotation (KES 4 fee)"}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* === RESTORED ASSIGN PLUMBER AS IT WAS INITIALLY === */}
        {selected.status === 'QUOTATION_APPROVED' && (
          <View style={{ backgroundColor:"#f0fdfa", padding:16, borderRadius:16, marginTop:20, borderWidth:1, borderColor:"#0ABAB5" }}>
            <Text style={{ fontWeight:"900", fontSize:16 }}>Admin Assign Plumber - Manual</Text>
            <Text style={{ fontSize:12, color:"#64748b", marginTop:4 }}>Customer in {selected.building_name} • {sameRegionPlumbers.length} plumbers in area • {otherPlumbers.length} others</Text>
            
            {sameRegionPlumbers.length > 0 && (
              <View style={{ marginTop:12 }}>
                <Text style={{ fontSize:11, fontWeight:"900", color:"#0ABAB5" }}>📍 IN {selected.building_name?.toUpperCase()} ({sameRegionPlumbers.length})</Text>
                {sameRegionPlumbers.map(p=>(
                  <TouchableOpacity key={p.id} onPress={()=>assignPlumber(p)} style={{ backgroundColor:"white", padding:14, borderRadius:12, marginTop:8, borderWidth:2, borderColor:"#0ABAB5", flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontWeight:"800" }}>{p.plumber_number} - {p.name}</Text>
                      <Text style={{ fontSize:11, color:"#475569" }}>📍 {p.estate || p.location} • ⭐ {p.rating}</Text>
                      <Text style={{ fontSize:11 }}>📞 {p.phone}</Text>
                    </View>
                    <View style={{ backgroundColor:"#0A1931", paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}><Text style={{ color:"white", fontSize:11, fontWeight:"800" }}>ASSIGN</Text></View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ marginTop:16 }}>
              <Text style={{ fontSize:11, fontWeight:"800", color: sameRegionPlumbers.length>0 ? "#94a3b8" : "#0A1931" }}>{sameRegionPlumbers.length>0 ? `OTHER ESTATES (${otherPlumbers.length})` : `AVAILABLE PLUMBERS (${otherPlumbers.length})`}</Text>
              {otherPlumbers.map(p=>(
                <TouchableOpacity key={p.id} onPress={()=>assignPlumber(p)} style={{ backgroundColor:"white", padding:14, borderRadius:12, marginTop:8, borderWidth:1, borderColor:"#e2e8f0" }}>
                  <Text style={{ fontWeight:"700" }}>{p.plumber_number} - {p.name} • {p.estate || p.location}</Text>
                  <Text style={{ fontSize:11 }}>📞 {p.phone}</Text>
                </TouchableOpacity>
              ))}
              {otherPlumbers.length===0 && sameRegionPlumbers.length===0 && (
                <Text style={{ marginTop:8, fontSize:12, color:"#94a3b8" }}>No active plumbers. Add one in {selected.building_name}</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    )
  }

  const StatCard = ({ icon, label, value, sub, subColor }:any) => (
    <View style={{ backgroundColor:"white", borderRadius:20, padding:20, flex:1, minWidth: IS_WEB ? 200 : 160, borderWidth:1, borderColor:"#eef2f7" }}>
      <View style={{ width:56, height:56, borderRadius:28, backgroundColor: label.includes("Pending")||label.includes("Revenue")? "#fef08a" : "#dbeafe", justifyContent:"center", alignItems:"center" }}><Text style={{fontSize:22}}>{icon}</Text></View>
      <Text style={{ color:"#64748b", fontSize:13, marginTop:14, fontWeight:"600" }}>{label}</Text>
      <Text style={{ fontSize:32, fontWeight:"900", color:"#0A1931", marginTop:4 }}>{value}</Text>
      <Text style={{ fontSize:12, color:subColor, marginTop:4, fontWeight:"700" }}>{sub}</Text>
    </View>
  );

  return (
    <View style={{ flex:1, flexDirection: IS_WEB ? "row" : "column", backgroundColor:"#f1f5f9" }}>
      {newJobAlert && (
        <View style={{ position:"absolute", top: Platform.OS==='web'? 20:60, left: IS_WEB? 280:16, right:16, zIndex:9999, backgroundColor: newJobAlert.isInquiry ? "#FEF3C7" : "#0A1931", borderRadius:16, padding:16, flexDirection:"row", alignItems:"center", elevation:10, borderWidth:2, borderColor: newJobAlert.isInquiry ? "#f59e0b" : "#FACC15" }}>
          <View style={{ backgroundColor: newJobAlert.isInquiry ? "#f59e0b" : "#FACC15", width:44, height:44, borderRadius:22, justifyContent:"center", alignItems:"center" }}><Text style={{ fontSize:22 }}>{newJobAlert.isInquiry ? "💬" : "🚨"}</Text></View>
          <View style={{ marginLeft:12, flex:1 }}>
            <Text style={{ color: newJobAlert.isInquiry ? "#92400e" : "#FACC15", fontWeight:"900", fontSize:12 }}>{newJobAlert.isInquiry ? `QUESTION - ${newJobAlert.job_number}` : `NEW JOB`}</Text>
            <Text style={{ color: newJobAlert.isInquiry ? "#0A1931" : "white", fontWeight:"800", marginTop:2 }} numberOfLines={1}>{newJobAlert.job_number}</Text>
          </View>
          <TouchableOpacity onPress={()=>{ if(newJobAlert.job_id){ openJobById(newJobAlert.job_id); } else { openJob(newJobAlert); } setNewJobAlert(null); }} style={{ backgroundColor: newJobAlert.isInquiry ? "#f59e0b" : "#FACC15", paddingHorizontal:12, paddingVertical:6, borderRadius:20 }}><Text style={{ fontWeight:"900", fontSize:11 }}>VIEW</Text></TouchableOpacity>
        </View>
      )}
      {IS_WEB && (
        <View style={{ width:260, backgroundColor:"#0A1931", padding:24, justifyContent:"space-between" }}>
          <View>
            <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}><View style={{ width:40, height:40, borderRadius:12, backgroundColor:"white", justifyContent:"center", alignItems:"center" }}><Text>🔧</Text></View><View><Text style={{ color:"white", fontWeight:"900", fontSize:18 }}>RapidFundi</Text><Text style={{ color:"#0ABAB5", fontSize:11 }}>Plumber Platform</Text></View></View>
            <View style={{ marginTop:32, gap:6 }}>
              <TouchableOpacity onPress={()=>setTab('dashboard')} style={{ backgroundColor: tab==='dashboard' ? "#FACC15" : "transparent", padding:14, borderRadius:12 }}><Text style={{ color: tab==='dashboard' ? "#0A1931" : "#94a3b8", fontWeight:"800" }}>🏠 Dashboard</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>setTab('plumbers')} style={{ backgroundColor: tab==='plumbers' ? "#FACC15" : "transparent", padding:14, borderRadius:12 }}><Text style={{ color: tab==='plumbers' ? "#0A1931" : "#94a3b8", fontWeight:"600" }}>👥 Plumbers</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>setTab('jobs')} style={{ backgroundColor: tab==='jobs' ? "#FACC15" : "transparent", padding:14, borderRadius:12 }}><Text style={{ color: tab==='jobs' ? "#0A1931" : "#94a3b8", fontWeight:"600" }}>📋 Jobs</Text></TouchableOpacity>
              <TouchableOpacity onPress={()=>setTab('customers')} style={{ backgroundColor: tab==='customers' ? "#FACC15" : "transparent", padding:14, borderRadius:12 }}><Text style={{ color: tab==='customers' ? "#0A1931" : "#94a3b8", fontWeight:"600" }}>👤 Customers</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding: IS_WEB ? 28 : 20, paddingTop: IS_WEB ? 28 : 50 }}>
        <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
          <View style={{ flex:1 }}>
            <View style={{flexDirection:"row", alignItems:"center", gap:8}}><Text style={{ fontSize: IS_WEB ? 36 : 26, fontWeight:"900", color:"#0A1931" }}>Dashboard</Text>{isLive && <View style={{flexDirection:"row", alignItems:"center", backgroundColor:"#dcfce7", paddingHorizontal:8, paddingVertical:3, borderRadius:12, gap:4}}><View style={{width:6, height:6, borderRadius:3, backgroundColor:"#22c55e"}}/><Text style={{fontSize:10, fontWeight:"900", color:"#16a34a"}}>LIVE</Text></View>}</View>
            <Text style={{ color:"#64748b", marginTop:4 }}>{jobs.length} jobs • {plumbers.length} plumbers • {customers.length} customers</Text>
          </View>
          <TouchableOpacity onPress={()=>fetchJobs(true)} style={{ backgroundColor:"white", padding:12, borderRadius:12, borderWidth:1, borderColor:"#e2e8f0" }}><Text>↻</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection:"row", gap:10, marginTop:16, backgroundColor:"white", borderRadius:14, padding:14, borderWidth:1, borderColor:"#e2e8f0", alignItems:"center" }}><Text>🔍</Text><TextInput placeholder="Search jobs, plumbers, estates..." value={search} onChangeText={setSearch} style={{ flex:1 }} /></View>
        <View style={{ flexDirection:"row", gap:16, marginTop:20, flexWrap:"wrap" }}>
          <StatCard icon="👥" label="Active Plumbers" value={activePlumbers || plumbers.length} sub={`↑ +${activePlumbers} this week`} subColor="#16a34a" />
          <StatCard icon="📋" label="Pending Jobs" value={pendingJobs} sub={`↓ -${pendingJobs>2?2:pendingJobs}`} subColor="#d97706" />
          <StatCard icon="✅" label="Completed Today" value={completedToday} sub={`↑ +${completedToday}`} subColor="#16a34a" />
          <StatCard icon="💰" label="Revenue" value={`Ksh ${revenue.toLocaleString()}`} sub="↑ +12%" subColor="#16a34a" />
        </View>
        <View style={{ flexDirection: IS_WEB ? "row" : "column", gap:16, marginTop:24 }}>
          <View style={{ flex: IS_WEB ? 1.6 : 1, backgroundColor:"white", borderRadius:20, padding:20, borderWidth:1, borderColor:"#eef2f7" }}>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}><Text style={{ fontSize:20, fontWeight:"900", color:"#0A1931" }}>Recent Jobs</Text><TouchableOpacity onPress={()=>setTab('jobs')}><Text style={{ color:"#2563eb", fontWeight:"700" }}>View All →</Text></TouchableOpacity></View>
            <View style={{ marginTop:16, backgroundColor:"#f8fafc", borderRadius:12, padding:12, flexDirection:"row" }}><Text style={{ flex:0.8, fontSize:11, fontWeight:"800", color:"#64748b" }}>JOB ID</Text><Text style={{ flex:1, fontSize:11, fontWeight:"800", color:"#64748b" }}>ESTATE</Text><Text style={{ flex:1.2, fontSize:11, fontWeight:"800", color:"#64748b" }}>PLUMBER</Text><Text style={{ flex:1, fontSize:11, fontWeight:"800", color:"#64748b" }}>STATUS</Text></View>
            {filteredJobs.slice(0,5).map((job:any)=>{ const st = getStatusColor(job.status); return (<TouchableOpacity key={job.id} onPress={()=>openJob(job)} style={{ flexDirection:"row", alignItems:"center", paddingVertical:14, borderBottomWidth:1, borderBottomColor:"#f1f5f9" }}><Text style={{ flex:0.8, fontWeight:"800", fontSize:12 }}>{job.job_number}</Text><Text style={{ flex:1, fontSize:12 }}>{job.building_name?.slice(0,12)}</Text><Text style={{ flex:1.2, fontSize:12 }}>{job.plumbers?.name || "—"}</Text><View style={{ flex:1 }}><View style={{ backgroundColor:st.bg, paddingHorizontal:10, paddingVertical:4, borderRadius:12, alignSelf:"flex-start" }}><Text style={{ fontSize:10, fontWeight:"800" }}>{st.label}</Text></View></View></TouchableOpacity>)})}
          </View>
        </View>
        <View style={{ flexDirection:"row", gap:8, marginTop:28 }}>
          <TouchableOpacity onPress={()=>setTab('dashboard')} style={{ backgroundColor: tab==='dashboard'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='dashboard'? "white" : "#0A1931", fontSize:12 }}>Overview</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTab('jobs')} style={{ backgroundColor: tab==='jobs'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='jobs'? "white" : "#0A1931", fontSize:12 }}>Jobs ({filteredJobs.length})</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTab('plumbers')} style={{ backgroundColor: tab==='plumbers'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='plumbers'? "white" : "#0A1931", fontSize:12 }}>Plumbers ({filteredPlumbers.length})</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTab('customers')} style={{ backgroundColor: tab==='customers'? "#0A1931" : "white", padding:12, borderRadius:12, borderWidth:1 }}><Text style={{ textAlign:"center", fontWeight:"800", color: tab==='customers'? "white" : "#0A1931", fontSize:12 }}>Customers ({filteredCustomers.length})</Text></TouchableOpacity>
        </View>
        {tab === 'customers' && (<TouchableOpacity onPress={()=>{ setPError(""); setPSuccess(""); setShowAddCustomer(!showAddCustomer); }} style={{ backgroundColor:"#0A1931", padding:16, borderRadius:14, marginTop:16 }}><Text style={{ color:"white", textAlign:"center", fontWeight:"900" }}>{showAddCustomer? "✕ Close" : "+ Add Customer Manually"}</Text></TouchableOpacity>)}
        {(tab === 'dashboard' || tab === 'jobs' || tab === 'plumbers') && (<TouchableOpacity onPress={()=>{ setPError(""); setPSuccess(""); setShowAdd(!showAdd); }} style={{ backgroundColor:"#0ABAB5", padding:16, borderRadius:14, marginTop:16 }}><Text style={{ color:"white", textAlign:"center", fontWeight:"900" }}>{showAdd? "✕ Close" : "+ Add Plumber"}</Text></TouchableOpacity>)}
        {showAdd && (
          <View style={{backgroundColor:"white", borderRadius:20, padding:20, marginTop:16, borderWidth:1, borderColor:"#e2e8f0"}}>
            <Text style={{fontSize:18, fontWeight:"900"}}>New Plumber - Select Estate</Text>
            <TextInput placeholder="Full Name *" value={pName} onChangeText={setPName} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:16, backgroundColor:"#f8fafc"}}/>
            <TextInput placeholder="Email *" value={pEmail} onChangeText={setPEmail} autoCapitalize="none" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
            <TextInput placeholder="Phone 0712... *" value={pPhone} onChangeText={setPPhone} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10, backgroundColor:"#f8fafc"}}/>
            <Text style={{fontSize:13, fontWeight:"800", marginTop:12}}>Estate *</Text>
            <EstatePicker value={pLocation} onChange={setPLocation} />
            <TextInput placeholder="Temp Password" value={pPass} onChangeText={setPPass} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:12, backgroundColor:"#f8fafc"}}/>
            {pError ? <View style={{ backgroundColor:"#fef2f2", padding:12, borderRadius:10, marginTop:12 }}><Text style={{ color:"#dc2626", fontSize:12 }}>⚠️ {pError}</Text></View> : null}
            {pSuccess ? <View style={{ backgroundColor:"#f0fdf4", padding:12, borderRadius:10, marginTop:12 }}><Text style={{ color:"#16a34a", fontSize:12 }}>✅ {pSuccess}</Text></View> : null}
            <TouchableOpacity onPress={addPlumberDirectly} disabled={loading} style={{backgroundColor: loading ? "#94a3b8" : "#0A1931", padding:14, borderRadius:12, marginTop:16}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Add in {pLocation}</Text>}</TouchableOpacity>
          </View>
        )}
        {showAddCustomer && (
          <View style={{backgroundColor:"white", borderRadius:20, padding:20, marginTop:16, borderWidth:1, borderColor:"#e2e8f0"}}>
            <Text style={{fontSize:18, fontWeight:"900"}}>New Customer</Text>
            <TextInput placeholder="Full Name *" value={cName} onChangeText={setCName} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:16}}/>
            <TextInput placeholder="Email *" value={cEmail} onChangeText={setCEmail} autoCapitalize="none" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10}}/>
            <TextInput placeholder="Phone *" value={cPhone} onChangeText={setCPhone} style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:10}}/>
            <EstatePicker value={cLocation} onChange={setCLocation} />
            <TouchableOpacity onPress={addCustomerDirectly} disabled={loading} style={{backgroundColor: loading ? "#94a3b8" : "#0A1931", padding:14, borderRadius:12, marginTop:16}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Add in {cLocation}</Text>}</TouchableOpacity>
          </View>
        )}
        {tab==='jobs'? (
          <View style={{ gap:12, marginTop:20 }}>
            {filteredJobs.map(job=>{
              const c = getStatusColor(job.status);
              return (
              <View key={job.id} style={{ backgroundColor:"white", padding:16, borderRadius:20, borderWidth:1, borderColor:"#eef2f7" }}>
                <TouchableOpacity onPress={()=>openJob(job)}>
                  <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
                    <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}><View style={{ width:8, height:8, borderRadius:4, backgroundColor:c.dot }} /><Text style={{ fontWeight:"900", fontSize:13 }}>{job.job_number}</Text></View>
                    <View style={{ backgroundColor: c.bg, paddingHorizontal:10, paddingVertical:5, borderRadius:20 }}><Text style={{ fontSize:10, fontWeight:"800" }}>{c.label}</Text></View>
                  </View>
                  <Text style={{ fontWeight:"700", marginTop:10, color:"#0A1931" }}>{job.category}</Text>
                  <Text style={{ fontSize:12, color:"#94a3b8", marginTop:6 }}>📍 {job.building_name}, {job.street}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>openJob(job)} style={{ backgroundColor:"#0A1931", padding:10, borderRadius:10, marginTop:12 }}><Text style={{ textAlign:"center", fontWeight:"800", fontSize:12, color:"white" }}>View Details →</Text></TouchableOpacity>
              </View>
            )})}
          </View>
        ) : tab === 'plumbers' ? (
          <View style={{ gap:12, marginTop:20 }}>
            {filteredPlumbers.map(p=>(
              <View key={p.id} style={{ backgroundColor:"white", padding:16, borderRadius:20, borderWidth:1, borderColor:"#e2e8f0" }}>
                <Text style={{ fontWeight:"900" }}>{p.plumber_number} • {p.name} • {p.estate || p.location}</Text><Text style={{ fontSize:12, color:"#64748b" }}>{p.email} • {p.phone}</Text>
                <View style={{ flexDirection:"row", gap:8, marginTop:12 }}>
                  <TouchableOpacity onPress={()=>setEditPlumberModal({...p})} style={{ flex:1, backgroundColor:"#f1f5f9", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12 }}>✏️ Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>deletePlumber(p)} style={{ flex:1, backgroundColor:"#fef2f2", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12, color:"#dc2626" }}>🗑️ Delete</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : tab === 'dashboard' ? <View style={{ height:20 }} /> : (
          <View style={{ gap:12, marginTop:20 }}>
            {filteredCustomers.map((c:any)=>(
              <View key={c.id} style={{ backgroundColor:"white", padding:16, borderRadius:20, borderWidth:1, borderColor:"#e2e8f0" }}>
                <Text style={{ fontWeight:"900" }}>{c.full_name} • {c.estate || c.location}</Text><Text style={{ fontSize:12, color:"#64748b" }}>{c.email}</Text>
                <View style={{ flexDirection:"row", gap:8, marginTop:12 }}>
                  <TouchableOpacity onPress={()=>setEditCustomerModal(c)} style={{ flex:1, backgroundColor:"#f1f5f9", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12 }}>✏️ Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>deleteCustomer(c)} style={{ flex:1, backgroundColor:"#fef2f2", padding:10, borderRadius:10 }}><Text style={{ textAlign:"center", fontWeight:"700", fontSize:12, color:"#dc2626" }}>🗑️ Delete</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      <Modal visible={!!editPlumberModal} transparent animationType="slide"><View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"center", padding:20}}><View style={{backgroundColor:"white", borderRadius:20, padding:20}}><Text style={{fontWeight:"900", fontSize:18}}>Edit {editPlumberModal?.plumber_number || ""}</Text><TextInput value={editPlumberModal?.name || ""} onChangeText={t=>setEditPlumberModal({...editPlumberModal, name:t})} placeholder="Full Name" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:12}}/><TextInput value={editPlumberModal?.estate || editPlumberModal?.location || ""} onChangeText={t=>setEditPlumberModal({...editPlumberModal, estate:t, location:t})} placeholder="Estate" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/><TextInput value={editPlumberModal?.email || ""} onChangeText={t=>setEditPlumberModal({...editPlumberModal, email:t})} placeholder="Email" autoCapitalize="none" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/><TextInput value={editPlumberModal?.phone || ""} onChangeText={t=>setEditPlumberModal({...editPlumberModal, phone:t})} placeholder="Phone" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/><View style={{flexDirection:"row", gap:10, marginTop:16}}><TouchableOpacity onPress={()=>setEditPlumberModal(null)} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12}}><Text style={{textAlign:"center", fontWeight:"700"}}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={updatePlumber} disabled={loading} style={{flex:1, backgroundColor:"#0A1931", padding:14, borderRadius:12}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Save</Text>}</TouchableOpacity></View></View></View></Modal>
      <Modal visible={!!editCustomerModal} transparent animationType="slide"><View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"center", padding:20}}><View style={{backgroundColor:"white", borderRadius:20, padding:20}}><Text style={{fontWeight:"900", fontSize:18}}>Edit Customer</Text><TextInput value={editCustomerModal?.full_name || ""} onChangeText={t=>setEditCustomerModal({...editCustomerModal, full_name:t})} placeholder="Full Name" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:12}}/><TextInput value={editCustomerModal?.estate || editCustomerModal?.location || ""} onChangeText={t=>setEditCustomerModal({...editCustomerModal, estate:t, location:t})} placeholder="Estate" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/><TextInput value={editCustomerModal?.email || ""} onChangeText={t=>setEditCustomerModal({...editCustomerModal, email:t})} placeholder="Email" autoCapitalize="none" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/><TextInput value={editCustomerModal?.phone || ""} onChangeText={t=>setEditCustomerModal({...editCustomerModal, phone:t})} placeholder="Phone" style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, marginTop:8}}/><View style={{flexDirection:"row", gap:10, marginTop:16}}><TouchableOpacity onPress={()=>setEditCustomerModal(null)} style={{flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:14, borderRadius:12}}><Text style={{textAlign:"center", fontWeight:"700"}}>Cancel</Text></TouchableOpacity><TouchableOpacity onPress={updateCustomer} disabled={loading} style={{flex:1, backgroundColor:"#0A1931", padding:14, borderRadius:12}}>{loading?<ActivityIndicator color="white"/>:<Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>Save Customer</Text>}</TouchableOpacity></View></View></View></Modal>
    </View>
  )
}