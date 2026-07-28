import { useQuery } from '@tanstack/react-query';
import { Users, ShoppingCart, DollarSign, Package } from 'lucide-react';
import { adminApi } from '../api/client';

export function Dashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminApi.stats,
  });

  const cards = [
    {
      label: 'کاربران',
      value: stats?.totalUsers ?? '—',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: 'سفارشات',
      value: stats?.totalOrders ?? '—',
      icon: ShoppingCart,
      color: 'bg-green-500',
    },
    {
      label: 'درآمد (تومان)',
      value: stats?.totalRevenue != null ? Number(stats.totalRevenue).toLocaleString('fa-IR') : '—',
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      label: 'سرویس فعال',
      value: stats?.activeOrders ?? '—',
      icon: Package,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">داشبورد</h1>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          خطا در دریافت آمار. توکن یا API را بررسی کنید.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {isLoading ? '...' : stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                <stat.icon size={22} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-900 mb-2">پرداخت‌های در انتظار</h2>
        <p className="text-3xl font-bold text-yellow-600">
          {isLoading ? '...' : stats?.pendingPayments ?? 0}
        </p>
        <p className="text-sm text-gray-500 mt-1">برای تأیید به بخش پرداخت‌ها بروید</p>
      </div>
    </div>
  );
}
