import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Link } from 'expo-router';

export default function PlumberApply() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [nita, setNita] = useState('');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Become a Plumber</Text>
      <Text style={styles.sub}>NITA Verified Onboarding</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} placeholder="John Kamau" value={name} onChangeText={setName} />

      <Text style={styles.label}>Phone (M-Pesa)</Text>
      <TextInput style={styles.input} placeholder="0712 345 678" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

      <Text style={styles.label}>NITA Certificate No.</Text>
      <TextInput style={styles.input} placeholder="NITA/PL/2023/1234" value={nita} onChangeText={setNita} />

      <Text style={styles.label}>Uploads (Mock for now)</Text>
      <View style={styles.uploadBox}>
        <Text>📄 NITA Certificate Photo</Text>
      </View>
      <View style={styles.uploadBox}>
        <Text>🪪 National ID Photo</Text>
      </View>
      <View style={styles.uploadBox}>
        <Text>👤 Profile Photo</Text>
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('Applied!', 'Admin will verify NITA cert. Status: PENDING_REVIEW')}>
        <Text style={styles.btnText}>Submit Application</Text>
      </TouchableOpacity>

      <Link href="/" style={styles.link}>← Back to Home</Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold' },
  sub: { color: '#666', marginBottom: 20 },
  label: { fontWeight: '600', marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12 },
  uploadBox: { borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', borderRadius: 8, padding: 20, alignItems: 'center', marginTop: 10 },
  btn: { backgroundColor: '#007AFF', padding: 16, borderRadius: 10, marginTop: 25, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  link: { marginTop: 20, color: '#007AFF', textAlign: 'center' }
});