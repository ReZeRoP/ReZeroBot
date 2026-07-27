import { config } from '../../config.js';
import type {
  SanaeiApiResponse,
  SanaeiInbound,
  SanaeiClientStat,
  CreateClientParams,
  UpdateClientParams,
} from './types.js';

export class SanaeiClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private cookie: string | null = null;
  private lastLogin: number = 0;
  private readonly SESSION_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(url?: string, username?: string, password?: string) {
    this.baseUrl = (url || config.PANEL_URL).replace(/\/$/, '');
    this.username = username || config.PANEL_USERNAME;
    this.password = password || config.PANEL_PASSWORD;
  }

  private async ensureSession(): Promise<void> {
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

    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('Sanaei panel login failed: no session cookie received');
    }

    this.cookie = setCookie.split(';')[0];
    this.lastLogin = Date.now();

    const data = (await res.json()) as SanaeiApiResponse;
    if (!data.success) {
      throw new Error(`Sanaei panel login failed: ${data.msg || 'unknown error'}`);
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<SanaeiApiResponse<T>> {
    await this.ensureSession();

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Cookie: this.cookie || '',
        ...options.headers,
      },
    });

    if (res.status === 401 || res.status === 302) {
      // Session expired, re-login and retry
      this.cookie = null;
      await this.login();
      return this.request<T>(path, options);
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

  // === Client Operations ===

  async addClient(params: CreateClientParams): Promise<void> {
    const inbound = await this.getInbound(params.inboundId);
    if (!inbound) {
      throw new Error(`Inbound ${params.inboundId} not found`);
    }

    const settings = JSON.parse(inbound.settings);
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
      newClient.method = settings.method || 'aes-256-gcm';
    }

    settings.clients = settings.clients || [];
    settings.clients.push(newClient);

    await this.request(`/panel/api/inbounds/addClient`, {
      method: 'POST',
      body: JSON.stringify({
        id: params.inboundId,
        settings: JSON.stringify(settings),
      }),
    });
  }

  async updateClient(params: UpdateClientParams): Promise<void> {
    const inbound = await this.getInbound(params.inboundId);
    if (!inbound) {
      throw new Error(`Inbound ${params.inboundId} not found`);
    }

    const settings = JSON.parse(inbound.settings);
    const clientIndex = settings.clients?.findIndex(
      (c: { id?: string; email?: string }) => c.id === params.clientId || c.email === params.email,
    );

    if (clientIndex === -1 || clientIndex === undefined) {
      throw new Error(`Client ${params.email} not found in inbound ${params.inboundId}`);
    }

    settings.clients[clientIndex] = {
      ...settings.clients[clientIndex],
      email: params.email,
      totalGB: params.totalGB,
      expiryTime: params.expiryTime,
      enable: params.enable ?? true,
      ...(params.flow !== undefined && { flow: params.flow }),
    };

    await this.request(`/panel/api/inbounds/updateClient/${params.clientId}`, {
      method: 'POST',
      body: JSON.stringify({
        id: params.inboundId,
        settings: JSON.stringify(settings),
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

  async getClientByEmail(inboundId: number, email: string) {
    const inbound = await this.getInbound(inboundId);
    if (!inbound) return null;

    const settings = JSON.parse(inbound.settings);
    return settings.clients?.find((c: { email: string }) => c.email === email) || null;
  }

  // === Subscription ===

  getSubscriptionUrl(subId: string): string {
    return `${this.baseUrl}/sub/${subId}`;
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
      await this.login();
      const inbounds = await this.getInbounds();
      return {
        success: true,
        message: `Connected successfully. Found ${inbounds.length} inbounds.`,
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
