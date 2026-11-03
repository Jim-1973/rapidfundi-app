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

  // 1. Final receipt for customer - PAID immediately (customer pays after completion)
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

  // 2. Payout receipt for plumber - UNPAID until you pay end of day
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