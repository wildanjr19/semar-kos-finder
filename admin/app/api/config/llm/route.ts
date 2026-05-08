import { NextRequest } from 'next/server';
import { proxyWithRetry } from '@/lib/backend';

export async function GET(request: NextRequest) {
  return proxyWithRetry(request, { path: '/api/admin/config/llm' });
}

export async function PUT(request: NextRequest) {
  return proxyWithRetry(request, { path: '/api/admin/config/llm' });
}
