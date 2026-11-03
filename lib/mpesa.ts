import { supabase } from './supabase'

export async function payWithMpesa(jobId: string, phone: string, amount: number) {
  let p = phone.toString().replace(/\s/g, '').replace(/\+/g, '')
  if (p.startsWith('0')) p = '254' + p.slice(1)
  if (!p.startsWith('254')) p = '254' + p.slice(-9)

  console.log(`[MPESA] Job ${jobId} | Phone ${p} | KES ${amount}`);

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
    if (error.message?.toLowerCase().includes("non-2xx") || error.message?.includes("Failed to send")) {
      throw new Error("Payment service is temporarily unavailable. Please try again or contact support.")
    }
    throw new Error(error.message || "Payment service unavailable")
  }

  if (!data || !data.success) {
    console.log("MPesa raw:", data);
    throw new Error(data?.error || data?.message || 'Unable to send payment request.')
  }

  // ✅ AUTO RECEIPT - MATCHES YOUR TABLE EXACTLY
  try {
    const { data: job } = await supabase.from('jobs').select('job_number, customer_id, assigned_plumber_id, id').eq('id', jobId).single();
    if(job){
      const { data: existing } = await supabase.from('receipts').select('id').eq('job_id', jobId).maybeSingle();
      if(!existing){
        const receiptNo = `RCPT-${job.job_number}-${Date.now().toString().slice(-5)}`;
        const amt = Math.round(amount);
        const { error: insErr } = await supabase.from('receipts').insert({
          receipt_number: receiptNo,        // REQUIRED NO
          job_id: jobId,                    // YES
          job_number: job.job_number,       // REQUIRED NO
          type: 'FINAL',                    // REQUIRED NO
          customer_id: job.customer_id?.toString() || null,
          plumber_id: job.assigned_plumber_id || null,
          labour: 0,                        // REQUIRED NO default 0
          materials_cost: amt,              // REQUIRED NO default 0
          materials_list: null,
          plumber_share: 0,                  // REQUIRED NO default 0
          total: amt,                       // REQUIRED NO
          status: 'PAID'
        });
        if(insErr) console.log("Receipt insert error:", insErr);
        else console.log(`[RECEIPT] Created ${receiptNo}`);
      }
      await supabase.from('jobs').update({ 
        payment_status: 'PAID',
        paid_at: new Date().toISOString(),
        status: 'paid'
      }).eq('id', jobId);
    }
  } catch(receiptErr){
    console.log("Auto receipt failed (non-blocking):", receiptErr);
  }

  return (data.checkoutRequestID || data.checkout_request_id) as string
}

export async function ensureReceiptExists(jobId: string, amount: number){
  try{
    const { data: existing } = await supabase.from('receipts').select('*').eq('job_id', jobId).maybeSingle();
    if(existing) return existing;
    
    const { data: job } = await supabase.from('jobs').select('job_number, customer_id, assigned_plumber_id').eq('id', jobId).single();
    if(!job) return null;
    
    const receiptNo = `RCPT-${job.job_number}-${Date.now().toString().slice(-5)}`;
    const amt = Math.round(amount);
    
    const { data: newReceipt, error } = await supabase.from('receipts').insert({
      receipt_number: receiptNo,
      job_id: jobId,
      job_number: job.job_number,
      type: 'FINAL',
      customer_id: job.customer_id?.toString() || null,
      plumber_id: job.assigned_plumber_id || null,
      labour: 0,
      materials_cost: amt,
      materials_list: null,
      plumber_share: 0,
      total: amt,
      status: 'PAID'
    }).select().single();
    
    if(error){
      console.log("ensureReceipt insert error:", error);
      return null;
    }
    return newReceipt;
  }catch(e){
    console.log("ensureReceipt failed:", e);
    return null;
  }
}