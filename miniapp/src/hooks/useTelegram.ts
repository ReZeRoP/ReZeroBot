import { useEffect, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    query_id?: string;
  };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  platform: string;
  version: string;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  MainButton: {
    show: () => void;
    hide: () => void;
    setText: (text: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    enable: () => void;
    disable: () => void;
  };
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);
  const [tg, setTg] = useState<TelegramWebApp | null>(null);

  useEffect(() => {
    const webApp = (window as any).Telegram?.WebApp as TelegramWebApp | undefined;
    if (webApp) {
      webApp.ready();
      webApp.expand();
      setTg(webApp);
    }
    setIsReady(true);
  }, []);

  const user = tg?.initDataUnsafe?.user || null;
  const colorScheme = tg?.colorScheme || 'light';
  const isDark = colorScheme === 'dark';

  const haptic = {
    light: () => tg?.HapticFeedback.impactOccurred('light'),
    medium: () => tg?.HapticFeedback.impactOccurred('medium'),
    success: () => tg?.HapticFeedback.notificationOccurred('success'),
    error: () => tg?.HapticFeedback.notificationOccurred('error'),
  };

  return { isReady, tg, user, colorScheme, isDark, haptic, initData: tg?.initData || '' };
}
