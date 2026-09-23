import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';

const ESTATES = ["Buruburu","Kilimani","Kileleshwa","Westlands","Karen","Kasarani","Lavington","Embakasi"];
const PROBLEMS = ["Plumbing","Drainage","Pipework","Water Heater","Bathroom Fitout","Leak Repair"];

export default function RequestScreen(){
  const [estate, setEstate] = useState("Buruburu");
  const [problem, setProblem] = useState("Plumbing");
  const otp = Math.floor(100000 + Math.random()*900000).toString();

  return (
    <ScrollView style={{flex:1, backgroundColor:'#fff'}} contentContainerStyle={{padding:20, paddingTop:60}}>
      <Text style={{fontSize:24, fontWeight:'900'}}>Request Plumber</Text>
      <Text style={{color:'#64748B', marginTop:4}}>Job status will be PENDING → OTP generated</Text>

      <Text style={{marginTop:20, fontWeight:'700'}}>Select Estate (Multi-zone pilot)</Text>
      <View style={{flexDirection:'row', flexWrap:'wrap', marginTop:8, gap:8}}>
        {ESTATES.map(e=>(
          <Pressable key={e} onPress={()=>setEstate(e)} style={{padding:10, borderRadius:20, borderWidth:1, backgroundColor: estate===e ? '#1E3A8A' : '#fff', borderColor:'#1E3A8A'}}>
            <Text style={{color: estate===e ? '#fff' : '#1E3A8A', fontWeight:'600'}}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{marginTop:20, fontWeight:'700'}}>Problem Type</Text>
      <View style={{flexDirection:'row', flexWrap:'wrap', marginTop:8, gap:8}}>
        {PROBLEMS.map(p=>(
          <Pressable key={p} onPress={()=>setProblem(p)} style={{padding:10, borderRadius:8, backgroundColor: problem===p ? '#FEF3C7' : '#F1F5F9'}}>
            <Text style={{fontWeight: problem===p ? '800' : '400'}}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{marginTop:20, borderWidth:1, borderStyle:'dashed', borderColor:'#94A3B8', padding:16, borderRadius:12, alignItems:'center'}}>
        <Text>📸 Upload photo of issue (optional)</Text>
        <Text style={{color:'#64748B', fontSize:12, marginTop:4}}>Live capture only - per proposal proof rules</Text>
      </View>

      <View style={{marginTop:20, backgroundColor:'#F0F9FF', padding:14, borderRadius:12}}>
        <Text>Job Price: <Text style={{fontWeight:'800'}}>Ksh 1,500</Text> (base)</Text>
        <Text style={{marginTop:4}}>OTP for this job: <Text style={{fontWeight:'900', fontSize:18}}>{otp}</Text></Text>
        <Text style={{fontSize:11, color:'#64748B', marginTop:4}}>Customer will share OTP on site to close job - per Figure 5</Text>
      </View>

      <Pressable onPress={()=>router.push(`/(customer)/tracking?estate=${estate}&problem=${problem}&otp=${otp}`)} style={{marginTop:20, backgroundColor:'#1E3A8A', padding:18, borderRadius:12, alignItems:'center'}}>
        <Text style={{color:'#fff', fontWeight:'800'}}>Create Job - Pay via M-Pesa (Mock)</Text>
      </Pressable>
    </ScrollView>
  )
}