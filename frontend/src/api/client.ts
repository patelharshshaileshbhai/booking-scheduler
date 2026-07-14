import type { ApiErrorPayload, AuthResponse, Availability, BookingLink, BookingSlot, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

type RequestOptions = RequestInit & {
  token?: string;
  body?: unknown;
  headers?: HeadersInit;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, body, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed.');
  }

  return payload as T;
}

export const api = {
  request,
  auth: {
    register: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/register', { method: 'POST', body }),
    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', { method: 'POST', body }),
    me: (token: string) => request<{ user: User }>('/api/auth/me', { token }),
  },
  availability: {
    list: (token: string) => request<{ availability: Availability[] }>('/api/availability', { token }),
    create: (token: string, body: { date: string; startTime: string; endTime: string }) =>
      request<{ availability: Availability }>('/api/availability', { method: 'POST', token, body }),
  },
  links: {
    generate: (token: string) => request<{ link: BookingLink }>('/api/link/generate', { method: 'POST', token }),
    mine: (token: string) => request<{ links: BookingLink[] }>('/api/link/mine', { token }),
    resolve: (tokenValue: string) => request<{ link: BookingLink }>(`/api/link/${tokenValue}`),
  },
  booking: {
    calendar: (tokenValue: string) => request<{ dates: string[] }>(`/api/booking/public/${tokenValue}/calendar`),
    slots: (tokenValue: string, date: string) =>
      request<{ slots: BookingSlot[] }>(`/api/booking/public/${tokenValue}/slots?date=${encodeURIComponent(date)}`),
    book: (tokenValue: string, body: { date: string; startTime: string; endTime: string; bookedBy: string }) =>
      request<{ booking: { startTime: string; endTime: string } }>(`/api/booking/public/${tokenValue}`, {
        method: 'POST',
        body,
      }),
    resolve: (tokenValue: string) => request<{ link: BookingLink }>(`/api/booking/public/${tokenValue}`),
  },
};