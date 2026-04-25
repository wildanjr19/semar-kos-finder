import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { jobId } = await params;

  const backendRes = await fetch(`${API_INTERNAL_URL}/api/admin/actions/parse/jobs/${jobId}/cancel`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const data = await backendRes.json().catch(() => ({ error: 'Backend error' }));
  return NextResponse.json(data, { status: backendRes.status });
}
