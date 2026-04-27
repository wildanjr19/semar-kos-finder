import { NextRequest } from 'next/server';
import { proxyWithRetry } from '@/lib/backend';

export async function POST(request: NextRequest) {
  return proxyWithRetry(request, { path: '/api/admin/kos/bulk' });
}

export async function DELETE(request: NextRequest) {
  return proxyWithRetry(request, { path: '/api/admin/kos/bulk' });
}
