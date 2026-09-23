import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function ProofOfWork() {
  const [otp, setOtp] = useState('');
  const jobOtp = '847392'; // from customer request

  const handleComplete = () => {
    if (otp !== jobOtp) {
      Alert.alert('Invalid OTP', `Customer OTP is ${jobOtp}. You entered ${otp}`);
      return;
    }
    Alert.alert('Job Completed!', '✅ Video + Geotagged photo + OTP verified\nEscrow will release after 24h');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Proof of Work</Text>
      <Text style={styles.sub}>Job #RF-1024 - Buruburu - Leak Repair</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 1: Video Evidence (Mock)</Text>
        <View style={styles.uploadBox}>
          <Text>🎥 Upload 15s repair video</Text>
          <Text style={styles.small}>Must show leak fixed</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 2: Geotagged Photo</Text>
        <View style={styles.uploadBox}>
          <Text>📸 Take geotagged photo</Text>
          <Text style={styles.small}>GPS: -1.28, 36.82 (auto) | Time watermark</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Step 3: Customer OTP</Text>
        <Text style={styles.small}>Ask customer for 6-digit OTP from their app</Text>
        <TextInput 
          style={styles.otpInput} 
          placeholder="Enter 847392" 
          value={otp} 
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
        />
        <Text style={styles.hint}>Hint for demo: OTP is {jobOtp}</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={handleComplete}>
        <Text style={styles.btnText}>Complete Job - Submit Proof</Text>
      </TouchableOpacity>

      <Link href="/" style={styles.link}>← Back to Home</Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold' },
  sub: { color: '#666', marginBottom: 20 },
  card: { backgroundColor: '#f8f9ff', padding: 15, borderRadius: 12, marginBottom: 15 },
  cardTitle: { fontWeight: '700', marginBottom: 10 },
  uploadBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', borderRadius: 8, padding: 20, alignItems: 'center' },
  small: { color: '#666', fontSize: 12, marginTop: 5 },
  otpInput: { borderWidth: 2, borderColor: '#007AFF', borderRadius: 8, padding: 15, fontSize: 24, textAlign: 'center', letterSpacing: 10, marginTop: 10, backgroundColor: '#fff' },
  hint: { color: '#007AFF', fontSize: 11, marginTop: 5, textAlign: 'center' },
  btn: { backgroundColor: '#00C851', padding: 16, borderRadius: 10, marginTop: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { marginTop: 20, color: '#007AFF', textAlign: 'center' }
});