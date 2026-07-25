// react-native-url-polyfill must be imported before supabase-js — RN's JS
// engine (Hermes) doesn't implement the URL API supabase-js relies on.
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy apps/mobile/.env.example to apps/mobile/.env " +
      "and fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — the " +
      "same project apps/web already uses."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There's no URL bar on mobile to carry an OAuth/magic-link redirect,
    // unlike the web client's config from the Authentication phase.
    detectSessionInUrl: false
  }
});
