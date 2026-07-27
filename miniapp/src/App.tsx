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

export default function App() {
  const { isReady } = useTelegram();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-tg-secondary-bg">
        <div className="animate-spin w-8 h-8 border-3 border-tg-button border-t-transparent rounded-full" />
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
