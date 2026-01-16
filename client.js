const API_BASE = window.location.origin;
let supabaseClient;

async function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }
  const res = await fetch(`${API_BASE}/api/config`);
  const config = await res.json();
  supabaseClient = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabaseClient;
}

async function getSession() {
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  return data.session;
}
