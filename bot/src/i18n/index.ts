import { fa, type TranslationKey } from './fa.js';
import { en } from './en.js';

type Language = 'fa' | 'en';

const translations: Record<Language, Record<TranslationKey, string>> = { fa, en };

export function t(lang: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  let text = translations[lang]?.[key] || translations.fa[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function formatPrice(amount: number, lang: Language): string {
  const formatted = amount.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
  return `${formatted} ${t(lang, 'tomans')}`;
}

export function formatVolume(gb: number, lang: Language): string {
  if (gb === 0) return t(lang, 'unlimited');
  return `${gb} ${t(lang, 'gb')}`;
}

export function formatDuration(days: number, lang: Language): string {
  return `${days} ${t(lang, 'days')}`;
}

export { type TranslationKey, type Language };
