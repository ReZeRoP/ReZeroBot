import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, Package, Wallet, User } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { path: '/', icon: Home, label: 'خانه' },
  { path: '/shop', icon: ShoppingBag, label: 'فروشگاه' },
  { path: '/services', icon: Package, label: 'سرویس‌ها' },
  { path: '/wallet', icon: Wallet, label: 'کیف پول' },
  { path: '/account', icon: User, label: 'حساب' },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-tg-secondary-bg">
      <main className="flex-1 pb-20 px-4 pt-4 overflow-y-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-tg-section-separator safe-bottom z-50">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={clsx(
                  'relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200',
                  isActive ? 'text-tg-button scale-105' : 'text-tg-hint hover:text-tg-text',
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute -top-0.5 w-8 h-1 bg-tg-button rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
