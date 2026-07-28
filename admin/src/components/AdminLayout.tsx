import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  CreditCard,
  Server,
  Megaphone,
  Settings,
  LogOut,
} from 'lucide-react';
import { clsx } from 'clsx';
import { clearAdminToken } from '../api/client';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'داشبورد' },
  { path: '/users', icon: Users, label: 'کاربران' },
  { path: '/products', icon: Package, label: 'محصولات' },
  { path: '/orders', icon: ShoppingCart, label: 'سفارشات' },
  { path: '/payments', icon: CreditCard, label: 'پرداخت‌ها' },
  { path: '/panels', icon: Server, label: 'پنل‌ها' },
  { path: '/marketing', icon: Megaphone, label: 'بازاریابی' },
  { path: '/settings', icon: Settings, label: 'تنظیمات' },
];

export function AdminLayout() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-l border-gray-200 fixed h-full overflow-y-auto">
        <div className="p-5 border-b border-gray-100">
          <h1 className="font-bold text-lg text-gray-900">🤖 VPN Bot Admin</h1>
          <p className="text-xs text-gray-500 mt-1">پنل مدیریت</p>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => {
              clearAdminToken();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 mt-4"
          >
            <LogOut size={18} />
            خروج
          </button>
        </nav>
      </aside>

      <main className="flex-1 mr-64 p-6">
        <Outlet />
      </main>
    </div>
  );
}
