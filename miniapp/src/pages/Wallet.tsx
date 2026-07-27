import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Plus } from 'lucide-react';
import { api } from '../api/client';

export function Wallet() {
  const { data, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: api.getWallet,
  });

  const balance = data?.balance ?? 0;
  const transactions = data?.transactions ?? [];

  const txTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
    charge: { icon: ArrowDownLeft, color: 'text-green-500 bg-green-100', label: 'شارژ' },
    purchase: { icon: ArrowUpRight, color: 'text-red-500 bg-red-100', label: 'خرید' },
    referral: { icon: ArrowDownLeft, color: 'text-blue-500 bg-blue-100', label: 'معرفی' },
    cashback: { icon: ArrowDownLeft, color: 'text-purple-500 bg-purple-100', label: 'کش‌بک' },
    gift: { icon: ArrowDownLeft, color: 'text-orange-500 bg-orange-100', label: 'هدیه' },
    admin_adjust: { icon: ArrowDownLeft, color: 'text-gray-500 bg-gray-100', label: 'تنظیم' },
    lottery: { icon: ArrowDownLeft, color: 'text-yellow-500 bg-yellow-100', label: 'قرعه‌کشی' },
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tg-text">کیف پول</h1>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="flex items-center gap-2 opacity-80">
          <WalletIcon size={18} />
          <span className="text-sm">موجودی</span>
        </div>
        <p className="text-3xl font-bold mt-2">{balance.toLocaleString('fa-IR')}</p>
        <p className="text-xs opacity-70 mt-1">تومان</p>
        <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-medium backdrop-blur-sm active:scale-95 transition-transform">
          <Plus size={14} />
          شارژ کیف پول
        </button>
      </motion.div>

      {/* Transactions */}
      <div>
        <h2 className="font-bold text-tg-text mb-3">تاریخچه تراکنش‌ها</h2>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-2">
            {transactions.map((tx: any, i: number) => {
              const config = txTypeConfig[tx.type] || txTypeConfig.charge;
              const Icon = config.icon;
              const isPositive = tx.amount > 0;

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-tg-bg shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${config.color}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-tg-text">{config.label}</p>
                      <p className="text-xs text-tg-hint">
                        {new Date(tx.createdAt).toLocaleDateString('fa-IR')}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {isPositive ? '+' : ''}{tx.amount.toLocaleString('fa-IR')}
                  </span>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-tg-bg rounded-xl">
            <WalletIcon size={32} className="mx-auto text-tg-hint opacity-40" />
            <p className="text-sm text-tg-hint mt-2">تراکنشی وجود ندارد</p>
          </div>
        )}
      </div>
    </div>
  );
}
