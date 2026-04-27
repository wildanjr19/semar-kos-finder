import { NextRequest } from 'next/server';
import { proxyWithRetry } from '@/lib/backend';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return proxyWithRetry(request, {
    path: '/api/admin/actions/parse/jobs',
    query: { status: searchParams.get('status') ?? undefined },
  });
}
