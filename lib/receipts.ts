import { supabase } from "./supabase";

export type ReceiptType = 'QUOTATION' | 'FINAL' | 'PLUMBER_PAYOUT';
export type ReceiptRole = 'customer' | 'plumber' | 'admin';

export interface ReceiptData {
  id?: string;
  receipt_number: string;
  job_id: string;
  job_number: string;
  type: ReceiptType;
  customer_id?: string;
  plumber_id?: string;
  labour: number;
  materials_cost: number;
  materials_list: string;
  plumber_share: number;
  total: number;
  status: 'ESTIMATE' | 'PAID' | 'UNPAID';
  created_at?: string;
  building_name?: string;
  estate?: string;
}

export const generateReceiptNumber = () => {
  return `RF-RCT-${Date.now().toString().slice(-6)}${Math.floor(Math.random()*90+10)}`;
};

// Called when admin creates quotation
export const createQuotationReceipt = async (job: any) => {
  const receipt_number = generateReceiptNumber();
  const labour = parseInt(job.labour_cost || 0);
  const materials_cost = parseInt(job.materials_cost || 0);
  const total = labour + materials_cost;
  const plumber_share = Math.floor(labour * 0.5);

  const { data, error } = await supabase.from('receipts').insert({
    receipt_number,
    job_id: job.id,
    job_number: job.job_number,
    type: 'QUOTATION',
    customer_id: job.customer_id,
    labour,
    materials_cost,
    materials_list: job.materials_list || '',
    plumber_share,
    total,
    status: 'ESTIMATE'
  }).select().single();
  
  if(error) console.log("Receipt error", error);
  return data;
};

// Called when plumber marks COMPLETED - customer PAID, plumber UNPAID
export const createFinalReceipts = async (job: any, plumber: any) => {
  const labour = parseInt(job.labour_cost || 0);
  const materials_cost = parseInt(job.materials_cost || 0);
  const total = labour + materials_cost;
  const plumber_share = Math.floor(labour * 0.5);

  const final_number = generateReceiptNumber();
  await supabase.from('receipts').insert({
    receipt_number: final_number,
    job_id: job.id,
    job_number: job.job_number,
    type: 'FINAL',
    customer_id: job.customer_id,
    plumber_id: plumber?.id,
    labour,
    materials_cost,
    materials_list: job.materials_list || '',
    plumber_share,
    total,
    status: 'PAID'
  });

  const payout_number = generateReceiptNumber();
  await supabase.from('receipts').insert({
    receipt_number: payout_number,
    job_id: job.id,
    job_number: job.job_number,
    type: 'PLUMBER_PAYOUT',
    customer_id: job.customer_id,
    plumber_id: plumber?.id,
    labour,
    materials_cost: 0,
    materials_list: '',
    plumber_share,
    total: plumber_share,
    status: 'UNPAID'
  });
};

export const markPlumberPaid = async (receiptId: string) => {
  const { error } = await supabase.from('receipts').update({ status: 'PAID' }).eq('id', receiptId);
  if(error) throw error;
};

export const getPendingPayouts = async () => {
  const { data } = await supabase.from('receipts')
    .select('*, plumbers(name, phone, plumber_number), jobs(building_name, estate)')
    .eq('type', 'PLUMBER_PAYOUT')
    .eq('status', 'UNPAID')
    .order('created_at', {ascending: false});
  return data || [];
};

export const getReceiptsByJob = async (jobId: string) => {
  const { data } = await supabase.from('receipts').select('*').eq('job_id', jobId).order('created_at', {ascending: false});
  return data || [];
};

export const getCustomerReceipts = async (customerId: string) => {
  const { data } = await supabase.from('receipts').select('*').eq('customer_id', customerId).in('type', ['QUOTATION','FINAL']).order('created_at', {ascending: false});
  return data || [];
};

export const getPlumberReceipts = async (plumberId: string) => {
  const { data } = await supabase.from('receipts').select('*, jobs(building_name, estate)').eq('plumber_id', plumberId).eq('type', 'PLUMBER_PAYOUT').order('created_at', {ascending: false});
  return data || [];
};

// --- NEW: HTML FOR PDF - THIS WAS MISSING ---
export const generateReceiptHTML = (data: any) => {
  return `
  <html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: Helvetica, Arial, sans-serif; padding: 24px; color: #0A1931; }
    .header { background: #0A1931; color: white; padding: 20px; border-radius: 12px; text-align: center; }
    .badge { background: #dcfce7; color: #15803d; padding: 6px 12px; border-radius: 20px; font-weight: 800; display: inline-block; margin-top:10px; }
    .row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #e2e8f0; }
    .total { background:#0ABAB5; color:white; padding:16px; border-radius:10px; margin-top:20px; text-align:center; font-size:20px; font-weight:900; }
  </style></head>
  <body>
    <div class="header">
      <h1 style="margin:0;">RapidFundi</h1>
      <p style="margin:4px 0 0;">Professional Plumbing Services</p>
      <div class="badge">✓ Payment Confirmed</div>
    </div>
    <div style="margin-top:20px;">
      <div class="row"><span>Receipt No:</span><strong>${data.receiptNumber}</strong></div>
      <div class="row"><span>Job No:</span><strong>${data.jobNumber}</strong></div>
      <div class="row"><span>Date:</span><span>${data.date}</span></div>
      <div class="row"><span>Category:</span><span>${data.category || 'Plumbing'}</span></div>
      <div class="row"><span>Building:</span><span>${data.building || '-'}</span></div>
      <div class="row"><span>Location:</span><span>${data.estate || '-'}</span></div>
      <div class="row"><span>Materials:</span><span>KES ${data.materials_cost || 0}</span></div>
      <div class="row"><span>Labour:</span><span>KES ${data.labour || 0}</span></div>
      ${data.materials_list ? `<p style="font-size:12px; color:#64748b;">Materials: ${data.materials_list}</p>` : ''}
    </div>
    <div class="total">TOTAL PAID: KES ${data.amount || data.total || 0}</div>
    <p style="text-align:center; color:#64748b; font-size:11px; margin-top:20px;">Thank you for using RapidFundi • This is a computer generated receipt</p>
  </body>
  </html>`;
};