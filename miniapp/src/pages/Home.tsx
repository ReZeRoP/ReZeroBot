import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingBag, Package, Wallet, Gift, ChevronLeft } from 'lucide-react';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

export function Home() {
  const navigate = useNavigate();
  const { user, haptic } = useTelegram();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  const { data: orders } = useQuery({
    queryKey: ['orders'],
    queryFn: api.getOrders,
  });

  const balance = profile?.balance ?? 0;
  const activeServices = orders?.filter((o: any) => o.status === 'active')?.length ?? 0;

  const quickActions = [
    { icon: ShoppingBag, label: 'خرید', path: '/shop', color: 'bg-blue-500' },
    { icon: Package, label: 'سرویس‌ها', path: '/services', color: 'bg-green-500' },
    { icon: Wallet, label: 'کیف پول', path: '/wallet', color: 'bg-purple-500' },
    { icon: Gift, label: 'تست رایگان', path: '/shop', color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-tg-text">
            سلام، {user?.first_name || profile?.firstName || 'کاربر'} 👋
          </h1>
          <p className="text-sm text-tg-hint mt-0.5">خوش آمدید</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-tg-button flex items-center justify-center">
          <span className="text-tg-button-text font-bold text-sm">
            {(user?.first_name || 'U')[0]}
          </span>
        </div>
      </motion.div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-tg-button to-blue-600 rounded-2xl p-5 text-white shadow-lg"
      >
        <p className="text-sm opacity-80">موجودی کیف پول</p>
        <p className="text-3xl font-bold mt-1">{balance.toLocaleString('fa-IR')}</p>
        <p className="text-xs opacity-70 mt-0.5">تومان</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-sm opacity-90">
            <Package size={14} />
            <span>{activeServices} سرویس فعال</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-4 gap-3"
      >
        {quickActions.map((action, i) => (
          <button
            key={i}
            onClick={() => {
              haptic.light();
              navigate(action.path);
            }}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-tg-bg shadow-sm active:scale-95 transition-transform"
          >
            <div className={`w-11 h-11 rounded-xl ${action.color} flex items-center justify-center`}>
              <action.icon size={20} className="text-white" />
            </div>
            <span className="text-xs font-medium text-tg-text">{action.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Recent Services */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-tg-text">سرویس‌های اخیر</h2>
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-1 text-sm text-tg-link"
          >
            مشاهده همه
            <ChevronLeft size={14} />
          </button>
        </div>

        {orders && orders.length > 0 ? (
          <div className="space-y-2">
            {orders.slice(0, 3).map((order: any) => (
              <button
                key={order.id}
                onClick={() => navigate(`/services/${order.id}`)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-tg-bg shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <Package size={16} className="text-green-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-tg-text">سرویس #{order.id}</p>
                    <p className="text-xs text-tg-hint">
                      {order.volumeGb > 0 ? `${order.volumeGb} گیگ` : 'نامحدود'}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    order.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {order.status === 'active' ? 'فعال' : 'منقضی'}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-tg-bg rounded-xl">
            <Package size={32} className="mx-auto text-tg-hint opacity-50" />
            <p className="text-sm text-tg-hint mt-2">هنوز سرویسی ندارید</p>
            <button
              onClick={() => navigate('/shop')}
              className="mt-3 px-4 py-2 bg-tg-button text-tg-button-text rounded-lg text-sm font-medium"
            >
              خرید سرویس
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
