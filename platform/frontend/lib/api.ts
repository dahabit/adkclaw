/**
 * Typed API client for the AdkClaw workshop platform.
 * Wraps fetch with sensible defaults + types.
 */

import type {
  Event,
  Builder,
  BuilderProfile,
  FleetSnapshot,
  RegisterBuilderRequest,
  RegisterBuilderResponse,
  Region,
} from './types';

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'https://api.adkclaw.dev');

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!res.ok) {
    const code = (body as { error?: string }).error || `http_${res.status}`;
    throw new ApiError(res.status, code, code);
  }
  return body as T;
}

export const api = {
  health: () => request<{ ok: boolean; service: string; version: string }>('/api/health'),

  getEvent: (code: string) =>
    request<Event & { registeredCount: number }>(`/api/events/${encodeURIComponent(code)}`),

  getBuilder: (username: string) =>
    request<BuilderProfile>(`/api/builders/${encodeURIComponent(username)}`),

  getFleet: (eventCode: string) =>
    request<FleetSnapshot>(`/api/events/${encodeURIComponent(eventCode)}/builders`),

  getRegions: () => request<{ regions: Region[] }>('/api/regions'),

  registerBuilder: (body: RegisterBuilderRequest) =>
    request<RegisterBuilderResponse>('/api/builders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export { ApiError };
