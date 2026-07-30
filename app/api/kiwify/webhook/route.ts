import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function findStringValue(value: unknown, patterns: RegExp[], depth = 0): string {
  if (depth > 6 || value == null) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringValue(item, patterns, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (!isRecord(value)) return "";

  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" && patterns.some((pattern) => pattern.test(key))) {
      return raw;
    }
  }

  for (const raw of Object.values(value)) {
    const found = findStringValue(raw, patterns, depth + 1);
    if (found) return found;
  }

  return "";
}

function collectText(value: unknown, out: string[] = [], depth = 0) {
  if (depth > 5 || value == null) return out;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out.push(String(value));
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, out, depth + 1));
    return out;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, raw]) => {
      out.push(key);
      collectText(raw, out, depth + 1);
    });
  }

  return out;
}

function resolveStatus(payload: unknown) {
  const text = collectText(payload).join(" ").toLowerCase();

  if (/(refund|reembols|chargeback|cancel|canceled|cancelado|recusad|refused)/.test(text)) {
    return "inactive";
  }

  if (/(approved|aprovad|paid|pago|completed|complete|authorized|autorizad)/.test(text)) {
    return "approved";
  }

  return "pending";
}

function readWebhookSecret(request: Request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  return (
    request.headers.get("x-kiwify-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("x-organiza-secret") ||
    ""
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "kiwify-webhook" });
}

export async function POST(request: Request) {
  const expectedSecret = process.env.KIWIFY_WEBHOOK_SECRET;

  if (expectedSecret && readWebhookSecret(request) !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: "supabase-admin-not-configured" }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as JsonRecord | null;

  if (!payload) {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const email = normalizeEmail(
    findStringValue(payload, [
      /^email$/i,
      /customer.*email/i,
      /buyer.*email/i,
      /client.*email/i,
      /user.*email/i
    ])
  );

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "buyer-email-not-found" }, { status: 400 });
  }

  const name = findStringValue(payload, [/customer.*name/i, /buyer.*name/i, /client.*name/i, /^name$/i]);
  const transactionId = findStringValue(payload, [/transaction.*id/i, /order.*id/i, /sale.*id/i, /^id$/i]);
  const productName = findStringValue(payload, [/product.*name/i, /offer.*name/i, /plan.*name/i]);
  const status = resolveStatus(payload);

  const { error } = await supabaseAdmin.from("purchase_access").upsert(
    {
      email,
      name,
      source: "kiwify",
      status,
      product_name: productName,
      transaction_id: transactionId,
      raw_event: payload,
      updated_at: new Date().toISOString()
    },
    { onConflict: "email" }
  );

  if (error) {
    return NextResponse.json({ ok: false, error: "access-save-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email, status });
}
