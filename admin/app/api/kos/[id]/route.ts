import { NextRequest } from 'next/server';
import { proxyWithRetry } from '@/lib/backend';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxyWithRetry(request, { path: `/api/kos/${params.id}` });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxyWithRetry(request, { path: `/api/admin/kos/${params.id}` });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return proxyWithRetry(request, { path: `/api/admin/kos/${params.id}` });
}
