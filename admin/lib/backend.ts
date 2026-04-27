import { NextRequest, NextResponse } from 'next/server';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:8000';

const ACCESS_MAX_AGE = 60 * 60; // 1 hour, should match or exceed JWT_EXPIRE_MINUTES

interface ProxyOptions {
  path: string;
  method?: string;
  body?: string | null;
  query?: Record<string, string | null | undefined>;
}

async function fetchBackend(
  url: string,
  method: string,
  token: string | undefined,
  body: string | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = body;
  }

  return fetch(url, init);
}

async function buildNextResponse(backendRes: Response): Promise<NextResponse> {
  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const contentType = backendRes.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  }
  return new NextResponse(backendRes.body, { status: backendRes.status });
}

async function tryRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

export async function proxyWithRetry(
  request: NextRequest,
  options: ProxyOptions,
): Promise<NextResponse> {
  const url = new URL(`${API_INTERNAL_URL}${options.path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  const method = options.method || request.method;
  const body =
    options.body !== undefined
      ? options.body ?? undefined
      : method !== 'GET'
        ? await request.text()
        : undefined;

  const token = request.cookies.get('admin_token')?.value;

  let backendRes = await fetchBackend(url.toString(), method, token, body);

  if (backendRes.status === 401) {
    const refreshToken = request.cookies.get('admin_refresh')?.value;
    if (refreshToken) {
      const newToken = await tryRefresh(refreshToken);
      if (newToken) {
        backendRes = await fetchBackend(url.toString(), method, newToken, body);
        const nextRes = await buildNextResponse(backendRes);
        nextRes.cookies.set('admin_token', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: ACCESS_MAX_AGE,
        });
        return nextRes;
      }
    }
  }

  return buildNextResponse(backendRes);
}
