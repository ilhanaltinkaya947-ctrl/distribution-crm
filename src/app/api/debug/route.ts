import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function GET() {
  const results: Record<string, any> = {};

  // Test Supabase
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("clients").select("id, name").limit(2);
    results.supabase = error ? { error: error.message } : { ok: true, count: data?.length };
  } catch (e: any) {
    results.supabase = { error: e.message };
  }

  // Test Telegram
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    results.telegram_token = token ? `${token.substring(0, 10)}...` : "MISSING";

    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    results.telegram_bot = data.ok ? data.result.username : data;
  } catch (e: any) {
    results.telegram = { error: e.message };
  }

  return NextResponse.json(results);
}
