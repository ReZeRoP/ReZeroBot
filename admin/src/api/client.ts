const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin';

const TOKEN_KEY = 'rz_admin_token';

export function getAdminToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = getAdminToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearAdminToken();
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const adminApi = {
  login: (username: string, password: string) =>
    request<{ token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  stats: () => request<any>('/stats'),
  users: (page = 1, q = '') =>
    request<any[]>(`/users?page=${page}&q=${encodeURIComponent(q)}`),
  blockUser: (id: number, blocked: boolean) =>
    request(`/users/${id}/block`, { method: 'POST', body: JSON.stringify({ blocked }) }),
  adjustBalance: (id: number, amount: number, reason?: string) =>
    request(`/users/${id}/balance`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    }),

  products: () => request<any[]>('/products'),
  createProduct: (data: any) =>
    request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: number, data: any) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: number) => request(`/products/${id}`, { method: 'DELETE' }),

  categories: () => request<any[]>('/categories'),
  createCategory: (data: any) =>
    request('/categories', { method: 'POST', body: JSON.stringify(data) }),

  orders: (page = 1, status?: string) =>
    request<any[]>(`/orders?page=${page}${status ? `&status=${status}` : ''}`),

  payments: (status?: string) =>
    request<any[]>(`/payments${status ? `?status=${status}` : ''}`),
  approvePayment: (id: number) =>
    request(`/payments/${id}/approve`, { method: 'POST' }),
  rejectPayment: (id: number) =>
    request(`/payments/${id}/reject`, { method: 'POST' }),

  discounts: () => request<any[]>('/discounts'),
  createDiscount: (data: any) =>
    request('/discounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteDiscount: (id: number) => request(`/discounts/${id}`, { method: 'DELETE' }),

  gifts: () => request<any[]>('/gifts'),
  generateGifts: (count: number, amount: number) =>
    request('/gifts/generate', { method: 'POST', body: JSON.stringify({ count, amount }) }),

  settings: () => request<Record<string, string>>('/settings'),
  saveSettings: (data: Record<string, string>) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  panels: () => request<any[]>('/panels'),
  panelHealth: () => request<{ success: boolean; message: string }>('/panels/health'),
};
