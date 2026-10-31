import { useEffect, useState, useRef } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator, Vibration, Platform, Modal, TextInput, Linking, Switch } from "react-native";
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, notifyCustomer, notifyAdmin, toEAT } from "../../../lib/supabase";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

let Notifications: any = null;
if (Platform.OS !== 'web') {
  try {
    const Constants = require('expo-constants').default;
    const isExpoGo = Constants?.appOwnership === 'expo' || Constants?.executionEnvironment === 'storeClient';
    if (!isExpoGo) {
      Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        } as any),
      });
    }
  } catch {
    Notifications = null;
  }
}

let MapView: any = null;
let Marker: any = null;
let UrlTile: any = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    UrlTile = Maps.UrlTile;
  } catch {}
}

export default function PlumberApp() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<any>(null);
  const [plumberProfile, setPlumberProfile] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");
  const pollingRef = useRef<any>(null);
  const [popup, setPopup] = useState<any>(null);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [arrivalAsset, setArrivalAsset] = useState<any>(null);
  const [arrivalUploading, setArrivalUploading] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineCustom, setDeclineCustom] = useState("");
  const [tracking, setTracking] = useState(false);
  const trackingRef = useRef<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [helpMsg, setHelpMsg] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showWebCamera, setShowWebCamera] = useState(false);
  const webVideoRef = useRef<any>(null);
  const webStreamRef = useRef<any>(null);
  const [completedSummary, setCompletedSummary] = useState<any>(null);
  const [completedMedia, setCompletedMedia] = useState<any[]>([]);

  const safeNotify = async (title: string, body: string) => {
    if (Platform.OS === 'web' || !notifEnabled || !Notifications) return;
    try { await Notifications.scheduleNotificationAsync({ content: { title, body, sound: true }, trigger: null }); } catch {}
  };
  const triggerNewJobPopup = async (job: any) => {
    setPopup(job);
    if(Platform.OS !== 'web' && vibrateEnabled) Vibration.vibrate([0, 500, 200, 500]);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch{}
    await safeNotify(`🔧 NEW JOB ${job.job_number}`, `${job.category} at ${job.building_name}`);
    setTimeout(()=> setPopup(null), 8000);
  };

  const logPlumberAction = async (jobId:string, oldStatus:string, newStatus:string, extra:any={}) => {
    try{
      let lat = gps?.latitude || gps?.lat || null;
      let lng = gps?.longitude || gps?.lng || null;
      try{
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setGps(loc.coords);
      }catch{}
      await supabase.from('job_status_history').insert({
        job_id: jobId,
        plumber_id: plumberProfile?.id,
        old_status: oldStatus,
        new_status: newStatus,
        latitude: lat,
        longitude: lng,
        reason: extra.reason || null,
        media_url: extra.media_url || null,
      });
      if(lat && lng){
        await supabase.from('plumber_live_locations').insert({
          job_id: jobId,
          plumber_id: plumberProfile?.id,
          lat: lat,
          lng: lng,
        });
      }
    }catch(e){ console.log("logPlumberAction failed", e); }
  };

  useEffect(()=>{
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if(!session){ router.replace("/login" as any); return; }
      const { data: pl } = await supabase.from('plumbers').select('*').eq('user_id', session.user.id).single();
      if(!pl){ Alert.alert("Not a plumber account"); await supabase.auth.signOut(); router.replace("/login" as any); return; }
      if(pl.must_change_password){ router.replace("/plumber/change-password" as any); return; }
      setPlumberProfile(pl); setAuthChecked(true); fetchJobs(pl.id);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status==='granted'){ const loc = await Location.getCurrentPositionAsync({}); setGps(loc.coords); }
    };
    checkAuth();
    if(Platform.OS !== 'web' && Notifications) {
      try { Notifications.requestPermissionsAsync(); } catch {}
    }
  },[]);

  const fetchJobs = async (plumberId?: string) => {
    const id = plumberId || plumberProfile?.id;
    if(!id) return;
    const { data } = await supabase.from('jobs').select('*, plumbers(*)').eq('assigned_plumber_id', id).order('created_at',{ascending:false});
    if(data){
      if(jobs.length>0 && data.length>jobs.length){
        const newOnes = data.filter((d:any)=> !jobs.find((j:any)=> j.id===d.id) && d.status==='ASSIGNED');
        if(newOnes.length>0) triggerNewJobPopup(newOnes[0]);
      }
      setJobs(data); setLastUpdate(new Date().toLocaleTimeString());
    }
  };

  useEffect(()=>{
    if(!plumberProfile?.id) return;
    const channel = supabase.channel(`plumber-live-${plumberProfile.id}-v3`).on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
      const newRow:any = payload.new, oldRow:any = payload.old;
      if(newRow?.assigned_plumber_id===plumberProfile.id && (payload.eventType==='INSERT' || oldRow?.assigned_plumber_id!==plumberProfile.id)){
        if(newRow.status==='ASSIGNED') triggerNewJobPopup(newRow);
      }
      if(newRow?.assigned_plumber_id===plumberProfile.id || oldRow?.assigned_plumber_id===plumberProfile.id) fetchJobs(plumberProfile.id);
      if(selected && newRow && newRow.id===selected.id) setSelected(newRow);
    }).subscribe((s)=>{ if(s==='SUBSCRIBED') setIsLive(true); });
    pollingRef.current = setInterval(()=>fetchJobs(plumberProfile.id), 4000);
    return ()=>{ supabase.removeChannel(channel); if(pollingRef.current) clearInterval(pollingRef.current); if(trackingRef.current) clearInterval(trackingRef.current); }
  }, [plumberProfile?.id, selected?.id]);

  const fetchMedia = async (jobId:string) => {
    const { data } = await supabase.from('job_media').select('*').eq('job_id', jobId).order('created_at',{ascending:false});
    setMedia(data||[]);
  };

  const openGoogleMaps = () => {
    const destLat = selected.customer_lat || (selected as any).latitude;
    const destLng = selected.customer_lng || (selected as any).longitude;
    if(!destLat || !destLng){
      const query = `${selected.street || ""}, ${selected.estate || selected.building_name || ""}, Nairobi`;
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}&travelmode=driving`);
      return;
    }
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`);
  };

  const startLiveTracking = async (jobId:string) => {
    try{
      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status!=='granted'){ Alert.alert("Location needed"); return; }
      setTracking(true);
      if(trackingRef.current) clearInterval(trackingRef.current);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGps(loc.coords);
      await supabase.from('jobs').update({ plumber_lat: loc.coords.latitude, plumber_lng: loc.coords.longitude, plumber_last_update: new Date().toISOString() }).eq('id', jobId);
      await supabase.from('plumber_live_locations').insert({ job_id: jobId, plumber_id: plumberProfile.id, lat: loc.coords.latitude, lng: loc.coords.longitude });
      trackingRef.current = setInterval(async () => {
        try{
          const loc2 = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setGps(loc2.coords);
          await supabase.from('jobs').update({ plumber_lat: loc2.coords.latitude, plumber_lng: loc2.coords.longitude, plumber_last_update: new Date().toISOString() }).eq('id', jobId);
          await supabase.from('plumber_live_locations').insert({ job_id: jobId, plumber_id: plumberProfile.id, lat: loc2.coords.latitude, lng: loc2.coords.longitude });
        }catch{}
      }, 10000);
    }catch(e:any){ console.log(e.message) }
  };
  const stopLiveTracking = () => { setTracking(false); if(trackingRef.current) clearInterval(trackingRef.current); };

  const acceptJob = async () => {
    setLoading(true);
    try{
      const oldStatus = selected.status;
      await supabase.from('jobs').update({ status: 'ASSIGNED', accepted_at: new Date().toISOString() }).eq('id', selected.id);
      await logPlumberAction(selected.id, oldStatus, 'ACCEPTED');
      await notifyAdmin("✅ Accepted", `${plumberProfile.name} accepted ${selected.job_number}`, "ACCEPT", selected.id);
      setSelected({...selected, status: 'ASSIGNED', isAccepted: true});
      Alert.alert("Accepted", "Tap 'On The Way' when leaving.");
    }catch(e:any){ Alert.alert("Failed", e.message) } finally{ setLoading(false) }
  };

  const confirmDecline = async () => {
    const finalReason = declineReason === 'Other' ? declineCustom : declineReason;
    if(!finalReason){ Alert.alert("Select reason"); return; }
    setLoading(true);
    try{
      const oldStatus = selected.status;
      await supabase.from('jobs').update({ assigned_plumber_id: null, status: 'QUOTATION_APPROVED', plumber_decline_reason: finalReason, declined_by_plumber_id: plumberProfile.id }).eq('id', selected.id);
      await supabase.from('job_inquiries').insert({ job_id: selected.id, message: `Plumber declined: ${finalReason}`, type: 'PLUMBER_DECLINE', status: 'PENDING', plumber_id: plumberProfile.id });
      await logPlumberAction(selected.id, oldStatus, 'DECLINED', {reason: finalReason});
      await notifyAdmin("❌ Declined", `${plumberProfile.name} declined ${selected.job_number}: ${finalReason}`, "DECLINE", selected.id);
      setShowDeclineModal(false); setDeclineReason(""); setDeclineCustom(""); setSelected(null); fetchJobs();
      Alert.alert("Declined", "Job returned to admin");
    }catch(e:any){ Alert.alert("Failed", e.message) } finally{ setLoading(false) }
  };

  const markEnRoute = async () => {
    setLoading(true);
    try{
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const oldStatus = selected.status;
      await supabase.from('jobs').update({ status: 'EN_ROUTE', plumber_lat: loc.coords.latitude, plumber_lng: loc.coords.longitude, plumber_last_update: new Date().toISOString() }).eq('id', selected.id);
      await logPlumberAction(selected.id, oldStatus, 'EN_ROUTE');
      if(selected.customer_id) await notifyCustomer(selected.customer_id, "🚚 On The Way!", `${plumberProfile.name} is en route. Live tracking ON.`, "STATUS", selected.id);
      setSelected({...selected, status: 'EN_ROUTE'});
      startLiveTracking(selected.id);
      fetchJobs();
      Alert.alert("On The Way 🚚", "Customer notified + Live tracking started.");
    }catch(e:any){ Alert.alert("Failed", e.message) } finally{ setLoading(false) }
  };

  const openArrivalModal = () => { setArrivalAsset(null); setShowArrivalModal(true); };

  const pickArrivalMedia = async () => {
    if (Platform.OS === 'web') {
      setShowWebCamera(true);
      setTimeout(async () => {
        try {
          const stream = await (navigator.mediaDevices as any).getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          webStreamRef.current = stream;
          if (webVideoRef.current) {
            webVideoRef.current.srcObject = stream;
            webVideoRef.current.play();
          }
        } catch (e: any) {
          Alert.alert("Camera blocked", "Allow camera permission in browser. Gallery is disabled - live camera only.");
          setShowWebCamera(false);
        }
      }, 300);
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert("Camera needed"); return; }
      const result = await ImagePicker.launchCameraAsync({ 
        mediaTypes: ['images'], 
        quality: 0.6, 
        allowsEditing: false,
        exif: true 
      });
      if (!result.canceled && result.assets[0]) setArrivalAsset(result.assets[0]);
    } catch (e: any) { Alert.alert("Camera failed", e.message); }
  };

  const captureWebPhoto = () => {
    try {
      const video = webVideoRef.current;
      if (!video) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setArrivalAsset({ uri: url, mimeType: 'image/jpeg', file: blob, width: canvas.width, height: canvas.height });
        if (webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((t: any) => t.stop());
          webStreamRef.current = null;
        }
        setShowWebCamera(false);
      }, 'image/jpeg', 0.8);
    } catch (e: any) { Alert.alert("Capture failed", e.message); }
  };

  const closeWebCamera = () => {
    if (webStreamRef.current) {
      webStreamRef.current.getTracks().forEach((t: any) => t.stop());
      webStreamRef.current = null;
    }
    setShowWebCamera(false);
  };

  const confirmArrivalWithProof = async () => {
    if(!arrivalAsset){ Alert.alert("Required", "Take LIVE photo"); return; }
    setArrivalUploading(true);
    try{
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      let fileData: Uint8Array;
      if (arrivalAsset.file) {
        const ab = await arrivalAsset.file.arrayBuffer();
        fileData = new Uint8Array(ab);
      } else {
        const base64 = await FileSystem.readAsStringAsync(arrivalAsset.uri, { encoding: FileSystem.EncodingType.Base64 });
        fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      }
      const fileName = `${selected.id}/arrival_before_${Date.now()}.jpg`;
      await supabase.storage.from('job-evidence').upload(fileName, fileData, { contentType: 'image/jpeg', upsert: true });
      const { data: urlData } = supabase.storage.from('job-evidence').getPublicUrl(fileName);
      await supabase.from('job_media').insert({ job_id: selected.id, type: 'arrival_before_work', url: urlData.publicUrl, latitude: location.coords.latitude, longitude: location.coords.longitude });
      await supabase.from('jobs').update({ status: 'ARRIVED' }).eq('id', selected.id);
      await logPlumberAction(selected.id, 'EN_ROUTE', 'ARRIVED', {media_url: urlData.publicUrl});
      if(selected.customer_id) await notifyCustomer(selected.customer_id, "📍 Plumber Arrived!", `${plumberProfile.name} arrived.`, "STATUS", selected.id);
      stopLiveTracking(); setShowArrivalModal(false); setArrivalAsset(null);
      setSelected({...selected, status: 'ARRIVED'}); fetchJobs(); fetchMedia(selected.id);
      Alert.alert("✅ ARRIVED", "Live photo saved as proof.");
    }catch(e:any){ Alert.alert("Failed", e.message) } finally{ setArrivalUploading(false) }
  };

  const takeCompletionPhoto = async () => {
    setLoading(true);
    try{
      if (Platform.OS === 'web') {
        Alert.alert("Use mobile for completion photo", "On web, use your phone app for live camera proof.");
        setLoading(false);
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert("Camera needed"); setLoading(false); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if(result.canceled){ setLoading(false); return; }
      const location = await Location.getCurrentPositionAsync({});
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const fileName = `${selected.id}/completion_final_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('job-evidence').upload(fileName, fileData, { contentType: 'image/jpeg', upsert: true });
      if(uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('job-evidence').getPublicUrl(fileName);
      
      await supabase.from('job_media').insert({ 
        job_id: selected.id, 
        type: 'completion_final', 
        url: urlData.publicUrl, 
        latitude: location.coords.latitude, 
        longitude: location.coords.longitude 
      });

      const nowIso = new Date().toISOString();
      const { error } = await supabase.from('jobs').update({ 
        status: 'completed_awaiting_payment',
        final_photo_url: urlData.publicUrl,
        completed_at: nowIso, 
        updated_at: nowIso 
      }).eq('id', selected.id);

      if(error){
        const { error: err2 } = await supabase.from('jobs').update({ 
          status: 'completed_awaiting_payment',
          completed_at: nowIso,
          updated_at: nowIso 
        }).eq('id', selected.id);
        if(err2) throw err2;
      }

      await logPlumberAction(selected.id, 'ARRIVED', 'completed_awaiting_payment', {media_url: urlData.publicUrl});
      
      if(selected.customer_id) {
        await notifyCustomer(
          selected.customer_id, 
          "✅ Work Done - Pay Now", 
          `${plumberProfile.name} completed ${selected.job_number}. Final photo uploaded. Please pay KES ${selected.total_amount} to complete. Completed at ${toEAT(nowIso)} EAT`, 
          "payment_required", 
          selected.id
        );
      }
      await notifyAdmin("💰 Awaiting Payment", `${plumberProfile.name} completed ${selected.job_number}. Awaiting customer payment KES ${selected.total_amount}.`, "PAYMENT_AWAITING", selected.id);
      const { data: allMedia } = await supabase.from('job_media').select('*').eq('job_id', selected.id).order('created_at',{ascending:true});
      setJobs(prev => prev.map(j => j.id === selected.id ? { ...j, status: 'completed_awaiting_payment', final_photo_url: urlData.publicUrl, completed_at: nowIso, updated_at: nowIso } : j));
      stopLiveTracking();
      setCompletedMedia(allMedia||[]);
      setCompletedSummary({...selected, status: 'completed_awaiting_payment', final_photo_url: urlData.publicUrl, completed_at: nowIso});
      setSelected(null);
      fetchJobs();
      Alert.alert("✅ Work Done!", `Final photo uploaded. Job is now Awaiting Payment. Time: ${toEAT(nowIso)} EAT`);
    }catch(e:any){ Alert.alert("Failed", e.message); console.log(e) } finally{ setLoading(false) }
  };

  const handleHelpSubmit = async () => {
    if (!helpMsg.trim()) { Alert.alert("Write issue"); return; }
    try {
      await supabase.from('job_inquiries').insert({ message: "Plumber Help: " + helpMsg, type: 'PLUMBER_HELP', status: 'PENDING', plumber_id: plumberProfile.id });
      await notifyAdmin("Plumber Needs Help", plumberProfile.name + ": " + helpMsg, "HELP");
      Alert.alert("Sent", "Admin will contact you"); setHelpMsg(""); setShowHelp(false);
    } catch (err: any) { Alert.alert("Failed", err.message); }
  };

  const pickProfilePhoto = async () => {
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await uploadAvatarWeb(file);
        };
        input.click();
        return;
      }
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libPerm.status !== 'granted') { Alert.alert("Permission needed", "Allow photo access"); return; }
      Alert.alert("Change Profile Photo", "Choose source", [
        { text: "📷 Take Photo", onPress: async () => {
          try {
            const camPerm = await ImagePicker.requestCameraPermissionsAsync();
            if (camPerm.status !== 'granted') { Alert.alert("Camera permission needed"); return; }
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true, aspect: [1,1] });
            if (!result.canceled && result.assets?.[0]?.uri) { await uploadAvatar(result.assets[0].uri); }
          } catch(err:any){ Alert.alert("Camera failed", err.message); }
        }},
        { text: "🖼️ From Gallery", onPress: async () => {
          try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsEditing: true, aspect: [1,1], exif: false });
            if (!result.canceled && result.assets?.[0]?.uri) { await uploadAvatar(result.assets[0].uri); }
          } catch(err:any){ Alert.alert("Gallery failed", err.message); }
        }},
        { text: "Cancel", style: "cancel" }
      ]);
    } catch (e:any) { Alert.alert("Failed", e.message); }
  };

  const uploadAvatarWeb = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileName = `${plumberProfile.id}/avatar_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('plumber-avatars').upload(fileName, arrayBuffer, { contentType: file.type || 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('plumber-avatars').getPublicUrl(fileName);
      await supabase.from('plumbers').update({ avatar_url: data.publicUrl }).eq('id', plumberProfile.id);
      setPlumberProfile({ ...plumberProfile, avatar_url: data.publicUrl });
      Alert.alert("✅ Success", "Profile photo updated!");
    } catch(e:any){ Alert.alert("Upload failed", e.message); } finally { setUploadingAvatar(false); }
  };

  const uploadAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const fileName = `${plumberProfile.id}/avatar_${Date.now()}.jpg`;
      let publicUrl = "";
      try {
        const { error } = await supabase.storage.from('plumber-avatars').upload(fileName, fileData, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('plumber-avatars').getPublicUrl(fileName);
        publicUrl = data.publicUrl;
      } catch (bucketErr: any) {
        const fallbackName = `avatars/${fileName}`;
        const { error } = await supabase.storage.from('job-evidence').upload(fallbackName, fileData, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from('job-evidence').getPublicUrl(fallbackName);
        publicUrl = data.publicUrl;
      }
      await supabase.from('plumbers').update({ avatar_url: publicUrl }).eq('id', plumberProfile.id);
      setPlumberProfile({ ...plumberProfile, avatar_url: publicUrl, photo_url: publicUrl });
      Alert.alert("✅ Success", "Profile photo updated!");
    } catch (e:any) { Alert.alert("Upload failed", e.message); } finally { setUploadingAvatar(false); }
  };

  const handleLogout = async () => {
    try{ setShowMenu(false); setShowSettings(false); await supabase.auth.signOut(); }catch(e){ console.log("logout err", e); }
    finally{ setPlumberProfile(null); setJobs([]); setAuthChecked(false); router.replace("/login" as any); }
  };

  const timeAgo = (dateStr: string) => {
    if(!dateStr) return "";
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime())/60000);
    if(mins<1) return "Just now"; if(mins<60) return `${mins}m ago`; if(mins<1440) return `${Math.floor(mins/60)}h ago`; return `${Math.floor(mins/1440)}d ago`;
  };

  if(!authChecked) return <View style={{flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"#f8fafc"}}><ActivityIndicator color="#0A1931"/></View>;

  // COMPLETED SUMMARY - NO EARNINGS
  if(completedSummary){
    const isAwaitingPayment = completedSummary.status === 'completed_awaiting_payment';
    return (
      <View style={{flex:1, backgroundColor:"white"}}>
        <ScrollView contentContainerStyle={{padding:20, paddingTop:60, paddingBottom:30}}>
          <View style={{alignItems:"center", marginBottom:24}}>
            <View style={{width:80, height:80, borderRadius:40, backgroundColor: isAwaitingPayment ? "#fef3c7" : "#dcfce7", justifyContent:"center", alignItems:"center"}}><Ionicons name={isAwaitingPayment ? "time" : "checkmark-done"} size={40} color={isAwaitingPayment ? "#d97706" : "#16a34a"}/></View>
            <Text style={{fontSize:24, fontWeight:"900", color:"#0A1931", marginTop:16}}>{isAwaitingPayment ? "Awaiting Payment" : "Job Completed!"}</Text>
            <Text style={{fontSize:13, color:"#64748b", marginTop:4, textAlign:"center"}}>{isAwaitingPayment ? `Customer will pay - M-Pesa prompt outside app` : `Great work, ${plumberProfile?.name}`}</Text>
          </View>
          <View style={{backgroundColor:"#f8fafc", borderRadius:20, padding:16, borderWidth:1, borderColor:"#e2e8f0"}}>
            <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
              <View style={{backgroundColor:"#0A1931", paddingHorizontal:10, paddingVertical:5, borderRadius:8}}><Text style={{color:"white", fontSize:11, fontWeight:"900"}}>{completedSummary.job_number}</Text></View>
              <View style={{backgroundColor: isAwaitingPayment ? "#fef3c7" : "#dcfce7", paddingHorizontal:10, paddingVertical:5, borderRadius:20}}><Text style={{fontSize:10, fontWeight:"900", color: isAwaitingPayment ? "#92400e" : "#16a34a"}}>{isAwaitingPayment ? "AWAITING PAYMENT" : "COMPLETED"}</Text></View>
            </View>
            <Text style={{fontWeight:"900", fontSize:16, marginTop:12, color:"#0A1931"}}>{completedSummary.category}</Text>
            <Text style={{fontWeight:"600", fontSize:13, color:"#475569", marginTop:2}}>{completedSummary.building_name} • {completedSummary.estate}</Text>
            <View style={{flexDirection:"row", gap:10, marginTop:16}}>
              <View style={{flex:1, backgroundColor:"white", borderRadius:12, padding:12, borderWidth:1, borderColor:"#e2e8f0"}}>
                <Text style={{fontSize:10, fontWeight:"800", color:"#94a3b8"}}>COMPLETED AT (EAT)</Text>
                <Text style={{fontSize:12, fontWeight:"700", marginTop:4}}>{toEAT(completedSummary.completed_at)}</Text>
              </View>
              <View style={{flex:1, backgroundColor:"white", borderRadius:12, padding:12, borderWidth:1, borderColor:"#e2e8f0"}}>
                <Text style={{fontSize:10, fontWeight:"800", color:"#94a3b8"}}>STATUS</Text>
                <Text style={{fontSize:12, fontWeight:"700", marginTop:4}}>{isAwaitingPayment ? "Awaiting Pay" : "Completed"}</Text>
              </View>
            </View>
            {completedSummary.final_photo_url && (
              <View style={{marginTop:12}}>
                <Text style={{fontSize:11, fontWeight:"800", color:"#94a3b8"}}>FINAL PHOTO</Text>
                <Image source={{uri: completedSummary.final_photo_url}} style={{width:"100%", height:200, borderRadius:12, marginTop:8}} />
              </View>
            )}
            {completedMedia.length>0 && (
              <View style={{marginTop:16}}>
                <Text style={{fontSize:11, fontWeight:"800", color:"#94a3b8", letterSpacing:1}}>PROOF PHOTOS ({completedMedia.length})</Text>
                <View style={{flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:8}}>
                  {completedMedia.map((m:any,i:number)=>(
                    <Image key={i} source={{uri: m.url}} style={{width:100, height:100, borderRadius:12}}/>
                  ))}
                </View>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={()=>{ setCompletedSummary(null); setCompletedMedia([]); fetchJobs(); }} style={{backgroundColor:"#0A1931", padding:18, borderRadius:14, marginTop:24, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8}}>
            <Ionicons name="arrow-back" size={18} color="white"/><Text style={{color:"white", fontWeight:"900"}}>Back to Dashboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  // SELECTED JOB VIEW - NO EARNINGS
  if(selected){
    const custLat = selected.customer_lat || (selected as any).latitude;
    const custLng = selected.customer_lng || (selected as any).longitude;
    const isAcceptedLocal = (selected as any).isAccepted;
    return (
      <View style={{flex:1, backgroundColor:"#f8fafc"}}>
      <ScrollView style={{flex:1}} contentContainerStyle={{padding:16, paddingTop:50, paddingBottom:30}}>
        <TouchableOpacity onPress={()=>{ setSelected(null); fetchJobs(); }} style={{flexDirection:"row", alignItems:"center", gap:4, marginBottom:16, backgroundColor:"white", alignSelf:"flex-start", paddingHorizontal:12, paddingVertical:6, borderRadius:20, borderWidth:1, borderColor:"#e2e8f0"}}>
          <Ionicons name="chevron-back" size={16} color="#0A1931"/><Text style={{color:"#0A1931", fontWeight:"800", fontSize:12}}>Back to Jobs</Text>
        </TouchableOpacity>
        <View style={{backgroundColor:"white", borderRadius:20, padding:16, borderWidth:1, borderColor:"#e2e8f0"}}>
          <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
            <View style={{backgroundColor:"#0A1931", paddingHorizontal:10, paddingVertical:5, borderRadius:8}}><Text style={{color:"white", fontSize:11, fontWeight:"900"}}>{selected.job_number}</Text></View>
            <View style={{backgroundColor: selected.status==='EN_ROUTE' ? "#ffedd5" : selected.status==='completed_awaiting_payment' ? "#fef3c7" : "#dcfce7", paddingHorizontal:10, paddingVertical:5, borderRadius:20, flexDirection:"row", alignItems:"center", gap:4}}><View style={{width:6, height:6, borderRadius:3, backgroundColor: selected.status==='EN_ROUTE' ? "#f59e0b" : selected.status==='completed_awaiting_payment' ? "#d97706" : "#22c55e"}}/><Text style={{fontSize:10, fontWeight:"900"}}>{selected.status === 'completed_awaiting_payment' ? 'AWAITING PAYMENT' : selected.status}</Text></View>
          </View>
          <Text style={{fontWeight:"900", fontSize:16, marginTop:12, color:"#0A1931"}}>{selected.category}</Text>
          <Text style={{fontWeight:"600", fontSize:13, color:"#475569", marginTop:2}}>{selected.building_name} • {selected.estate}</Text>
          <View style={{height:200, borderRadius:16, overflow:"hidden", marginTop:14, borderWidth:1, borderColor:"#e2e8f0"}}>
            {Platform.OS === 'web' ? <View style={{flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"#f1f5f9"}}><Ionicons name="map" size={32} color="#94a3b8"/></View> : (
              <MapView style={{flex:1}} initialRegion={{latitude: custLat || gps?.latitude || -1.2921, longitude: custLng || gps?.longitude || 36.8219, latitudeDelta:0.02, longitudeDelta:0.02}}>
                <UrlTile urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
                {custLat && <Marker coordinate={{latitude: custLat, longitude: custLng}} pinColor="green" />}
                {gps && <Marker coordinate={{latitude: gps.latitude, longitude: gps.longitude}}><View style={{backgroundColor:"#0A1931", padding:6, borderRadius:20}}><Ionicons name="person" size={14} color="white"/></View></Marker>}
              </MapView>
            )}
          </View>
        </View>
        <View style={{marginTop:16, gap:12}}>
          {selected.status==='ASSIGNED' && !isAcceptedLocal && <View style={{flexDirection:"row", gap:12}}><TouchableOpacity onPress={acceptJob} style={{flex:1, backgroundColor:"#22c55e", padding:16, borderRadius:14, alignItems:"center"}}><Text style={{color:"white", fontWeight:"900"}}>ACCEPT</Text></TouchableOpacity><TouchableOpacity onPress={()=>setShowDeclineModal(true)} style={{flex:1, backgroundColor:"white", borderWidth:1.5, borderColor:"#fecaca", padding:16, borderRadius:14, alignItems:"center"}}><Text style={{color:"#ef4444", fontWeight:"900"}}>DECLINE</Text></TouchableOpacity></View>}
          {(selected.status==='ASSIGNED' && isAcceptedLocal) && <View style={{gap:10}}><TouchableOpacity onPress={markEnRoute} style={{backgroundColor:"#f59e0b", padding:18, borderRadius:14, alignItems:"center"}}><Text style={{color:"white", fontWeight:"900"}}>ON THE WAY</Text></TouchableOpacity><TouchableOpacity onPress={openGoogleMaps} style={{backgroundColor:"white", borderWidth:1.5, borderColor:"#0A1931", padding:16, borderRadius:14, alignItems:"center"}}><Text style={{color:"#0A1931", fontWeight:"800"}}>NAVIGATE</Text></TouchableOpacity></View>}
          {selected.status==='EN_ROUTE' && <View style={{gap:10}}><TouchableOpacity onPress={openGoogleMaps} style={{backgroundColor:"#0A1931", padding:18, borderRadius:14, alignItems:"center"}}><Text style={{color:"white", fontWeight:"900"}}>🗺️ NAVIGATE</Text></TouchableOpacity><TouchableOpacity onPress={openArrivalModal} style={{backgroundColor:"#0ABAB5", padding:18, borderRadius:14, alignItems:"center"}}><Text style={{color:"white", fontWeight:"900"}}>I HAVE ARRIVED</Text></TouchableOpacity></View>}
          {selected.status==='ARRIVED' && <TouchableOpacity onPress={takeCompletionPhoto} disabled={loading} style={{backgroundColor: loading ? "#94a3b8" : "#0A1931", padding:18, borderRadius:14, alignItems:"center"}}>{loading ? <ActivityIndicator color="white"/> : <Text style={{color:"white", fontWeight:"900"}}>WORK DONE - UPLOAD FINAL PHOTO</Text>}</TouchableOpacity>}
          {selected.status==='completed_awaiting_payment' && <View style={{backgroundColor:"#fef3c7", borderWidth:1, borderColor:"#fbbf24", padding:16, borderRadius:14}}><Text style={{fontWeight:"900", color:"#92400e"}}>⏳ Awaiting Customer Payment</Text><Text style={{fontSize:12, color:"#78350f", marginTop:4}}>Final photo uploaded at {toEAT(selected.completed_at)} EAT. Customer will complete payment.</Text>{selected.final_photo_url && <Image source={{uri: selected.final_photo_url}} style={{width:"100%", height:180, borderRadius:10, marginTop:10}}/>}</View>}
          {selected.status==='paid' && <View style={{backgroundColor:"#dcfce7", borderWidth:1, borderColor:"#22c55e", padding:16, borderRadius:14}}><Text style={{fontWeight:"900", color:"#166534"}}>✅ PAID - {toEAT(selected.paid_at)} EAT</Text><Text style={{fontSize:12, color:"#15803d", marginTop:4}}>Customer payment completed.</Text></View>}
        </View>
      </ScrollView>
      <Modal visible={showDeclineModal} transparent animationType="slide"><View style={{flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end"}}><TouchableOpacity style={{flex:1}} onPress={()=>setShowDeclineModal(false)}/><View style={{backgroundColor:"white", borderTopLeftRadius:24, borderTopRightRadius:24, padding:20}}><View style={{flexDirection:"row", justifyContent:"space-between"}}><Text style={{fontSize:18, fontWeight:"900"}}>Decline Job?</Text><TouchableOpacity onPress={()=>setShowDeclineModal(false)} style={{width:32, height:32, borderRadius:16, backgroundColor:"#f1f5f9", justifyContent:"center", alignItems:"center"}}><Ionicons name="close" size={16} color="#0A1931"/></TouchableOpacity></View><TouchableOpacity onPress={confirmDecline} style={{backgroundColor:"#ef4444", padding:16, borderRadius:14, marginTop:16, alignItems:"center"}}><Text style={{color:"white", fontWeight:"800"}}>Confirm Decline</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={showArrivalModal} animationType="slide"><View style={{flex:1, backgroundColor:"white", padding:20, paddingTop:60}}><View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}><View><Text style={{fontSize:22, fontWeight:"900", color:"#0A1931"}}>Record Before Work</Text><Text style={{color:"#64748b", marginTop:4, fontSize:12}}>LIVE camera only - Gallery blocked</Text></View><TouchableOpacity onPress={()=>setShowArrivalModal(false)} style={{width:36, height:36, borderRadius:18, backgroundColor:"#f1f5f9", justifyContent:"center", alignItems:"center"}}><Ionicons name="close" size={18} color="#0A1931"/></TouchableOpacity></View><TouchableOpacity onPress={pickArrivalMedia} style={{backgroundColor:"#0A1931", padding:18, borderRadius:14, marginTop:20, flexDirection:"row", justifyContent:"center", gap:8}}><Ionicons name="camera" size={20} color="white"/><Text style={{color:"white", fontWeight:"900"}}>{arrivalAsset ? "RETAKE LIVE PHOTO" : "TAKE LIVE PHOTO"}</Text></TouchableOpacity>{arrivalAsset ? <View style={{marginTop:20}}><Image source={{uri: arrivalAsset.uri}} style={{width:"100%", height:340, borderRadius:16}}/><View style={{backgroundColor:"#dcfce7", paddingHorizontal:10, paddingVertical:5, borderRadius:8, marginTop:10, alignSelf:"flex-start", flexDirection:"row", gap:4}}><Ionicons name="checkmark-circle" size={14} color="#16a34a"/><Text style={{fontSize:11, fontWeight:"800", color:"#166534"}}>Live photo captured</Text></View></View> : <View style={{marginTop:24, borderWidth:1.5, borderStyle:"dashed", borderColor:"#cbd5e1", borderRadius:16, padding:32, alignItems:"center", backgroundColor:"#f8fafc"}}><Ionicons name="camera-outline" size={30} color="#64748b"/><Text style={{fontWeight:"800", marginTop:12}}>No live photo yet</Text></View>}<TouchableOpacity onPress={confirmArrivalWithProof} disabled={arrivalUploading || !arrivalAsset} style={{backgroundColor: !arrivalAsset ? "#94a3b8" : "#22c55e", padding:18, borderRadius:14, marginTop:24, alignItems:"center", flexDirection:"row", justifyContent:"center", gap:8}}>{arrivalUploading ? <ActivityIndicator color="white"/> : <><Ionicons name="checkmark-done" size={18} color="white"/><Text style={{color:"white", fontWeight:"900"}}>CONFIRM ARRIVAL & START WORK</Text></>}</TouchableOpacity></View></Modal>
      <Modal visible={showWebCamera} animationType="slide"><View style={{flex:1, backgroundColor:"black", padding:20, paddingTop:50}}><View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}><Text style={{color:"white", fontWeight:"900", fontSize:18}}>LIVE Camera - No Gallery</Text><TouchableOpacity onPress={closeWebCamera} style={{width:36, height:36, borderRadius:18, backgroundColor:"rgba(255,255,255,0.2)", justifyContent:"center", alignItems:"center"}}><Ionicons name="close" size={20} color="white"/></TouchableOpacity></View><View style={{flex:1, marginTop:20, borderRadius:16, overflow:"hidden", backgroundColor:"#111"}}><video ref={webVideoRef} autoPlay playsInline muted style={{width:"100%", height:"100%", objectFit:"cover"}} /></View><TouchableOpacity onPress={captureWebPhoto} style={{backgroundColor:"#22c55e", padding:18, borderRadius:14, marginTop:16, flexDirection:"row", justifyContent:"center", gap:8, alignItems:"center"}}><Ionicons name="camera" size={22} color="white"/><Text style={{color:"white", fontWeight:"900", fontSize:16}}>CAPTURE LIVE PHOTO</Text></TouchableOpacity></View></Modal>
      </View>
    )
  }

  const isToday = (dateStr: string) => {
    if(!dateStr) return false;
    try {
      const d = new Date(dateStr);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch { return false; }
  };
  const isWithin24h = (dateStr: string) => {
    if(!dateStr) return true;
    try { return (Date.now() - new Date(dateStr).getTime()) < 24*60*60*1000; } catch { return true; }
  };
  const activeJobs = jobs.filter((j:any)=>['ASSIGNED','EN_ROUTE','ARRIVED','completed_awaiting_payment'].includes(j.status));
  const awaitingPaymentJobs = jobs.filter((j:any)=>j.status==='completed_awaiting_payment');
  const completedJobs = jobs.filter((j:any)=>['COMPLETED','paid'].includes(j.status));
  let doneTodayJobs = completedJobs.filter((j:any)=> isToday(j.completed_at || j.paid_at || j.updated_at || j.created_at));
  if(doneTodayJobs.length === 0 && completedJobs.length > 0){
    const recent = completedJobs.filter((j:any)=> isWithin24h(j.completed_at || j.updated_at || j.created_at));
    if(recent.length > 0) doneTodayJobs = recent;
    else doneTodayJobs = completedJobs;
  }
  const finalDoneToday = doneTodayJobs.length + awaitingPaymentJobs.length;

  return (
    <View style={{flex:1, backgroundColor:"#f8fafc"}}>
      {popup && (
        <View style={{ position:"absolute", top:50, left:16, right:16, zIndex:9999, backgroundColor:"#0A1931", borderRadius:18, padding:16, flexDirection:"row", alignItems:"center", elevation:12, borderWidth:2, borderColor:"#22c55e" }}>
          <View style={{ backgroundColor:"#22c55e", width:50, height:50, borderRadius:25, justifyContent:"center", alignItems:"center" }}><Text style={{ fontSize:26 }}>🔧</Text></View>
          <View style={{ marginLeft:12, flex:1 }}><View style={{backgroundColor:"#22c55e", alignSelf:"flex-start", paddingHorizontal:6, paddingVertical:2, borderRadius:6}}><Text style={{ color:"white", fontWeight:"900", fontSize:9 }}>NEW JOB ASSIGNED</Text></View><Text style={{ color:"white", fontWeight:"800", marginTop:4}}>{popup.job_number}</Text></View>
          <TouchableOpacity onPress={()=>{ const j=popup; setPopup(null); setSelected(j); fetchMedia(j.id); }} style={{ backgroundColor:"#22c55e", paddingHorizontal:18, paddingVertical:10, borderRadius:20 }}><Text style={{ fontWeight:"900", fontSize:12, color:"white" }}>VIEW</Text></TouchableOpacity>
        </View>
      )}
      <ScrollView contentContainerStyle={{paddingBottom:110}} showsVerticalScrollIndicator={false}>
        <View style={{backgroundColor:"#0A1931", paddingHorizontal:20, paddingTop:52, paddingBottom:22, borderBottomLeftRadius:28, borderBottomRightRadius:28}}>
          <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
            <View style={{flexDirection:"row", gap:12, alignItems:"center", flex:1}}>
              <TouchableOpacity onPress={()=>setShowSettings(true)} style={{width:52, height:52, borderRadius:26, backgroundColor:"#0ABAB5", justifyContent:"center", alignItems:"center", borderWidth:2.5, borderColor:"white", overflow:"hidden"}}>
                {plumberProfile?.avatar_url ? <Image source={{uri: plumberProfile.avatar_url}} style={{width:52, height:52, borderRadius:26}}/> : <Text style={{color:"white", fontWeight:"900", fontSize:20}}>{plumberProfile?.name?.[0] || "J"}</Text>}
              </TouchableOpacity>
              <View style={{flex:1}}><View style={{flexDirection:"row", alignItems:"center", gap:6}}><Text style={{color:"white", fontWeight:"900", fontSize:16}} numberOfLines={1}>{plumberProfile?.name || "Jim Kaumba"}</Text><View style={{width:7, height:7, borderRadius:4, backgroundColor:"#22c55e"}}/></View><Text style={{color:"#94a3b8", fontSize:10}}>{plumberProfile?.plumber_number} • {plumberProfile?.estate || "Embakasi"}</Text></View>
            </View>
            <TouchableOpacity onPress={()=>setShowMenu(true)} style={{backgroundColor:"rgba(255,255,255,0.1)", width:38, height:38, borderRadius:12, justifyContent:"center", alignItems:"center"}}><Ionicons name="menu" size={16} color="white"/></TouchableOpacity>
          </View>
          <View style={{flexDirection:"row", gap:10, marginTop:18}}>
            {[
              {label:"Active", value: activeJobs.length, icon:"briefcase", color:"#0ABAB5", bg:"rgba(10,171,181,0.15)"},
              {label:"Awaiting Pay", value: awaitingPaymentJobs.length, icon:"cash", color:"#d97706", bg:"rgba(217,119,6,0.15)"},
              {label:"Done Today", value: finalDoneToday, icon:"checkmark-done", color:"#22c55e", bg:"rgba(34,197,94,0.15)"},
            ].map((s,i)=>(
              <View key={i} style={{flex:1, backgroundColor:"rgba(255,255,255,0.07)", borderWidth:1, borderColor:"rgba(255,255,255,0.1)", borderRadius:16, padding:12}}>
                <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}><View style={{width:26, height:26, borderRadius:8, backgroundColor:s.bg, justifyContent:"center", alignItems:"center"}}><Ionicons name={s.icon as any} size={14} color={s.color}/></View><Text style={{color:"white", fontWeight:"900", fontSize:18}}>{s.value}</Text></View>
                <Text style={{color:"#94a3b8", fontSize:10, fontWeight:"700", marginTop:8}}>{s.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{paddingHorizontal:16, paddingTop:16, paddingBottom:8}}>
          <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
            <View><Text style={{fontWeight:"900", fontSize:18, color:"#0A1931"}}>Your Jobs</Text><Text style={{fontSize:11, color:"#64748b", marginTop:2}}>{activeJobs.length} active • {awaitingPaymentJobs.length} awaiting pay • {completedJobs.length} paid</Text></View>
            <TouchableOpacity onPress={()=>fetchJobs()} style={{backgroundColor:"white", width:36, height:36, borderRadius:12, justifyContent:"center", alignItems:"center", borderWidth:1, borderColor:"#e2e8f0"}}><Ionicons name="refresh" size={16} color="#0A1931"/></TouchableOpacity>
          </View>
        </View>
        <View style={{padding:16, paddingTop:8, gap:12}}>
          {activeJobs.map((j:any)=>{
            const isAwaiting = j.status==='completed_awaiting_payment';
            const isEnRoute = j.status==='EN_ROUTE';
            const isAssigned = j.status==='ASSIGNED';
            const accent = isAwaiting ? "#d97706" : isEnRoute ? "#f59e0b" : isAssigned ? "#22c55e" : "#0ABAB5";
            return (
              <TouchableOpacity key={j.id} onPress={()=>{ setSelected(j); fetchMedia(j.id); }} activeOpacity={0.88} style={{backgroundColor:"white", borderRadius:20, borderWidth:1, borderColor: isAwaiting ? "#fde68a" : isEnRoute ? "#fde68a" : "#e2e8f0", overflow:"hidden"}}>
                <View style={{flexDirection:"row"}}><View style={{width:6, backgroundColor: accent}}/><View style={{flex:1, padding:14}}>
                  <View style={{flexDirection:"row", justifyContent:"space-between"}}><View style={{backgroundColor: isAwaiting ? "#92400e" : "#0A1931", paddingHorizontal:9, paddingVertical:4, borderRadius:8}}><Text style={{color:"white", fontWeight:"900", fontSize:10}}>{j.job_number} {isAwaiting ? "• AWAITING PAY" : ""}</Text></View><Text style={{fontSize:10, color:"#94a3b8"}}>{j.status === 'completed_awaiting_payment' ? toEAT(j.completed_at) : timeAgo(j.created_at)}</Text></View>
                  <Text style={{fontWeight:"900", fontSize:14, color:"#0A1931", marginTop:8}} numberOfLines={1}>{j.category} • {j.building_name}</Text>
                  <View style={{flexDirection:"row", alignItems:"center", gap:4, marginTop:4}}><Ionicons name="location" size={12} color="#0ABAB5"/><Text style={{fontSize:11, color:"#475569"}} numberOfLines={1}>{j.estate}</Text></View>
                  <View style={{flexDirection:"row", justifyContent:"space-between", marginTop:10, paddingTop:8, borderTopWidth:1, borderTopColor:"#f8fafc"}}><Text style={{fontSize:11, fontWeight:"600", color: isAwaiting ? "#92400e" : "#64748b"}}>{isAwaiting ? "⏳ Waiting customer payment" : "Tap to view & navigate"}</Text><View style={{backgroundColor: isAwaiting ? "#d97706" : "#0A1931", paddingHorizontal:12, paddingVertical:5, borderRadius:20}}><Text style={{color:"white", fontWeight:"900", fontSize:10}}>{isAwaiting ? "VIEW" : "OPEN →"}</Text></View></View>
                </View></View>
              </TouchableOpacity>
            )
          })}
          {activeJobs.length===0 && <View style={{backgroundColor:"white", padding:32, borderRadius:20, alignItems:"center", borderWidth:1, borderColor:"#e2e8f0"}}><Ionicons name="briefcase-outline" size={32} color="#94a3b8"/><Text style={{fontWeight:"900", marginTop:12}}>{completedJobs.length>0 ? `${completedJobs.length} paid - No active jobs` : "No jobs yet"}</Text><Text style={{fontSize:11, color:"#64748b", marginTop:4, textAlign:"center"}}>{completedJobs.length>0 ? `${completedJobs.length} jobs completed` : "Waiting for admin to assign"}</Text></View>}
        </View>
      </ScrollView>
      <View style={{position:"absolute", bottom:0, left:0, right:0, backgroundColor:"white", borderTopWidth:1, borderTopColor:"#e2e8f0", flexDirection:"row", paddingHorizontal:16, paddingVertical:10, paddingBottom: Platform.OS==='ios'? 26 : 12, gap:12, elevation:10}}>
        <TouchableOpacity onPress={()=>setShowHelp(true)} style={{flex:1, backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", paddingVertical:14, borderRadius:14, flexDirection:"row", justifyContent:"center", gap:8, alignItems:"center"}}><Ionicons name="help-circle" size={18} color="#0A1931"/><Text style={{fontWeight:"800", fontSize:13, color:"#0A1931"}}>Need Help</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setShowSettings(true)} style={{flex:1, backgroundColor:"#0A1931", paddingVertical:14, borderRadius:14, flexDirection:"row", justifyContent:"center", gap:8, alignItems:"center"}}><Ionicons name="settings" size={18} color="white"/><Text style={{color:"white", fontWeight:"800", fontSize:13}}>Settings</Text></TouchableOpacity>
      </View>
    </View>
  )
}