import { config } from '../../config.js';
import type {
  SanaeiApiResponse,
  SanaeiInbound,
  SanaeiClientStat,
  CreateClientParams,
  UpdateClientParams,
} from './types.js';

/**
 * Sanaei (3x-ui) Panel API Client
 *
 * Supports two authentication methods:
 * 1. API Key (Bearer token) — recommended for v3.x+
 *    Generate in panel: Settings → Security → API Token
 *    Sent as: Authorization: Bearer <token>
 *
 * 2. Session login (legacy fallback)
 *    POST /login with form-urlencoded {username, password} → session cookie
 */
export class SanaeiClient {
  private baseUrl: string;
  private panelOrigin: string;
  private apiKey: string;
  private username: string;
  private password: string;
  private cookie: string | null = null;
  private lastLogin: number = 0;
  private readonly SESSION_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(url?: string, apiKey?: string, username?: string, password?: string) {
    this.baseUrl = (url || config.PANEL_URL || 'http://localhost').replace(/\/$/, '');
    try {
      this.panelOrigin = new URL(this.baseUrl).origin;
    } catch {
      this.panelOrigin = this.baseUrl;
    }
    this.apiKey = apiKey || config.PANEL_API_KEY;
    this.username = username || config.PANEL_USERNAME;
    this.password = password || config.PANEL_PASSWORD;
  }

  /** Whether we're using API key auth (no session management needed) */
  private get useApiKey(): boolean {
    return this.apiKey.length > 0;
  }

  // === Authentication ===

