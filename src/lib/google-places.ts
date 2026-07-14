// ============================================================
// Google Places API (New) — Text Search
//
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
//
// Variável de ambiente necessária:
//   GOOGLE_PLACES_API_KEY=sua-chave-aqui
// ============================================================

const PLACES_BASE = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.primaryTypeDisplayName",
  "places.addressComponents",
  "places.businessStatus",
].join(",");

// Coordenadas aproximadas dos estados brasileiros (capital)
const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  AC: { lat: -9.9754, lng: -67.8249 },
  AL: { lat: -9.6658, lng: -35.7353 },
  AM: { lat: -3.1019, lng: -60.025 },
  AP: { lat: 0.0349, lng: -51.0694 },
  BA: { lat: -12.9711, lng: -38.5108 },
  CE: { lat: -3.7172, lng: -38.5433 },
  DF: { lat: -15.7801, lng: -47.9292 },
  ES: { lat: -20.3155, lng: -40.3128 },
  GO: { lat: -16.6864, lng: -49.2643 },
  MA: { lat: -2.5297, lng: -44.3028 },
  MG: { lat: -19.9167, lng: -43.9345 },
  MS: { lat: -20.4428, lng: -54.6464 },
  MT: { lat: -15.6014, lng: -56.0979 },
  PA: { lat: -1.4558, lng: -48.4902 },
  PB: { lat: -7.115, lng: -34.8631 },
  PE: { lat: -8.0539, lng: -34.8811 },
  PI: { lat: -5.0919, lng: -42.8034 },
  PR: { lat: -25.4284, lng: -49.2733 },
  RJ: { lat: -22.9068, lng: -43.1729 },
  RN: { lat: -5.7945, lng: -35.2119 },
  RO: { lat: -8.7612, lng: -63.9039 },
  RR: { lat: 2.8235, lng: -60.6758 },
  RS: { lat: -30.0346, lng: -51.2177 },
  SC: { lat: -27.5954, lng: -48.548 },
  SE: { lat: -10.9091, lng: -37.0677 },
  SP: { lat: -23.5505, lng: -46.6333 },
  TO: { lat: -10.2491, lng: -48.3243 },
};

export interface PlaceResult {
  placeId: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  rating: number | null;
  category: string | null;
  businessStatus: string | null;
}

export interface SearchPlacesParams {
  query: string;       // ex: "dentistas"
  city?: string;       // ex: "Campinas"
  state?: string;      // ex: "SP"
  radiusKm?: number;   // padrão 10
  maxResults?: number; // padrão 20, máx 20
}

export async function searchPlaces(
  params: SearchPlacesParams
): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY não configurada");

  const { query, city, state, radiusKm = 10, maxResults = 20 } = params;

  // Monta o textQuery com localização para melhorar relevância
  const locationSuffix = [city, state, "Brasil"].filter(Boolean).join(", ");
  const textQuery = `${query} em ${locationSuffix}`;

  // Bias de localização por coordenadas do estado (fallback para SP)
  const coords = state ? STATE_COORDS[state.toUpperCase()] : STATE_COORDS["SP"];

  const body: Record<string, unknown> = {
    textQuery,
    languageCode: "pt-BR",
    regionCode: "BR",
    maxResultCount: Math.min(maxResults, 20),
  };

  if (coords) {
    body.locationBias = {
      circle: {
        center: { latitude: coords.lat, longitude: coords.lng },
        radius: radiusKm * 1000,
      },
    };
  }

  const res = await fetch(PLACES_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const places = data.places ?? [];

  return places.map((p: Record<string, unknown>): PlaceResult => {
    // Extrai cidade e estado dos addressComponents
    const components = (p.addressComponents as Array<{
      longText?: string;
      types?: string[];
    }>) ?? [];

    const cityComp = components.find((c) =>
      c.types?.includes("administrative_area_level_2")
    );
    const stateComp = components.find((c) =>
      c.types?.includes("administrative_area_level_1")
    );

    const displayName = p.displayName as { text?: string } | undefined;
    const primaryType = p.primaryTypeDisplayName as { text?: string } | undefined;

    return {
      placeId: p.id as string,
      name: displayName?.text ?? "",
      phone:
        (p.nationalPhoneNumber as string | null) ??
        (p.internationalPhoneNumber as string | null) ??
        null,
      address: (p.formattedAddress as string | null) ?? null,
      city: cityComp?.longText ?? null,
      state: stateComp?.longText ?? null,
      website: (p.websiteUri as string | null) ?? null,
      rating: (p.rating as number | null) ?? null,
      category: primaryType?.text ?? null,
      businessStatus: (p.businessStatus as string | null) ?? null,
    };
  });
}
