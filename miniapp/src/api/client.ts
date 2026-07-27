const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

let authToken: string | null = null;

export function setToken(token: string) {
  authToken = token;
}

export function getToken() {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  authTelegram: (initData: string) =>
    request<{ token: string; user: any }>('/v1/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    }),

  // User
  getProfile: () => request<any>('/v1/user/profile'),

  // Products
  getProducts: () => request<any[]>('/v1/products'),

  // Orders
  getOrders: () => request<any[]>('/v1/orders'),
  getOrder: (id: number) => request<any>(`/v1/orders/${id}`),
  createOrder: (data: { productId: number; discountCode?: string }) =>
    request<any>('/v1/orders', { method: 'POST', body: JSON.stringify(data) }),
  renewOrder: (id: number, days: number) =>
    request<any>(`/v1/orders/${id}/renew`, { method: 'POST', body: JSON.stringify({ days }) }),
  addVolume: (id: number, gb: number) =>
    request<any>(`/v1/orders/${id}/volume`, { method: 'POST', body: JSON.stringify({ gb }) }),

  // Wallet
  getWallet: () => request<{ balance: number; transactions: any[] }>('/v1/wallet'),

  // Referral
  getReferral: () => request<{ link: string; code: string; count: number; earnings: number }>('/v1/referral'),

  // Discount
  applyDiscount: (code: string) =>
    request<{ percent: number; valid: boolean }>('/v1/discount/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // Trial
  requestTrial: () => request<any>('/v1/trial', { method: 'POST' }),

  // Support
  getFaq: () => request<Array<{ q: string; a: string }>>('/v1/support/faq'),
};
