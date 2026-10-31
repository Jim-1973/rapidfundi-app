import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  // CYBER SECURITY REQUIREMENTS - OWASP / NIST compliant
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const isStrong = Object.values(checks).every(Boolean);
  const isMatch = password.length > 0 && password === confirm;
  const canSubmit = isStrong && isMatch && !loading && sessionReady;

  useEffect(() => {
    const handleRecovery = async () => {
      try {
        if (Platform.OS !== 'web' || typeof window === 'undefined') {
          // Native deep link will be handled by supabase session
          const { data } = await supabase.auth.getSession();
          if (data.session) setSessionReady(true);
          setChecking(false);
          return;
        }

        const url = new URL(window.location.href);
        const hash = window.location.hash;
        const searchParams = url.searchParams;

        if (hash.includes("error=access_denied") || hash.includes("otp_expired") || searchParams.get("error")) {
          const desc = searchParams.get("error_description") || "Link expired or already used";
          setErrorMsg(decodeURIComponent(desc.replace(/\+/g, " ")));
          setChecking(false);
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setErrorMsg(error.message.includes("expired") ? "Link expired. Request a new one. Links expire after 1 hour." : error.message);
          } else if (data.session) {
            setSessionReady(true);
            window.history.replaceState({}, "", "/reset-password");
          }
          setChecking(false);
          return;
        }

        if (hash.includes("access_token") || hash.includes("type=recovery")) {
          setTimeout(async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) setSessionReady(true);
            else setErrorMsg("Recovery session not found. Request new link.");
            setChecking(false);
          }, 800);
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (data.session) setSessionReady(true);
        else setErrorMsg("No valid reset link. Request a new one.");
        setChecking(false);
      } catch (e: any) {
        setErrorMsg(e.message);
        setChecking(false);
      }
    };

    handleRecovery();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
        setErrorMsg("");
        setChecking(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!isStrong) {
      setErrorMsg("Password does not meet all security requirements.");
      return;
    }
    if (!isMatch) {
      setErrorMsg("Passwords don't match.");
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setSuccessMsg("Password updated successfully! Redirecting to login...");
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/login" as any), 1500);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" }}>
        <ActivityIndicator color="#0A1931" size="large" />
        <Text style={{ marginTop: 12, color: "#64748b" }}>Verifying reset link...</Text>
      </View>
    );
  }

  if (errorMsg && !sessionReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "white" }}>
        <Text style={{ fontSize: 60 }}>⚠️</Text>
        <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 16, textAlign: "center" }}>{errorMsg}</Text>
        <Text style={{ color: "#64748b", marginTop: 8, textAlign: "center", fontSize: 13 }}>
          Links expire after 1 hour and can only be used once.
        </Text>
        <TouchableOpacity onPress={() => router.replace("/forgot-password" as any)} style={{ backgroundColor: "#0A1931", padding: 16, borderRadius: 12, marginTop: 24, width: "100%" }}>
          <Text style={{ color: "white", textAlign: "center", fontWeight: "800" }}>Request New Link</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/login" as any)} style={{ padding: 12, marginTop: 12 }}>
          <Text style={{ color: "#0ABAB5", textAlign: "center", fontWeight: "700" }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "white", padding: 24, paddingTop: 80 }}>
      <Text style={{ fontSize: 26, fontWeight: "900", color: "#0A1931" }}>Reset Password</Text>
      <Text style={{ color: "#64748b", marginTop: 6 }}>Create a strong password to secure your account</Text>

      <TextInput
        placeholder="New Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: isStrong || !password ? "#e2e8f0" : "#f87171", borderRadius: 12, padding: 14, marginTop: 24, backgroundColor: "#f8fafc" }}
      />
      <TextInput
        placeholder="Confirm Password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: isMatch || !confirm ? "#e2e8f0" : "#f87171", borderRadius: 12, padding: 14, marginTop: 12, backgroundColor: "#f8fafc" }}
      />

      {/* Security Checklist */}
      <View style={{ backgroundColor: "#f8fafc", padding: 12, borderRadius: 12, marginTop: 16, gap: 4 }}>
        <Text style={{ fontWeight: "700", fontSize: 13, marginBottom: 4, color: "#0A1931" }}>Password must contain:</Text>
        <Text style={{ color: checks.length ? "#16a34a" : "#ef4444", fontSize: 13 }}>{checks.length ? "✓" : "✗"} At least 8 characters</Text>
        <Text style={{ color: checks.upper ? "#16a34a" : "#ef4444", fontSize: 13 }}>{checks.upper ? "✓" : "✗"} One uppercase letter (A-Z)</Text>
        <Text style={{ color: checks.lower ? "#16a34a" : "#ef4444", fontSize: 13 }}>{checks.lower ? "✓" : "✗"} One lowercase letter (a-z)</Text>
        <Text style={{ color: checks.number ? "#16a34a" : "#ef4444", fontSize: 13 }}>{checks.number ? "✓" : "✗"} One number (0-9)</Text>
        <Text style={{ color: checks.special ? "#16a34a" : "#ef4444", fontSize: 13 }}>{checks.special ? "✓" : "✗"} One special character (!@#$%^&*)</Text>
        <Text style={{ color: isMatch ? "#16a34a" : "#ef4444", fontSize: 13 }}>{isMatch ? "✓" : "✗"} Passwords match</Text>
      </View>

      {errorMsg ? <Text style={{ color: "#ef4444", marginTop: 12, fontSize: 13, textAlign: "center" }}>{errorMsg}</Text> : null}
      {successMsg ? <Text style={{ color: "#16a34a", marginTop: 12, fontSize: 13, textAlign: "center", fontWeight: "700" }}>{successMsg}</Text> : null}

      <TouchableOpacity 
        onPress={handleReset} 
        disabled={!canSubmit} 
        style={{ backgroundColor: canSubmit ? "#0A1931" : "#94a3b8", padding: 16, borderRadius: 12, marginTop: 20 }}
      >
        {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", textAlign: "center", fontWeight: "800" }}>{canSubmit ? "Update Password" : "Meet Requirements Above"}</Text>}
      </TouchableOpacity>
    </View>
  );
}