import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/actions/parse/entry or /api/actions/parse/bulk instead.' },
    { status: 410 }
  );
}
