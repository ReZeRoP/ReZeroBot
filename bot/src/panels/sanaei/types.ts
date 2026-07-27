export interface SanaeiLoginResponse {
  success: boolean;
  msg?: string;
}

export interface SanaeiInbound {
  id: number;
  up: number;
  down: number;
  total: number;
  remark: string;
  enable: boolean;
  expiryTime: number;
  listen: string;
  port: number;
  protocol: string;
  settings: string;
  streamSettings: string;
  tag: string;
  sniffing: string;
  clientStats?: SanaeiClientStat[];
}

export interface SanaeiClientStat {
  id: number;
  inboundId: number;
  enable: boolean;
  email: string;
  up: number;
  down: number;
  expiryTime: number;
  total: number;
  reset: number;
}

export interface SanaeiClient {
  id?: string;
  alterId?: number;
  email: string;
  limitIp?: number;
  totalGB: number;
  expiryTime: number;
  enable: boolean;
  tgId?: string;
  subId?: string;
  reset?: number;
  flow?: string;
  method?: string;
  password?: string;
  comment?: string;
}

export interface SanaeiApiResponse<T = unknown> {
  success: boolean;
  msg?: string;
  obj?: T;
}

export interface SanaeiInboundSettings {
  clients?: SanaeiClient[];
  decryption?: string;
  fallbacks?: unknown[];
}

export interface SanaeiStreamSettings {
  network: string;
  security: string;
  tlsSettings?: {
    serverName: string;
    certificates: Array<{
      certificateFile?: string;
      keyFile?: string;
      certificate?: string[];
      key?: string[];
    }>;
  };
  realitySettings?: {
    dest: string;
    serverNames: string[];
    privateKey: string;
    publicKey: string;
    shortIds: string[];
    spiderX?: string;
  };
  wsSettings?: {
    path: string;
    headers?: Record<string, string>;
  };
  grpcSettings?: {
    serviceName: string;
  };
  tcpSettings?: {
    header?: {
      type: string;
      request?: unknown;
      response?: unknown;
    };
  };
  httpupgradeSettings?: {
    path: string;
    host?: string;
  };
}

export interface CreateClientParams {
  inboundId: number;
  email: string;
  totalGB: number; // bytes, 0 = unlimited
  expiryTime: number; // timestamp ms, 0 = unlimited
  enable?: boolean;
  limitIp?: number;
  flow?: string;
  subId?: string;
}

export interface UpdateClientParams {
  inboundId: number;
  clientId: string;
  email: string;
  totalGB: number;
  expiryTime: number;
  enable?: boolean;
  flow?: string;
}
