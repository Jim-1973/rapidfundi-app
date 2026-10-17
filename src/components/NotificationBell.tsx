import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal } from "react-native";
import { supabase } from "../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function NotificationBell({ userId, role }: { userId?: string, role?: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [unread, setUnread] = useState(0);

  const fetchNotifs = async () => {
    let data: any[] | null = null;
    if(role === 'admin'){
      const res = await supabase.from('notifications').select('*').eq('role','admin').order('created_at',{ascending:false}).limit(30);
      data = res.data;
    } else if(userId){
      const res = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at',{ascending:false}).limit(30);
      data = res.data;
    }
    setNotifications(data||[]);
    setUnread(data?.filter((n:any)=>!n.is_read).length || 0);
  };

  useEffect(()=>{
    fetchNotifs();
    const channel = supabase.channel(`notifs-${userId||role}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => fetchNotifs())
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [userId, role]);

  const markRead = async () => {
    if(role==='admin') await supabase.from('notifications').update({ is_read: true }).eq('role','admin').eq('is_read', false);
    else if(userId) await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    setUnread(0);
  };

  return (
    <>
      <TouchableOpacity onPress={()=>{ setShow(true); markRead(); fetchNotifs(); }} style={{ position:'relative', padding:8, backgroundColor:"white", borderRadius:20, borderWidth:1, borderColor:"#e2e8f0" }}>
        <Ionicons name="notifications" size={20} color="#0A1931" />
        {unread > 0 && (
          <View style={{ position:'absolute', top:-4, right:-4, backgroundColor:'red', borderRadius:10, minWidth:18, height:18, justifyContent:'center', alignItems:'center', paddingHorizontal:4 }}>
            <Text style={{ color:'white', fontSize:10, fontWeight:'900' }}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={show} animationType="slide" transparent>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'white', borderTopLeftRadius:20, borderTopRightRadius:20, maxHeight:'80%', padding:20 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:"center" }}>
              <Text style={{ fontSize:20, fontWeight:'900' }}>Notifications {unread>0? `(${unread})` : ""}</Text>
              <TouchableOpacity onPress={()=>setShow(false)} style={{backgroundColor:"#f1f5f9", paddingHorizontal:12, paddingVertical:6, borderRadius:12}}><Text style={{ fontWeight:'700' }}>✕ Close</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ marginTop:16 }}>
              {notifications.map(n=>(
                <View key={n.id} style={{ backgroundColor: n.is_read? 'white' : '#f0fdfa', padding:12, borderRadius:12, marginBottom:10, borderWidth:1, borderColor:'#e2e8f0' }}>
                  <Text style={{ fontWeight:'800' }}>{n.title}</Text>
                  <Text style={{ fontSize:12, color:'#475569', marginTop:4 }}>{n.message}</Text>
                  <Text style={{ fontSize:10, color:'#94a3b8', marginTop:6 }}>{new Date(n.created_at).toLocaleString()}</Text>
                </View>
              ))}
              {notifications.length===0 && <Text style={{ textAlign:'center', color:'#94a3b8', marginTop:20 }}>No notifications yet 🔔</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}