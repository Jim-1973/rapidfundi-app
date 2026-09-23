import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useLocalSearchParams } from 'expo-router';

export default function ProofOfWork() {
  const { jobId } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [gps, setGps] = useState<{latitude: number, longitude: number} | null>(null);

  const captureGPS = async () => {
    // MOCK GPS for pilot - real expo-location we install later
    // Buruburu coordinates
    const mockCoords = { latitude: -1.28, longitude: 36.82 };
    setGps(mockCoords);
    Alert.alert('GPS Captured (Pilot Mode)', `${mockCoords.latitude}, ${mockCoords.longitude}`);
  };

  const submitProof = async () => {
    if (!gps) return Alert.alert('Capture GPS first', 'Tap the GPS card');
    setLoading(true);
    try {
      const { error } = await supabase.from('job_proofs').insert({
        job_id: jobId || 'RF-1024',
        gps_lat: gps.latitude,
        gps_lng: gps.longitude,
        video_url: 'pilot-video-RF-1024.mp4'
      });
      if (error) throw error;
      Alert.alert('Proof Submitted! ✅', `Admin will see ${jobId || 'RF-1024'} as PROOF_SUBMITTED`);
    } catch (e: any) {
      Alert.alert('Supabase Error', e.message + '\n\nDid you create table job_proofs?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LIVE Proof - {jobId || 'RF-1024'}</Text>
      <Text style={styles.sub}>Buruburu - Leak Repair</Text>

      <TouchableOpacity style={styles.card} onPress={captureGPS}>
        <Text style={styles.cardText}>
          📍 {gps ? `GPS: ${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}` : 'Tap to Capture GPS (Pilot)'}
        </Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text>🎥 Video: pilot-video-RF-1024.mp4 (mock for now)</Text>
      </View>

      <TouchableOpacity 
        style={[styles.btn, {backgroundColor: gps ? '#00C851' : '#ccc'}]} 
        onPress={submitProof} 
        disabled={loading || !gps}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit LIVE Proof to Supabase</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold' },
  sub: { color: '#666', marginBottom: 20, marginTop: 5 },
  card: { padding: 20, backgroundColor: '#f0f0f0', borderRadius: 12, marginBottom: 15 },
  cardText: { fontWeight: '600' },
  btn: { padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});