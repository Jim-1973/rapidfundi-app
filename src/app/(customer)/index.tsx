import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Modal } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";

const CATEGORIES = ["Water Supply","Pipes & Leaks","Taps & Faucets","Toilets","Drainage","Bathroom","Other"];

export default function Index() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({
    category: "", description: "", building: "", floor: "", unit: "", street: "", photos: [] as string[]
  });
  const [jobId, setJobId] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUri, setEditingUri] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.replace("/login");
      else setUser(session.user);
    };
    checkAuth();
  }, []);

  const openCamera = async () => {
    if (form.photos.length >= 3) {
      Alert.alert("Limit reached", "You can add up to 3 photos");
      return;
    }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert("Camera permission needed");
        return;
      }
    }
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
        if (photo?.uri) {
          setEditingUri(photo.uri);
          setEditingIndex(null);
          setShowCamera(false);
          setTimeout(() => setEditorOpen(true), 300);
        }
      } catch (e) {
        Alert.alert("Failed to take photo");
      }
    }
  };

  const openEditor = (uri: string, index: number) => {
    setEditingUri(uri);
    setEditingIndex(index);
    setEditorOpen(true);
  };

  const removePhoto = (index: number) => {
    Alert.alert("Remove photo?", "Delete this problem photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        setForm({...form, photos: form.photos.filter((_, i) => i!== index)});
      }}
    ]);
  };

  const rotateEditing = async () => {
    if (!editingUri) return;
    try {
      const result = await ImageManipulator.manipulateAsync(
        editingUri,
        [{ rotate: 90 }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setEditingUri(result.uri);
    } catch(e) {}
  };

  const saveEditedPhoto = () => {
    if (!editingUri) return;
    if (editingIndex!== null) {
      const updated = [...form.photos];
      updated[editingIndex] = editingUri;
      setForm({...form, photos: updated});
    } else {
      setForm({...form, photos: [...form.photos, editingUri]});
    }
    setEditorOpen(false);
    setEditingUri(null);
    setEditingIndex(null);
  };

  const retakePhoto = () => {
    setEditorOpen(false);
    setEditingUri(null);
    if (editingIndex!== null) {
      setForm({...form, photos: form.photos.filter((_, i) => i!== editingIndex)});
    }
    setEditingIndex(null);
    setTimeout(() => setShowCamera(true), 400);
  };

  const submitReal = async () => {
    if(!form.category ||!form.building ||!form.street) {
      Alert.alert("Missing info","Building and Street required");
      return;
    }
    setLoading(true);
    try {
      const jobNumber = `RF-${new Date().getFullYear()}-${Math.floor(Math.random()*900000)+100000}`;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if(authUser){
        await supabase.from('customers').upsert({ id: authUser.id, email: authUser.email }, { onConflict: 'id' });
      }
      const { data: job, error: jobError } = await supabase.from('jobs').insert({
        job_number: jobNumber, category: form.category, description: form.description,
        building_name: form.building, floor: form.floor, unit: form.unit, street: form.street,
        status: 'UNDER_REVIEW', customer_id: user?.id || authUser?.id,
      }).select().single();
      if(jobError) throw jobError;
      for(let i=0; i<form.photos.length; i++){
        try {
          const uri = form.photos[i];
          const fileName = `${job.id}/${Date.now()}_${i}.jpg`;
          const response = await globalThis.fetch(uri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const { error: uploadError } = await supabase.storage.from('job-evidence').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
          if(uploadError) continue;
          const { data: urlData } = supabase.storage.from('job-evidence').getPublicUrl(fileName);
          await supabase.from('job_media').insert({ job_id: job.id, type: 'customer_upload', url: urlData.publicUrl });
        } catch(err){ console.log(err); }
      }
      setJobId(jobNumber); setStep(4);
      setTimeout(() => router.push("/(customer)/my-jobs"), 1500);
    } catch(e:any){ Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  if(step===4) return (
    <View style={{ flex:1, backgroundColor:"#f8fafc", justifyContent:"center", padding:24 }}>
      <View style={{ backgroundColor:"white", borderRadius:20, padding:24 }}>
        <Text style={{ fontSize:48, textAlign:"center" }}>✅</Text>
        <Text style={{ fontSize:22, fontWeight:"900", textAlign:"center", marginTop:12 }}>Request Sent!</Text>
        <Text style={{ textAlign:"center", marginTop:8, color:"#64748b" }}>Job ID: {jobId}</Text>
      </View>
    </View>
  );

  return (
    <>
    {/* REMOVED DOUBLE HEADER - now handled by _layout.tsx */}
    <ScrollView style={{ flex:1, backgroundColor:"white" }} contentContainerStyle={{ padding:20, paddingTop:20 }}>

      {/* Step indicator only */}
      <View style={{ flexDirection:"row", gap:6, marginBottom:24 }}>
        {[1,2,3].map(i=><View key={i} style={{ flex:1, height:6, borderRadius:10, backgroundColor: i<=step? "#0ABAB5" : "#e2e8f0" }} />)}
      </View>

      {step===1 && (
        <View>
          <Text style={{ fontSize:26, fontWeight:"800" }}>What plumbing problem?</Text>
          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:10, marginTop:20 }}>
            {CATEGORIES.map(c=>(
              <TouchableOpacity key={c} onPress={()=>{setForm({...form, category:c}); setStep(2)}}
                style={{ width:"48%", borderWidth:2, borderColor: form.category===c? "#0ABAB5" : "#e2e8f0", backgroundColor: form.category===c? "#f0fdfa" : "white", padding:16, borderRadius:14 }}>
                <Text style={{ fontWeight:"600" }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {step===2 && (
        <View>
          <Text style={{ fontSize:20, fontWeight:"800" }}>Describe + Photo</Text>
          <TextInput placeholder="Describe issue..." value={form.description} onChangeText={t=>setForm({...form, description:t})}
            multiline style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12, height:100, marginTop:16, textAlignVertical:"top" }} />

          <TouchableOpacity onPress={openCamera} style={{ borderWidth:2, borderStyle:"dashed", borderColor:"#0ABAB5", backgroundColor:"#f0fdfa", borderRadius:12, padding:20, alignItems:"center", marginTop:16 }}>
            <Text style={{ fontSize:28 }}>📸</Text>
            <Text style={{ fontWeight:"700", marginTop:6, color:"#0ABAB5" }}>Take Live Photo</Text>
            <Text style={{ fontSize:10, color:"#64748b", marginTop:2 }}>{form.photos.length}/3 photos • Tap photo to edit</Text>
          </TouchableOpacity>

          <View style={{ flexDirection:"row", gap:10, marginTop:14, flexWrap:"wrap" }}>
            {form.photos.map((uri,i)=>(
              <View key={i} style={{ width:80, height:80 }}>
                <TouchableOpacity onPress={() => openEditor(uri, i)} activeOpacity={0.8} style={{ width:80, height:80, borderRadius:12, overflow:"hidden", borderWidth:1, borderColor:"#e2e8f0" }}>
                  <Image source={{uri}} style={{ width:80, height:80 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePhoto(i)} style={{ position:"absolute", top:-6, right:-6, backgroundColor:"black", width:22, height:22, borderRadius:11, alignItems:"center", justifyContent:"center" }}>
                  <Ionicons name="close" size={14} color="white" />
                </TouchableOpacity>
                <View style={{ position:"absolute", bottom:-6, left:-6, backgroundColor:"#0ABAB5", width:22, height:22, borderRadius:11, alignItems:"center", justifyContent:"center" }}>
                  <Ionicons name="pencil" size={12} color="white" />
                </View>
              </View>
            ))}
            {form.photos.length > 0 && form.photos.length < 3 && (
              <TouchableOpacity onPress={openCamera} style={{ width:80, height:80, borderRadius:12, borderWidth:1, borderStyle:"dashed", borderColor:"#0ABAB5", backgroundColor:"#f0fdfa", alignItems:"center", justifyContent:"center" }}>
                <Ionicons name="add" size={24} color="#0ABAB5" />
                <Text style={{ fontSize:10, color:"#0ABAB5", fontWeight:"700", marginTop:2 }}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ gap:10, marginTop:20 }}>
            <TextInput placeholder="Building Name *" value={form.building} onChangeText={t=>setForm({...form, building:t})} style={{ borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12 }} />
            <View style={{ flexDirection:"row", gap:10 }}>
              <TextInput placeholder="Street *" value={form.street} onChangeText={t=>setForm({...form, street:t})} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12 }} />
              <TextInput placeholder="Floor" value={form.floor} onChangeText={t=>setForm({...form, floor:t})} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:12 }} />
            </View>
          </View>
          <View style={{ flexDirection:"row", gap:10, marginTop:24 }}>
            <TouchableOpacity onPress={()=>setStep(1)} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:16, borderRadius:12 }}><Text style={{ textAlign:"center" }}>Back</Text></TouchableOpacity>
            <TouchableOpacity disabled={!form.building ||!form.street} onPress={()=> { if(!form.building ||!form.street) return; setStep(3) }} style={{ flex:1, backgroundColor: (!form.building ||!form.street)? "#94a3b8" : "#0A1931", padding:16, borderRadius:12 }}>
              <Text style={{ color:"white", textAlign:"center", fontWeight:"700" }}>Review</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step===3 && (
        <View>
          <Text style={{ fontSize:20, fontWeight:"800" }}>Confirm Request</Text>
          <View style={{ backgroundColor:"#f8fafc", padding:16, borderRadius:12, marginTop:16, borderWidth:1, borderColor:"#e2e8f0" }}>
            <Text style={{ fontSize:14, lineHeight:22 }}>Category: {form.category}{"\n"}Building: {form.building}{"\n"}Street: {form.street}{"\n"}Photos: {form.photos.length} live</Text>
          </View>
          <ScrollView horizontal style={{ marginTop:12 }}>
            <View style={{ flexDirection:"row", gap:8 }}>
              {form.photos.map((uri,i)=><Image key={i} source={{uri}} style={{ width:70, height:70, borderRadius:8 }} />)}
            </View>
          </ScrollView>
          <View style={{ flexDirection:"row", gap:10, marginTop:24 }}>
            <TouchableOpacity onPress={()=>setStep(2)} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:16, borderRadius:12 }}><Text style={{ textAlign:"center" }}>Edit</Text></TouchableOpacity>
            <TouchableOpacity onPress={submitReal} disabled={loading} style={{ flex:1, backgroundColor:"#0ABAB5", padding:16, borderRadius:12 }}>
              {loading? <ActivityIndicator color="white"/> : <Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>CONFIRM & SEND</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>

    <Modal visible={showCamera} animationType="slide">
      <View style={{ flex:1, backgroundColor:"black" }}>
        <CameraView ref={cameraRef} style={{ flex:1 }} facing="back" />
        <View style={{ position:"absolute", bottom:30, left:0, right:0, flexDirection:"row", justifyContent:"space-around", alignItems:"center" }}>
          <TouchableOpacity onPress={()=> setShowCamera(false)} style={{ backgroundColor:"#ffffff33", padding:16, borderRadius:50 }}>
            <Text style={{ color:"white", fontWeight:"800" }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={takePicture} style={{ backgroundColor:"white", width:80, height:80, borderRadius:40, borderWidth:4, borderColor:"#0ABAB5" }} />
          <View style={{ width:70 }} />
        </View>
      </View>
    </Modal>

    <Modal visible={editorOpen} animationType="slide">
      <View style={{ flex:1, backgroundColor:"black" }}>
        <View style={{ padding:16, paddingTop:50, flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
          <Text style={{ color:"white", fontWeight:"800", fontSize:16 }}>Review Photo</Text>
          <TouchableOpacity onPress={()=> setEditorOpen(false)} style={{ backgroundColor:"#ffffff22", padding:8, borderRadius:20 }}>
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>
        </View>
        {editingUri && <Image source={{ uri: editingUri }} style={{ flex:1 }} resizeMode="contain" />}
        <View style={{ backgroundColor:"white", borderTopLeftRadius:24, borderTopRightRadius:24, padding:20 }}>
          <View style={{ flexDirection:"row", justifyContent:"space-around", marginBottom:20 }}>
            <TouchableOpacity onPress={rotateEditing} style={{ alignItems:"center" }}>
              <View style={{ backgroundColor:"#f1f5f9", padding:14, borderRadius:30 }}><Ionicons name="refresh" size={22} /></View>
              <Text style={{ marginTop:6, fontSize:12, fontWeight:"600" }}>Rotate</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={retakePhoto} style={{ alignItems:"center" }}>
              <View style={{ backgroundColor:"#f1f5f9", padding:14, borderRadius:30 }}><Ionicons name="camera-reverse" size={22} /></View>
              <Text style={{ marginTop:6, fontSize:12, fontWeight:"600" }}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { if(editingIndex!==null) removePhoto(editingIndex); setEditorOpen(false); }} style={{ alignItems:"center" }}>
              <View style={{ backgroundColor:"#fee2e2", padding:14, borderRadius:30 }}><Ionicons name="trash" size={22} color="#ef4444" /></View>
              <Text style={{ marginTop:6, fontSize:12, fontWeight:"600", color:"#ef4444" }}>Remove</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection:"row", gap:10 }}>
            <TouchableOpacity onPress={retakePhoto} style={{ flex:1, borderWidth:1, borderColor:"#e2e8f0", padding:16, borderRadius:12 }}><Text style={{ textAlign:"center", fontWeight:"700" }}>Retake</Text></TouchableOpacity>
            <TouchableOpacity onPress={saveEditedPhoto} style={{ flex:1, backgroundColor:"black", padding:16, borderRadius:12 }}><Text style={{ color:"white", textAlign:"center", fontWeight:"800" }}>Use This Photo</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}