  private async ensureSession(): Promise<void> {
    if (this.useApiKey) return;
    const now = Date.now();
    if (this.cookie && now - this.lastLogin < this.SESSION_TTL) {
      return;
    }
    await this.login();
  }

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: this.username,
        password: this.password,
      }),
      redirect: 'manual',
    });

    // Parse and validate BEFORE caching the cookie
    let data: SanaeiApiResponse;
    try {
      data = (await res.json()) as SanaeiApiResponse;
    } catch {
      throw new Error('Sanaei panel login failed: invalid response from panel');
    }

    if (!data.success) {
      throw new Error(`Sanaei panel login failed: ${data.msg || 'unknown error'}`);
    }

    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('Sanaei panel login failed: no session cookie received');
    }

    // Only cache after successful validation
    this.cookie = setCookie.split(';')[0];
    this.lastLogin = Date.now();
  }

  /** Build auth headers based on the configured method */
  private getAuthHeaders(): Record<string, string> {
    if (this.useApiKey) {
      return { Authorization: `Bearer ${this.apiKey}` };
    }
    return { Cookie: this.cookie || '' };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<SanaeiApiResponse<T>> {
    await this.ensureSession();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    // Handle auth failure
    if (res.status === 401 || res.status === 302) {
      if (this.useApiKey) {
        throw new Error(
          `Sanaei API auth failed. Check your PANEL_API_KEY (Settings → Security → API Token).`,
        );
      }
      // Session expired, re-login and retry once
      this.cookie = null;
      await this.login();
      const retryRes = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });
      if (!retryRes.ok) {
        throw new Error(`Sanaei API retry failed [${path}]: HTTP ${retryRes.status}`);
      }
      const retryData = (await retryRes.json()) as SanaeiApiResponse<T>;
      if (!retryData.success) {
        throw new Error(`Sanaei API error [${path}]: ${retryData.msg || 'unknown'}`);
      }
      return retryData;
    }

    if (res.status === 403) {
      throw new Error(`Sanaei API forbidden [${path}]: check panel permissions or API key`);
    }

    if (!res.ok) {
      throw new Error(`Sanaei API HTTP error [${path}]: ${res.status}`);
    }

    const data = (await res.json()) as SanaeiApiResponse<T>;
    if (!data.success) {
      throw new Error(`Sanaei API error [${path}]: ${data.msg || 'unknown'}`);
    }
    return data;
  }

  // === Inbound Operations ===

  async getInbounds(): Promise<SanaeiInbound[]> {
    const res = await this.request<SanaeiInbound[]>('/panel/api/inbounds/list');
    return res.obj || [];
  }

  async getInbound(id: number): Promise<SanaeiInbound | null> {
    const res = await this.request<SanaeiInbound>(`/panel/api/inbounds/get/${id}`);
    return res.obj || null;
  }

  // === Server Operations ===

  async getServerStatus(): Promise<Record<string, unknown>> {
    const res = await this.request<Record<string, unknown>>('/panel/api/server/status');
    return res.obj || {};
  }

  // === Client Operations ===

  async addClient(params: CreateClientParams): Promise<Record<string, unknown>> {
    const inbound = await this.getInbound(params.inboundId);
    if (!inbound) {
      throw new Error(`Inbound ${params.inboundId} not found`);
    }

    const inboundSettings = JSON.parse(inbound.settings);
    const newClient: Record<string, unknown> = {
      email: params.email,
      enable: params.enable ?? true,
      totalGB: params.totalGB,
      expiryTime: params.expiryTime,
      subId: params.subId || this.generateSubId(),
    };

    // Protocol-specific fields
    if (inbound.protocol === 'vless') {
      newClient.id = this.generateUUID();
      newClient.flow = params.flow || (this.isReality(inbound) ? 'xtls-rprx-vision' : '');
    } else if (inbound.protocol === 'vmess') {
      newClient.id = this.generateUUID();
      newClient.alterId = 0;
    } else if (inbound.protocol === 'trojan') {
      newClient.password = this.generateUUID();
      newClient.flow = params.flow || '';
    } else if (inbound.protocol === 'shadowsocks') {
      newClient.password = this.generateUUID();
      newClient.method = inboundSettings.method || 'aes-256-gcm';
    }

    // 3x-ui addClient APPENDS clients from settings — send ONLY the new client
    await this.request(`/panel/api/inbounds/addClient`, {
      method: 'POST',
      body: JSON.stringify({
        id: params.inboundId,
        settings: JSON.stringify({ clients: [newClient] }),
      }),
    });

    return newClient;
  }

  async updateClient(params: UpdateClientParams): Promise<void> {
    const inbound = await this.getInbound(params.inboundId);
    if (!inbound) {
      throw new Error(`Inbound ${params.inboundId} not found`);
    }

    const inboundSettings = JSON.parse(inbound.settings);
    const existingClient = inboundSettings.clients?.find(
      (c: { id?: string; password?: string; email?: string }) =>
        c.id === params.clientId || c.password === params.clientId || c.email === params.email,
    );

    if (!existingClient) {
      throw new Error(`Client ${params.email} not found in inbound ${params.inboundId}`);
    }

    // Build the updated client object
    const updatedClient = {
      ...existingClient,
      email: params.email,
      totalGB: params.totalGB,
      expiryTime: params.expiryTime,
      enable: params.enable ?? true,
      ...(params.flow !== undefined && { flow: params.flow }),
    };

    // 3x-ui updateClient/{uuid} replaces the matched client with clients[0] from body
    // Send ONLY the updated client
    await this.request(`/panel/api/inbounds/updateClient/${params.clientId}`, {
      method: 'POST',
      body: JSON.stringify({
        id: params.inboundId,
        settings: JSON.stringify({ clients: [updatedClient] }),
      }),
    });
  }

  async removeClient(inboundId: number, clientId: string): Promise<void> {
    await this.request(`/panel/api/inbounds/${inboundId}/delClient/${clientId}`, {
      method: 'POST',
    });
  }

  async resetClientTraffic(inboundId: number, email: string): Promise<void> {
    await this.request(`/panel/api/inbounds/${inboundId}/resetClientTraffic/${email}`, {
      method: 'POST',
    });
  }

  async getClientTraffics(email: string): Promise<SanaeiClientStat | null> {
    const res = await this.request<SanaeiClientStat>(
      `/panel/api/inbounds/getClientTraffics/${email}`,
    );
    return res.obj || null;
  }

  async getClientByEmail(inboundId: number, email: string): Promise<Record<string, unknown> | null> {
    const inbound = await this.getInbound(inboundId);
    if (!inbound) return null;

    const settings = JSON.parse(inbound.settings);
    return settings.clients?.find((c: { email: string }) => c.email === email) || null;
  }

  /** Get the panel identifier for a client (id for vless/vmess, password for trojan/ss) */
  getClientIdentifier(client: Record<string, unknown>): string {
    return (client.id as string) || (client.password as string) || '';
  }

  // === Subscription ===

  getSubscriptionUrl(subId: string): string {
    // Subscriptions are served from the panel origin + sub path (not the web base path)
    const subPath = config.PANEL_SUB_PATH || '/sub';
    return `${this.panelOrigin}${subPath}/${subId}`;
  }

  // === Helpers ===

  private isReality(inbound: SanaeiInbound): boolean {
    try {
      const stream = JSON.parse(inbound.streamSettings);
      return stream.security === 'reality';
    } catch {
      return false;
    }
  }

  private generateUUID(): string {
    return crypto.randomUUID();
  }

  private generateSubId(): string {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  }

  // === Connection Test ===

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.useApiKey) {
        await this.login();
      }
      const inbounds = await this.getInbounds();
      const authMethod = this.useApiKey ? 'API Key (Bearer)' : 'Session (login)';
      return {
        success: true,
        message: `Connected via ${authMethod}. Found ${inbounds.length} inbounds.`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

export const sanaeiClient = new SanaeiClient();
