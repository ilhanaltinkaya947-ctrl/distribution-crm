import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { telegram_id } = await req.json();

    if (!telegram_id || typeof telegram_id !== "number") {
      return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("employees")
      .select("id, telegram_id, full_name, role, is_active")
      .eq("telegram_id", telegram_id)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: "not_found" });
    }

    if (!data.is_active) {
      return NextResponse.json({ ok: false, error: "deactivated" });
    }

    return NextResponse.json({
      ok: true,
      employee: {
        id: data.id,
        telegram_id: data.telegram_id,
        full_name: data.full_name,
        role: data.role,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
