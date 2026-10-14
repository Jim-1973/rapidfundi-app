import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "expo-router";

export default function ChangePassword(){
  const router = useRouter();
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const change = async () => {
    if(newPass.length < 6){ Alert.alert("Password too short"); return; }
    if(newPass !== confirm){ Alert.alert("Passwords don't match"); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.updateUser({ password: newPass });
    if(authError){ setLoading(false); Alert.alert("Error", authError.message); return; }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('plumbers').update({ must_change_password: false }).eq('user_id', user?.id);
    
    setLoading(false);
    Alert.alert("Success", "Password changed! Now you can work.");
    router.replace("/plumber");
  };

  return (
    <View style={{flex:1, backgroundColor:"white", padding:24, justifyContent:"center"}}>
      <Text style={{fontSize:28, fontWeight:"900"}}>Change Password</Text>
      <Text style={{color:"#e11d48", marginTop:6, fontWeight:"700"}}>You must change temp password before continuing</Text>
      <Text style={{fontSize:12, color:"#64748b", marginTop:4}}>Google flagged 123456 as breached - use strong password like Rapid@2026!</Text>
      <TextInput value={newPass} onChangeText={setNewPass} placeholder="New strong password" secureTextEntry style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:24}}/>
      <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" secureTextEntry style={{borderWidth:1, borderColor:"#e2e8f0", borderRadius:12, padding:14, marginTop:12}}/>
      <TouchableOpacity onPress={change} style={{backgroundColor:"#0ABAB5", padding:16, borderRadius:12, marginTop:16}}>
        <Text style={{color:"white", textAlign:"center", fontWeight:"800"}}>{loading?"Changing...":"CHANGE & CONTINUE"}</Text>
      </TouchableOpacity>
    </View>
  );
}