import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function Landing(){
 return (
  <ScrollView style={{flex:1, backgroundColor:'#fff'}} contentContainerStyle={{padding:24, paddingTop:60}}>
    <Text style={{fontSize:12, fontWeight:'800', color:'#1E3A8A', letterSpacing:2}}>ON-DEMAND PLUMBING</Text>
    <Text style={{fontSize:38, fontWeight:'900', color:'#0F172A', marginTop:8}}>RapidFundi</Text>
    <Text style={{fontSize:16, color:'#475569', marginTop:8}}>Verified, proof-backed plumbing for Nairobi estates. 45-minute arrival.</Text>

    <View style={{marginTop:20, backgroundColor:'#FFF8E1', borderColor:'#FACC15', borderWidth:1, padding:14, borderRadius:12}}>
      <Text style={{fontWeight:'700'}}>⚡ 45-min promise • NITA Verified • Geotagged proof • M-Pesa</Text>
    </View>

    <Link href="/(customer)/request" asChild>
      <Pressable style={{marginTop:28, backgroundColor:'#1E3A8A', padding:18, borderRadius:14, alignItems:'center'}}>
        <Text style={{color:'#fff', fontWeight:'800', fontSize:16}}>Request Plumber</Text>
      </Pressable>
    </Link>

    <Link href="/(plumber)/apply" asChild>
      <Pressable style={{marginTop:12, borderWidth:2, borderColor:'#1E3A8A', padding:18, borderRadius:14, alignItems:'center'}}>
        <Text style={{color:'#1E3A8A', fontWeight:'800', fontSize:16}}>Become a Plumber</Text>
      </Pressable>
    </Link>

    <Link href="/(admin)/dashboard" asChild>
      <Pressable style={{marginTop:30, alignItems:'center'}}><Text style={{color:'#64748B'}}>Admin Dashboard →</Text></Pressable>
    </Link>
  </ScrollView>
 )
}