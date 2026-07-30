import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = normalizeEmail(body.email);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ allowed: false, reason: "invalid-email" });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { allowed: false, reason: "supabase-admin-not-configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("purchase_access")
    .select("id,status")
    .eq("email", email)
    .in("status", ["approved", "active", "paid"])
    .maybeSingle();

  if (error) {
    return NextResponse.json({ allowed: false, reason: "lookup-error" }, { status: 500 });
  }

  return NextResponse.json({ allowed: Boolean(data), status: data?.status ?? null });
}
