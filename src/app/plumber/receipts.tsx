import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { supabase } from "../../../lib/supabase";
import { getPlumberReceipts, ReceiptData } from "../../../lib/receipts";
import ReceiptView from "../../components/ReceiptView";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function PlumberReceiptScreen() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [plumber, setPlumber] = useState<any>(null);

  const fetchAll = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: pl } = await supabase.from('plumbers').select('*').eq('user_id', session.user.id).single();
      if (!pl) return;
      setPlumber(pl);
      const data = await getPlumberReceipts(pl.id);
      setReceipts(data as any);
    } catch (e) {
      console.log("fetch receipts error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = receipts.filter(r => filter === 'ALL' ? true : r.status === filter);
  const totalUnpaid = receipts.filter(r => r.status === 'UNPAID').reduce((s, r) => s + Number(r.plumber_share || 0), 0);
  const totalPaid = receipts.filter(r => r.status === 'PAID').reduce((s, r) => s + Number(r.plumber_share || 0), 0);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator color="#0A1931" />
        <Text style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Loading payment claims...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* HEADER */}
      <View style={{ backgroundColor: "#0A1931", paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" }}>
            <Ionicons name="chevron-back" size={18} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: "white", fontWeight: "900", fontSize: 18 }}>My Payment Claims</Text>
            <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{plumber?.name} • 50% of Labour Policy</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "800" }}>PENDING CLAIM</Text>
            <Text style={{ color: "#fbbf24", fontWeight: "900", fontSize: 16, marginTop: 4 }}>KES {totalUnpaid.toLocaleString()}</Text>
            <Text style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{receipts.filter(r => r.status === 'UNPAID').length} jobs unpaid</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: "#94a3b8", fontSize: 9, fontWeight: "800" }}>TOTAL PAID</Text>
            <Text style={{ color: "#22c55e", fontWeight: "900", fontSize: 16, marginTop: 4 }}>KES {totalPaid.toLocaleString()}</Text>
            <Text style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{receipts.length} total jobs</Text>
          </View>
        </View>
      </View>

      {/* FILTERS */}
      <View style={{ flexDirection: "row", gap: 8, padding: 16 }}>
        {(['ALL', 'UNPAID', 'PAID'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: filter === f ? "#0A1931" : "white", borderWidth: 1, borderColor: filter === f ? "#0A1931" : "#e2e8f0" }}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: filter === f ? "white" : "#64748b" }}>{f} ({f === 'ALL' ? receipts.length : receipts.filter(r => r.status === f).length})</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} />}>
        {filtered.map((r: any) => (
          <ReceiptView key={r.id} receipt={r} role="plumber" />
        ))}
        {filtered.length === 0 && (
          <View style={{ backgroundColor: "white", padding: 32, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" }}>
            <Ionicons name="receipt-outline" size={36} color="#94a3b8" />
            <Text style={{ fontWeight: "900", marginTop: 12 }}>No {filter} claims</Text>
            <Text style={{ fontSize: 11, color: "#64748b", marginTop: 4, textAlign: "center" }}>Complete jobs to generate payment claims.{"\n"}Your payout is 50% of labour charged.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}