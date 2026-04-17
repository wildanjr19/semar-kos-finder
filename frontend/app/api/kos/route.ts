import { NextResponse } from "next/server";

export async function GET() {
  const apiInternalUrl =
    process.env.API_INTERNAL_URL ?? "http://backend_dev:8000";

  try {
    const response = await fetch(`${apiInternalUrl}/api/kos`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `Backend API error: ${response.status} ${response.statusText}`,
      );
      return NextResponse.json([], { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch from backend:", error);
    return NextResponse.json([], { status: 500 });
  }
}