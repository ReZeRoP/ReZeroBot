import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Layout } from './components/layout/Layout';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Services } from './pages/Services';
import { ServiceDetail } from './pages/ServiceDetail';
import { Wallet } from './pages/Wallet';
import { Account } from './pages/Account';
import { Support } from './pages/Support';
import { useTelegram } from './hooks/useTelegram';
import { api, setToken, getToken } from './api/client';

export default function App() {
  const { isReady, initData } = useTelegram();
  const [authed, setAuthed] = useState(!!getToken());
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;

    async function bootstrap() {
      if (getToken()) {
        setAuthed(true);
        // Refresh profile validity quietly
        try {
          await api.getProfile();
          return;
        } catch {
          // token invalid — reauth
        }
      }

      if (!initData) {
        // Dev / browser without Telegram — leave unauthenticated but usable for UI
        setAuthError('Open this app from Telegram to sign in.');
        setAuthed(false);
        return;
      }

      try {
        const res = await api.authTelegram(initData);
        if (cancelled) return;
        setToken(res.token);
        setAuthed(true);
        setAuthError(null);
      } catch (err: any) {
        if (cancelled) return;
        setAuthError(err?.message || 'Authentication failed. Send /start to the bot first.');
        setAuthed(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isReady, initData]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-tg-secondary-bg">
        <div className="animate-spin w-8 h-8 border-3 border-tg-button border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-tg-secondary-bg px-6 text-center">
        <p className="text-tg-text font-medium mb-2">در حال ورود...</p>
        {authError && <p className="text-sm text-red-500 mt-2">{authError}</p>}
        <div className="animate-spin w-8 h-8 border-3 border-tg-button border-t-transparent rounded-full mt-4" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<ServiceDetail />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/account" element={<Account />} />
          <Route path="/support" element={<Support />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
