import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:8000';

const SSE_HEADERS = ['content-type', 'cache-control', 'x-accel-buffering'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;
  const backendRes = await fetch(
    `${API_INTERNAL_URL}/api/admin/actions/parse/jobs/${encodeURIComponent(jobId)}/events`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'text/event-stream',
      },
    },
  );

  const headers = new Headers();
  for (const header of SSE_HEADERS) {
    const value = backendRes.headers.get(header);
    if (value) headers.set(header, value);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'text/event-stream');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-cache');
  if (!headers.has('x-accel-buffering')) headers.set('x-accel-buffering', 'no');

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers,
  });
}
