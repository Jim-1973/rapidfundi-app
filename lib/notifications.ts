import { supabase } from "./supabase";

export async function sendNotification(params: {
  user_id: string;
  role?: string;
  title: string;
  message: string;
  type: string;
  job_id?: string;
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.user_id,
    role: params.role,
    title: params.title,
    message: params.message,
    type: params.type,
    job_id: params.job_id,
    is_read: false
  });
  if(error) console.log("Notification error", error);
}

// Get user_id of admin - store one admin id or get all plumbers with role
export async function notifyAdmins(title: string, message: string, type: string, job_id?: string){
  // For now we notify by creating notification with role admin and fetching all admin users
  // Simplest: get all users from plumbers table? Better create admin table
  // For now we'll just get all auth users where role=admin from a custom query
  // WORKAROUND: Insert with user_id = null but role=admin and let admin panel fetch by role
  const { data: admins } = await supabase.from('plumbers').select('user_id').eq('name', 'ADMIN'); // you can create admin_users table
  // Fallback: create for all - easiest is to let admin panel poll notifications where role=admin
  await supabase.from('notifications').insert({
    role: 'admin',
    title, message, type, job_id,
    user_id: '00000000-0000-0000-0000-000000000000', // dummy, we filter by role in admin
    is_read: false
  } as any);
}