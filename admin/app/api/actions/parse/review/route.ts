import { proxyWithRetry } from '@/lib/backend';

export async function POST(request: Request) {
  return proxyWithRetry(request, { path: '/api/admin/actions/parse/review' });
}
