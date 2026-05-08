import { NextRequest } from 'next/server';
import { proxyWithRetry } from '@/lib/backend';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  return proxyWithRetry(request, { path: `/api/admin/actions/parse/jobs/${jobId}/cancel` });
}
