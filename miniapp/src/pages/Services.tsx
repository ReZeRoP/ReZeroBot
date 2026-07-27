import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Package, Clock, HardDrive } from 'lucide-react';
import { api } from '../api/client';

export function Services() {
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: api.getOrders,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold text-tg-text">سرویس‌های من</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tg-text">سرویس‌های من</h1>

      {orders && orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order: any, i: number) => (
            <motion.button
              key={order.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/services/${order.id}`)}
              className="w-full p-4 rounded-2xl bg-tg-bg shadow-sm text-right active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    order.status === 'active' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <Package size={18} className={order.status === 'active' ? 'text-green-600' : 'text-red-600'} />
                  </div>
                  <div>
                    <p className="font-medium text-tg-text text-sm">سرویس #{order.id}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1 text-xs text-tg-hint">
                        <HardDrive size={11} />
                        {order.volumeGb > 0 ? `${order.volumeGb} گیگ` : 'نامحدود'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-tg-hint">
                        <Clock size={11} />
                        {order.durationDays} روز
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  order.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : order.status === 'expired'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.status === 'active' ? 'فعال' : order.status === 'expired' ? 'منقضی' : 'در انتظار'}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Package size={48} className="mx-auto text-tg-hint opacity-40" />
          <p className="text-tg-hint mt-3 text-sm">سرویسی یافت نشد</p>
          <button
            onClick={() => navigate('/shop')}
            className="mt-4 px-5 py-2.5 bg-tg-button text-tg-button-text rounded-xl text-sm font-medium"
          >
            خرید سرویس جدید
          </button>
        </div>
      )}
    </div>
  );
}
