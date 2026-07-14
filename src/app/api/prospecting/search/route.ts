// ============================================================
// POST /api/prospecting/search
//
// Busca empresas via Google Places Text Search e salva a sessão
// de prospecção no banco. Retorna os candidatos encontrados.
// ============================================================

import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { searchPlaces } from "@/lib/google-places";

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("agent");

    const body = await request.json();
    const { query, state, city, radiusKm = 10, maxResults = 20 } = body as {
      query: string;
      state?: string;
      city?: string;
      radiusKm?: number;
      maxResults?: number;
    };

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "O campo 'query' é obrigatório." },
        { status: 400 }
      );
    }

    // Busca no Google Places
    const places = await searchPlaces({ query, state, city, radiusKm, maxResults });

    // Salva a sessão de busca no banco
    const location = [city, state, "Brasil"].filter(Boolean).join(", ");
    const { data: search, error: searchErr } = await ctx.supabase
      .from("prospecting_searches")
      .insert({
        account_id: ctx.accountId,
        created_by: ctx.userId,
        query: query.trim(),
        location,
        state: state ?? null,
        city: city ?? null,
        radius_km: radiusKm,
        total_found: places.length,
      })
      .select()
      .single();

    if (searchErr) throw searchErr;

    // Salva os candidatos encontrados
    if (places.length > 0) {
      const candidates = places.map((p) => ({
        search_id: search.id,
        account_id: ctx.accountId,
        google_place_id: p.placeId,
        name: p.name,
        phone: p.phone,
        address: p.address,
        city: p.city ?? city ?? null,
        state: p.state ?? state ?? null,
        website: p.website,
        rating: p.rating,
        category: p.category,
      }));

      const { error: candErr } = await ctx.supabase
        .from("lead_candidates")
        .insert(candidates);

      if (candErr) throw candErr;
    }

    // Busca os candidatos salvos (com IDs do banco)
    const { data: candidates } = await ctx.supabase
      .from("lead_candidates")
      .select("*")
      .eq("search_id", search.id)
      .order("rating", { ascending: false });

    return NextResponse.json({
      search,
      candidates: candidates ?? [],
      total: places.length,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
