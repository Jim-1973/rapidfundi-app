import { Image, View, Text } from 'react-native';

export function AppLogo({ size = 32, showText = true }){
  return (
    <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
      <Image source={require('../../assets/images/logo.png')} style={{width:size, height:size, resizeMode:'contain'}} />
      {showText && <Text style={{fontWeight:'900', fontSize:size*0.6, color:'#0A1931'}}>Rapid<Text style={{color:'#FF6B00'}}>Fundi</Text></Text>}
    </View>
  )
}