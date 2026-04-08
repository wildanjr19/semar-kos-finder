import { NextRequest, NextResponse } from "next/server";

type RouteRequestBody = {
  origin?: { lat?: number; lon?: number };
  destination?: { lat?: number; lon?: number };
  travelMode?: "DRIVE" | "WALK" | "BICYCLE" | "TWO_WHEELER";
};

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: NextRequest) {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key belum diset di environment" },
      { status: 500 },
    );
  }

  let body: RouteRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  const originLat = body.origin?.lat;
  const originLon = body.origin?.lon;
  const destinationLat = body.destination?.lat;
  const destinationLon = body.destination?.lon;

  if (
    !isFiniteCoordinate(originLat) ||
    !isFiniteCoordinate(originLon) ||
    !isFiniteCoordinate(destinationLat) ||
    !isFiniteCoordinate(destinationLon)
  ) {
    return NextResponse.json(
      { error: "Koordinat origin/destination tidak valid" },
      { status: 400 },
    );
  }

  const travelMode = body.travelMode ?? "DRIVE";

  const googleResponse = await fetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: originLat,
              longitude: originLon,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destinationLat,
              longitude: destinationLon,
            },
          },
        },
        travelMode,
        computeAlternativeRoutes: false,
        languageCode: "id-ID",
        units: "METRIC",
      }),
    },
  );

  const googleJson = await googleResponse.json();

  if (!googleResponse.ok) {
    return NextResponse.json(
      {
        error:
          googleJson?.error?.message ??
          "Gagal mendapatkan rute dari Google Maps API",
      },
      { status: googleResponse.status },
    );
  }

  const route = googleJson?.routes?.[0];
  const encodedPolyline = route?.polyline?.encodedPolyline;
  const distanceMeters = route?.distanceMeters;
  const duration = route?.duration;

  if (!encodedPolyline || !isFiniteCoordinate(distanceMeters) || !duration) {
    return NextResponse.json({ error: "Rute tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    distanceMeters,
    duration,
    encodedPolyline,
  });
}
