import { NextRequest } from 'next/server';
import { proxyWithRetry } from '@/lib/backend';

export async function GET(request: NextRequest) {
  return proxyWithRetry(request, { path: '/api/kos' });
}

export async function POST(request: NextRequest) {
  return proxyWithRetry(request, { path: '/api/admin/kos' });
}
