import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:8000';

async function proxy(request: NextRequest, path: string): Promise<NextResponse> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const backendUrl = `${API_INTERNAL_URL}${path}`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };

  const init: RequestInit = { headers };

  if (request.method !== 'GET') {
    init.body = await request.text();
  }

  const backendRes = await fetch(backendUrl, { ...init, method: request.method });

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const contentType = backendRes.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  }

  return new NextResponse(backendRes.body, { status: backendRes.status });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxy(_request, `/api/kos/${params.id}`);
}

export async function PUT(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxy(_request, `/api/admin/kos/${params.id}`);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxy(_request, `/api/admin/kos/${params.id}`);
}