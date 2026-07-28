const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TOKEN_KEY = 'rz_token';

let authToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export function setToken(token: string) {
  authToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* */
  }
}

export function clearToken() {
  authToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* */
  }
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
  authTelegram: (initData: string) =>
    request<{ token: string; user: any }>('/v1/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    }),

  getProfile: () => request<any>('/v1/user/profile'),

  getProducts: () => request<any[]>('/v1/products'),

  getOrders: () => request<any[]>('/v1/orders'),
  getOrder: (id: number) => request<any>(`/v1/orders/${id}`),
  createOrder: (data: { productId: number; discountCode?: string }) =>
    request<any>('/v1/orders', { method: 'POST', body: JSON.stringify(data) }),
  renewOrder: (id: number, days?: number) =>
    request<any>(`/v1/orders/${id}/renew`, { method: 'POST', body: JSON.stringify({ days }) }),
  addVolume: (id: number, gb: number) =>
    request<any>(`/v1/orders/${id}/volume`, { method: 'POST', body: JSON.stringify({ gb }) }),

  getWallet: () => request<{ balance: number; transactions: any[] }>('/v1/wallet'),
  chargeWallet: (amount: number, gateway: string = 'zarinpal') =>
    request<any>('/v1/wallet/charge', {
      method: 'POST',
      body: JSON.stringify({ amount, gateway }),
    }),

  redeemGift: (code: string) =>
    request<any>('/v1/gift/redeem', { method: 'POST', body: JSON.stringify({ code }) }),

  getReferral: () =>
    request<{ link: string; code: string; count: number; earnings: number }>('/v1/referral'),

  applyDiscount: (code: string) =>
    request<{ percent: number; valid: boolean }>('/v1/discount/apply', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  requestTrial: () => request<any>('/v1/trial', { method: 'POST' }),

  getFaq: () => request<Array<{ q: string; a: string }>>('/v1/support/faq'),
};
