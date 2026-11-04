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
  const plumber_share = Math.floor(labour * 0.5); // 50% of labour

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
    total: plumber_share, // Plumber gets only 50% labour
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

// --- CUSTOMER FINAL RECEIPT - PROFESSIONAL ---
export const generateReceiptHTML = (data: any) => {
  return `
  <html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: Helvetica, Arial, sans-serif; margin:0; padding:0; color: #0A1931; background:white; }
    .container { padding: 28px; }
    .header { background: #0A1931; color: white; padding: 22px 28px; display:flex; justify-content:space-between; align-items:center; }
    .logo { font-size:26px; font-weight:900; letter-spacing:0.5px; }
    .sub { font-size:11px; color:#94a3b8; margin-top:2px; }
    .badge { background: #22c55e; color: white; padding: 6px 14px; border-radius: 20px; font-weight: 900; font-size:11px; }
    .meta { display:flex; justify-content:space-between; margin-top:18px; font-size:12px; color:#475569; }
    .box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-top:16px; }
    .row { display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid #e2e8f0; font-size:13px; }
    .row:last-child { border-bottom:none; }
    .label { color:#64748b; }
    .value { font-weight:700; }
    .totalBox { background:#0A1931; color:white; border-radius:12px; padding:18px; margin-top:18px; text-align:center; }
    .totalLabel { font-size:11px; letter-spacing:1px; color:#94a3b8; }
    .totalValue { font-size:26px; font-weight:900; margin-top:6px; }
    .footer { text-align:center; color:#94a3b8; font-size:10px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:12px; }
    .watermark { text-align:center; margin-top:12px; font-size:10px; color:#22c55e; font-weight:800; }
  </style></head>
  <body>
    <div class="header">
      <div><div class="logo">RapidFundi</div><div class="sub">Professional Plumbing Services • Nairobi, KE</div></div>
      <div class="badge">✓ PAID</div>
    </div>
    <div class="container">
      <div class="meta">
        <div><strong>Receipt:</strong> ${data.receiptNumber}<br/><strong>Job:</strong> ${data.jobNumber}<br/><strong>Date:</strong> ${data.date}</div>
        <div style="text-align:right"><strong>Customer</strong><br/>Building: ${data.building || '-'}<br/>Estate: ${data.estate || '-'}<br/>${data.category || 'Plumbing'}</div>
      </div>
      <div class="box">
        <div style="font-weight:900; font-size:12px; color:#94a3b8; letter-spacing:1px; margin-bottom:8px;">BILLING BREAKDOWN</div>
        <div class="row"><span class="label">Labour Cost</span><span class="value">KES ${(data.labour || 0).toLocaleString()}</span></div>
        <div class="row"><span class="label">Materials Cost</span><span class="value">KES ${(data.materials_cost || 0).toLocaleString()}</span></div>
        ${data.materials_list ? `<div style="font-size:11px; color:#475569; margin-top:8px; background:white; padding:8px; border-radius:8px; border:1px dashed #cbd5e1;">Materials: ${data.materials_list}</div>` : ''}
      </div>
      <div class="totalBox">
        <div class="totalLabel">TOTAL PAID</div>
        <div class="totalValue">KES ${(data.amount || data.total || 0).toLocaleString()}</div>
        <div style="font-size:11px; color:#94a3b8; margin-top:4px;">M-Pesa / Cash • EAT ${data.date}</div>
      </div>
      <div class="watermark">Thank you for choosing RapidFundi • support@rapidfundi.co.ke • +254 700 000000</div>
      <div class="footer">This is a computer generated receipt • RapidFundi Ltd • All amounts in KES • Valid without signature</div>
    </div>
  </body>
  </html>`;
};

// --- PLUMBER PAYOUT CLAIM - PROFESSIONAL 50% LABOUR ---
export const generatePlumberPayoutHTML = (data: any) => {
  const labour = Number(data.labour || 0);
  const payout = Number(data.plumber_share || data.total || Math.floor(labour*0.5));
  const companyCut = labour - payout;
  return `
  <html>
  <head><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: Helvetica, Arial, sans-serif; margin:0; padding:0; color: #0A1931; }
    .container { padding: 28px; }
    .header { background: #0A1931; color: white; padding: 22px 28px; }
    .logo { font-size:26px; font-weight:900; }
    .sub { font-size:11px; color:#94a3b8; }
    .claimBadge { background: ${data.status==='PAID' ? '#22c55e' : '#f59e0b'}; color:white; padding:6px 14px; border-radius:20px; font-weight:900; font-size:11px; display:inline-block; }
    .box { background:#f0fdfa; border:1px solid #99f6e0; border-radius:12px; padding:16px; margin-top:16px; }
    .row { display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid #ccfbf1; font-size:13px; }
    .totalBox { background:#0ABAB5; color:white; border-radius:12px; padding:18px; margin-top:18px; text-align:center; }
    .alert { background:${data.status==='PAID' ? '#dcfce7' : '#fef3c7'}; border:1px solid ${data.status==='PAID' ? '#22c55e' : '#fbbf24'}; color:${data.status==='PAID' ? '#166534' : '#92400e'}; padding:12px; border-radius:10px; text-align:center; font-weight:900; margin-top:16px; font-size:13px; }
    .footer { text-align:center; color:#94a3b8; font-size:10px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:12px; }
  </style></head>
  <body>
    <div class="header">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div><div class="logo">RapidFundi</div><div class="sub">PLUMBER PAYMENT CLAIM • ${data.receiptNumber}</div></div>
        <div class="claimBadge">${data.status==='PAID' ? '✓ PAID' : '⏳ UNPAID - CLAIM'}</div>
      </div>
    </div>
    <div class="container">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:#475569;">
        <div><strong>Job:</strong> ${data.jobNumber}<br/><strong>Date:</strong> ${data.date}<br/><strong>Plumber:</strong> ${data.plumberName || '-'}</div>
        <div style="text-align:right"><strong>Location</strong><br/>${data.building || '-'}<br/>${data.estate || '-'}<br/>${data.category || ''}</div>
      </div>
      <div class="box">
        <div style="font-weight:900; font-size:11px; color:#0A1931; letter-spacing:1px;">EARNINGS BREAKDOWN - LABOUR ONLY (50% POLICY)</div>
        <div class="row"><span>Labour Charged to Customer</span><strong>KES ${labour.toLocaleString()}</strong></div>
        <div class="row"><span>Company Commission (50%)</span><span>KES ${companyCut.toLocaleString()}</span></div>
        <div class="row" style="font-weight:900; font-size:14px; border-bottom:none;"><span>YOUR PAYOUT (50% Labour)</span><span>KES ${payout.toLocaleString()}</span></div>
      </div>
      <div class="totalBox">
        <div style="font-size:11px; letter-spacing:1px; opacity:0.9;">AMOUNT TO BE PAID TO PLUMBER</div>
        <div style="font-size:28px; font-weight:900; margin-top:6px;">KES ${payout.toLocaleString()}</div>
        <div style="font-size:11px; margin-top:4px; opacity:0.9;">50% of Labour Cost • End of Day Payout</div>
      </div>
      <div class="alert">${data.status==='PAID' ? `✓ PAID on ${data.date} - Processed` : '⏳ UNPAID - Present this claim to Admin for payment. Payout processed end of day after customer payment.'}</div>
      <div class="footer">This claim document is valid for payment collection • RapidFundi Ltd • Plumber Copy • ${data.date}<br/>Present with ID • support@rapidfundi.co.ke</div>
    </div>
  </body>
  </html>`;
};