import { config } from '../config.js';

export interface PaymentRequest {
  amount: number; // Tomans
  orderId?: number;
  userId: number;
  description?: string;
  callbackUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  refId?: string;
  authority?: string;
  error?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  refId?: string;
  /** true when Zarinpal returns code 101 (already verified) */
  alreadyVerified?: boolean;
  error?: string;
}

/** Zarinpal expects amount in Rials (1 Toman = 10 Rials). */
export function tomansToRials(tomans: number): number {
  return Math.round(tomans * 10);
}

/** Rough Toman→USD for crypto gateways. Override via USD_TOMAN_RATE env. */
export function tomansToUsd(tomans: number): number {
  const rate = Number(process.env.USD_TOMAN_RATE || 90000);
  const usd = tomans / (rate > 0 ? rate : 90000);
  return Math.max(0.01, Math.round(usd * 100) / 100);
}

// === Zarinpal ===
export async function zarinpalRequest(params: PaymentRequest): Promise<PaymentResult> {
  if (!config.ZARINPAL_MERCHANT_ID) {
    return { success: false, error: 'Zarinpal not configured' };
  }

  try {
    const res = await fetch('https://api.zarinpal.com/pg/v4/payment/request.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: config.ZARINPAL_MERCHANT_ID,
        amount: tomansToRials(params.amount),
        callback_url: params.callbackUrl || `${config.DOMAIN}/api/v1/payment/zarinpal/callback`,
        description: params.description || 'VPN Purchase',
        metadata: { user_id: String(params.userId) },
      }),
    });

    const data = (await res.json()) as any;
    if (data.data?.code === 100) {
      return {
        success: true,
        authority: data.data.authority,
        paymentUrl: `https://www.zarinpal.com/pg/StartPay/${data.data.authority}`,
      };
    }
    return { success: false, error: data.errors?.message || data.data?.message || 'Request failed' };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function zarinpalVerify(authority: string, amountTomans: number): Promise<PaymentVerifyResult> {
  try {
    const res = await fetch('https://api.zarinpal.com/pg/v4/payment/verify.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: config.ZARINPAL_MERCHANT_ID,
        amount: tomansToRials(amountTomans),
        authority,
      }),
    });

    const data = (await res.json()) as any;
    const code = data.data?.code;
    if (code === 100) {
      return { success: true, refId: String(data.data.ref_id) };
    }
    if (code === 101) {
      // Already verified
      return { success: true, alreadyVerified: true, refId: String(data.data?.ref_id || '') };
    }
    return { success: false, error: data.errors?.message || `Verify failed code=${code}` };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

// === Aqayepardakht ===
export async function aqayepardakhtRequest(params: PaymentRequest): Promise<PaymentResult> {
  if (!config.AQAYEPARDAKHT_PIN) {
    return { success: false, error: 'Aqayepardakht not configured' };
  }

  try {
    const res = await fetch('https://panel.aqayepardakht.ir/api/v2/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: config.AQAYEPARDAKHT_PIN,
        amount: params.amount,
        callback: params.callbackUrl || `${config.DOMAIN}/api/v1/payment/aqayepardakht/callback`,
        invoice_id: params.orderId || Date.now(),
      }),
    });

    const data = (await res.json()) as any;
    if (data.status === 'success') {
      return {
        success: true,
        refId: data.transid,
        paymentUrl: `https://panel.aqayepardakht.ir/startpay/${data.transid}`,
      };
    }
    return { success: false, error: data.message || 'Request failed' };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

// === NowPayments (Crypto) ===
export async function nowpaymentsRequest(params: PaymentRequest): Promise<PaymentResult> {
  if (!config.NOWPAYMENTS_API_KEY) {
    return { success: false, error: 'NowPayments not configured' };
  }

  try {
    const res = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.NOWPAYMENTS_API_KEY,
      },
      body: JSON.stringify({
        price_amount: tomansToUsd(params.amount),
        price_currency: 'usd',
        order_id: String(params.orderId || `u${params.userId}-${Date.now()}`),
        order_description: params.description || 'VPN Purchase',
        success_url: `${config.DOMAIN}/api/v1/payment/nowpayments/callback?status=success`,
        cancel_url: `${config.DOMAIN}/api/v1/payment/nowpayments/callback?status=cancel`,
        ipn_callback_url: `${config.DOMAIN}/api/v1/payment/nowpayments/ipn`,
      }),
    });

    const data = (await res.json()) as any;
    if (data.invoice_url) {
      return { success: true, paymentUrl: data.invoice_url, refId: String(data.id) };
    }
    return { success: false, error: data.message || 'Request failed' };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

// === Plisio (Crypto) ===
export async function plisioRequest(params: PaymentRequest): Promise<PaymentResult> {
  if (!config.PLISIO_API_KEY) {
    return { success: false, error: 'Plisio not configured' };
  }

  try {
    const url = new URL('https://api.plisio.net/api/v1/invoices/new');
    url.searchParams.set('api_key', config.PLISIO_API_KEY);
    url.searchParams.set('currency', 'USDT');
    url.searchParams.set('source_currency', 'USD');
    url.searchParams.set('source_amount', String(tomansToUsd(params.amount)));
    url.searchParams.set('order_name', params.description || 'VPN Purchase');
    url.searchParams.set('order_number', String(params.orderId || Date.now()));
    url.searchParams.set('callback_url', `${config.DOMAIN}/api/v1/payment/plisio/callback`);

    const res = await fetch(url.toString());
    const data = (await res.json()) as any;

    if (data.status === 'success') {
      return { success: true, paymentUrl: data.data.invoice_url, refId: data.data.txn_id };
    }
    return { success: false, error: data.message || 'Request failed' };
  } catch {
    return { success: false, error: 'Network error' };
  }
}

// === Tronado (TRON) ===
export async function tronadoRequest(params: PaymentRequest): Promise<PaymentResult> {
  if (!config.TRONADO_API_KEY) {
    return { success: false, error: 'Tronado not configured' };
  }

  try {
    const res = await fetch('https://tronado.io/api/create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.TRONADO_API_KEY}`,
      },
      body: JSON.stringify({
        amount: tomansToUsd(params.amount),
        currency: 'USDT',
        network: 'TRC20',
        order_id: String(params.orderId || Date.now()),
        callback_url: `${config.DOMAIN}/api/v1/payment/tronado/callback`,
      }),
    });

    const data = (await res.json()) as any;
    if (data.payment_url) {
      return { success: true, paymentUrl: data.payment_url, refId: data.payment_id };
    }
    return { success: false, error: data.message || 'Request failed' };
  } catch {
    return { success: false, error: 'Network error' };
  }
}
