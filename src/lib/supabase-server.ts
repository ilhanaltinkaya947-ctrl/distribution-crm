import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hwohstbicwbjtdczwois.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3b2hzdGJpY3dianRkY3p3b2lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NTY0ODEsImV4cCI6MjA4ODQzMjQ4MX0.phIwkcr276tD95tZowGPJ4y_hCDr_I9sk3lnwuNdibY'

export function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
