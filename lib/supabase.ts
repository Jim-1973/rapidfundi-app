import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qyqaqnkxtmsrrctknhxi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5cWFxbmt4dG1zcnJjdGtuaHhpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDExNzg1OSwiZXhwIjoyMTA1NjkzODU5fQ.RkEV8THghhyao4vBBKnvu7zbYIh8frmbHdRVL2iEULg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);