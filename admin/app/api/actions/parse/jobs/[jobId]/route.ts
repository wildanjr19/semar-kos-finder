import { NextRequest } from 'next/server';
import { proxyWithRetry } from '@/lib/backend';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  return proxyWithRetry(request, { path: `/api/admin/actions/parse/jobs/${jobId}` });
}
