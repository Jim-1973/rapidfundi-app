import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Link } from 'expo-router';

const MOCK_PLUMBERS = [
  { id: 1, name: 'John Kamau', nita: 'NITA/PL/2023/1234', status: 'PENDING' },
  { id: 2, name: 'Peter Otieno', nita: 'NITA/PL/2022/9981', status: 'PENDING' },
];

const MOCK_JOBS = [
  { id: 'RF-1024', estate: 'Buruburu', issue: 'Leak', amount: 1500, status: 'IN_PROGRESS' },
  { id: 'RF-1023', estate: 'Kilimani', issue: 'Blockage', amount: 2500, status: 'PROOF_SUBMITTED' },
];

export default function AdminDashboard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 50 }}>
      <Text style={styles.title}>Admin Dashboard</Text>
      
      <Text style={styles.section}>🔧 Plumbers - Pending Review (NITA Verify)</Text>
      {MOCK_PLUMBERS.map(p => (
        <View key={p.id} style={styles.card}>
          <Text style={styles.bold}>{p.name}</Text>
          <Text style={styles.small}>{p.nita}</Text>
          <View style={{ flexDirection: 'row', marginTop: 10, gap: 10 }}>
            <TouchableOpacity style={[styles.btn, {backgroundColor: '#00C851'}]} onPress={() => Alert.alert('Approved', `${p.name} approved - can receive jobs`)}>
              <Text style={styles.btnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, {backgroundColor: '#FF4444'}]} onPress={() => Alert.alert('Rejected')}>
              <Text style={styles.btnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.section}>📋 Active Jobs - Escrow</Text>
      {MOCK_JOBS.map(j => (
        <View key={j.id} style={styles.card}>
          <Text style={styles.bold}>{j.id} • {j.estate}</Text>
          <Text style={styles.small}>{j.issue} - KES {j.amount} - {j.status}</Text>
          <Text style={styles.small}>Proof: Video + GPS + OTP</Text>
        </View>
      ))}

      <Link href="/" style={styles.link}>← Back to Home</Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 20 },
  section: { fontWeight: '800', marginTop: 20, marginBottom: 10, fontSize: 15 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 15, marginBottom: 10, backgroundColor: '#f8f9ff' },
  bold: { fontWeight: '700' },
  small: { color: '#666', fontSize: 12, marginTop: 2 },
  btn: { padding: 8, paddingHorizontal: 18, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  link: { marginTop: 30, color: '#007AFF', textAlign: 'center', paddingBottom: 30 }
});