import { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, Modal } from "react-native";
import { supabase } from "../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";

export default function NotificationBell({ userId, role }: { userId?: string, role?: string }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [unread, setUnread] = useState(0);
  const channelRef = useRef<any>(null);

  const fetchNotifs = async () => {
    if(!userId && role !== 'admin') return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if(!session) return;
      if(role !== 'admin' && session.user.id !== userId) return;

      let q = supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(30);
      if(role === 'admin'){
        q = q.eq('role','admin');
      } else {
        q = q.eq('user_id', userId!);
      }
      const { data } = await q;
      setNotifications(data||[]);
      setUnread(data?.filter((n:any)=>!n.is_read).length || 0);
    } catch {}
  };

  useEffect(()=>{
    if(!userId && role !== 'admin') return;
    
    let isMounted = true;
    let currentChannel: any = null;

    const setup = async () => {
      await fetchNotifs();
      
      if(!isMounted) return;

      // CLEAN OLD CHANNELS FIRST
      if(channelRef.current){
        try { await supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }

      const filter = role === 'admin' ? `role=eq.admin` : `user_id=eq.${userId}`;
      // FIX: Make channel name UNIQUE every time - prevents "cannot add callbacks after subscribe"
      const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const channelName = `notifs-${role || 'user'}-${userId || 'admin'}-${uniqueId}`;
      
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter
        }, (payload) => {
          const n = payload.new as any;
          if(role === 'admin' && n.role === 'admin') fetchNotifs();
          else if(n.user_id === userId) fetchNotifs();
        })
        .subscribe(); // subscribe AFTER on
      
      channelRef.current = channel;
      currentChannel = channel;
    };

    setup();
      
    return () => { 
      isMounted = false;
      if(currentChannel){
        try { supabase.removeChannel(currentChannel); } catch {}
      }
      if(channelRef.current){
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }
    }
  }, [userId, role]);

  const markRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if(!session) return;
      if(role==='admin'){
        await supabase.from('notifications').update({ is_read: true }).eq('role','admin').eq('is_read', false);
      } else {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false);
      }
      setUnread(0);
      setNotifications(prev => prev.map(n => ({...n, is_read: true})));
    } catch {}
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