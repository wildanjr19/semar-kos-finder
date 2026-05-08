import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:8000';
const ACCESS_MAX_AGE = 60 * 60; // 1 hour

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('admin_refresh')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const backendRes = await fetch(`${API_INTERNAL_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!backendRes.ok) {
    const data = await backendRes.json().catch(() => ({ error: 'Refresh failed' }));
    const response = NextResponse.json(data, { status: 401 });
    response.cookies.set('admin_token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    response.cookies.set('admin_refresh', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  }

  const data = await backendRes.json();

  const response = NextResponse.json({ ok: true, access_token: data.access_token });
  response.cookies.set('admin_token', data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_MAX_AGE,
  });

  return response;
}
