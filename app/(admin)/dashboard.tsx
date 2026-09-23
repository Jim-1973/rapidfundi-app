import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function AdminDashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: jobsData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    const { data: proofsData } = await supabase.from('job_proofs').select('*').order('created_at', { ascending: false });
    if (jobsData) setJobs(jobsData);
    if (proofsData) setProofs(proofsData);
    setLoading(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text>Loading LIVE data...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Admin Dashboard - LIVE</Text>
      
      <Text style={styles.section}>🔧 Plumbers - Pending Review (NITA Verify)</Text>
      <Text style={{color:'#666', marginBottom:10}}>(Next: connect to plumbers table)</Text>

      <Text style={styles.section}>📋 Active Jobs - Escrow - LIVE from Supabase</Text>
      {jobs.length === 0 && <Text>No jobs in Supabase yet. Create table 'jobs'.</Text>}
      {jobs.map((j) => {
        const hasProof = proofs.find(p => p.job_id === j.job_id || p.job_id === j.id);
        return (
          <View key={j.id} style={styles.card}>
            <Text style={styles.jobId}>{j.job_id || j.id} • {j.location}</Text>
            <Text>{j.description} - KES {j.amount} - {hasProof ? 'PROOF_SUBMITTED' : j.status}</Text>
            <Text>Proof: {hasProof ? `✅ GPS ${hasProof.gps_lat}, ${hasProof.gps_lng}` : 'Video + GPS + OTP pending'}</Text>
          </View>
        );
      })}

      <Text style={styles.section}>📸 Latest Proofs Submitted</Text>
      {proofs.map(p => (
        <View key={p.id} style={[styles.card, {borderColor: '#00C851'}]}>
          <Text style={{fontWeight:'bold'}}>{p.job_id} - {new Date(p.created_at).toLocaleString()}</Text>
          <Text>GPS: {p.gps_lat}, {p.gps_lng}</Text>
          <Text>Video: {p.video_url}</Text>
        </View>
      ))}

      <Link href="/" style={styles.link}>← Back to Home</Link>
      <TouchableOpacity onPress={fetchData} style={{marginTop:20, padding:10, backgroundColor:'#eee', borderRadius:8}}>
        <Text style={{textAlign:'center'}}>🔄 Refresh LIVE Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent:'center', alignItems:'center', marginTop: 100 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  card: { backgroundColor: '#f8f9ff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  jobId: { fontWeight: 'bold', fontSize: 16 },
  link: { marginTop: 30, color: '#007AFF', textAlign: 'center' }
});