import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
export default function Tracking(){
  const {estate, problem, otp} = useLocalSearchParams();
  return (
    <View style={{flex:1, padding:24, paddingTop:80, backgroundColor:'#fff'}}>
      <Text style={{fontSize:22, fontWeight:'900'}}>Job Created - PENDING</Text>
      <Text style={{marginTop:12}}>Estate: {estate}</Text>
      <Text>Problem: {problem}</Text>
      <Text style={{marginTop:12, fontSize:20}}>Your OTP: <Text style={{fontWeight:'900'}}>{otp}</Text></Text>
      <Text style={{marginTop:20, color:'#64748B'}}>Next: Assignment engine will alert 3 closest plumbers in {estate} → First to accept wins. Live tracking starts on accept.</Text>
    </View>
  )
}