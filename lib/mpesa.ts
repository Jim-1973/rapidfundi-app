import { supabase } from './supabase'

export async function payWithMpesa(jobId: string, phone: string, amount: number) {
  // Format to 2547...
  let p = phone.toString().replace(/\s/g, '').replace(/\+/g, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (!p.startsWith('254')) p = '254' + p.slice(-9)

  console.log(`[MPESA] Job ${jobId} | Phone ${p} | KES ${amount} | ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })} EAT`);

  // IMPORTANT: Use correct function name - you have mpesa-stk-push
  const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
    body: { 
      job_id: jobId, 
      jobId: jobId, 
      phone: p, 
      phone_number: p,
      amount: Math.round(amount) 
    }
  })

  if (error) {
    console.log("MPesa invoke error:", error);
    // Handle non-2xx gracefully
    if (error.message?.toLowerCase().includes("non-2xx") || error.message?.includes("Failed to send")) {
      throw new Error("Payment service is temporarily unavailable. Please try again or contact support.")
    }
    throw new Error(error.message || "Payment service unavailable")
  }

  if (!data) {
    throw new Error("No response from payment service. Please try again.")
  }

  if (!data.success) {
    console.log("MPesa raw:", data);
    throw new Error(data.error || data.message || 'Unable to send payment request. Please check your phone number.')
  }

  return (data.checkoutRequestID || data.checkout_request_id) as string
}