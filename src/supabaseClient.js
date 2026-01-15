/*
import { createClient } from '@supabase/supabase-js';

// Vercel(또는 .env)에 등록된 변수를 가져오는 방식이야
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("🚨 Supabase 키가 없습니다. .env 파일이나 Vercel 설정을 확인해주세요!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
*/

import { createClient } from '@supabase/supabase-js';

// 👇 따옴표(" ")가 빠져있던 걸 붙여야 해!
const supabaseUrl = "https://iallwcxzefzfbywocsmi.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhbGx3Y3h6ZWZ6ZmJ5d29jc21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNzc3MDQsImV4cCI6MjA4Mzg1MzcwNH0.0RF5Wz-MSh7AJ-oYpKQZgQTJqa-wdnD7N9UTc6dtY88";

export const supabase = createClient(supabaseUrl, supabaseKey);
