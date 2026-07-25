// backend/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Public client — respects Row Level Security
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// Admin client — bypasses RLS, use only in trusted server code
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

module.exports = { supabase, supabaseAdmin };
