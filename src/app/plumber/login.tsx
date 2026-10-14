// app/(plumber)/login.tsx - just redirect to main login
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function PlumberLoginRedirect(){
  const router = useRouter();
  useEffect(()=>{ router.replace("/(customer)/login" as any) },[]);
  return null;
}