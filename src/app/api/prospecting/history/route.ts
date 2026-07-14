// ============================================================
// GET /api/prospecting/history
//
// Retorna o histórico de buscas de prospecção da conta,
// com contagem de candidatos importados vs. total.
// ============================================================

import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";

export async function GET() {
  try {
    const ctx = await requireRole("agent");

    const { data, error } = await ctx.supabase
      .from("prospecting_searches")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ searches: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
