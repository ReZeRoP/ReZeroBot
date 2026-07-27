import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { User, Share2, Copy, Globe, Gift, ChevronLeft } from 'lucide-react';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

export function Account() {
  const { user, haptic } = useTelegram();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: api.getProfile,
  });

  const { data: referral } = useQuery({
    queryKey: ['referral'],
    queryFn: api.getReferral,
  });

  const copyRefLink = () => {
    if (referral?.link) {
      navigator.clipboard.writeText(referral.link);
      haptic.medium();
      toast.success('لینک معرفی کپی شد!');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tg-text">حساب کاربری</h1>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-tg-bg rounded-2xl p-5 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-tg-button to-blue-600 flex items-center justify-center">
            <User size={24} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-tg-text text-lg">
              {user?.first_name || profile?.firstName || 'کاربر'}
            </h2>
            <p className="text-sm text-tg-hint">@{user?.username || profile?.username || 'username'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="p-3 bg-tg-secondary-bg rounded-xl text-center">
            <p className="text-lg font-bold text-tg-text">
              {(profile?.balance ?? 0).toLocaleString('fa-IR')}
            </p>
            <p className="text-xs text-tg-hint">موجودی (تومان)</p>
          </div>
          <div className="p-3 bg-tg-secondary-bg rounded-xl text-center">
            <p className="text-lg font-bold text-tg-text">
              {referral?.count ?? 0}
            </p>
            <p className="text-xs text-tg-hint">معرفی‌ها</p>
          </div>
        </div>
      </motion.div>

      {/* Referral Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-tg-bg rounded-2xl p-5 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <Gift size={18} className="text-orange-500" />
          <h3 className="font-bold text-tg-text">سیستم معرفی</h3>
        </div>
        <p className="text-sm text-tg-hint mb-3">
          دوستانتان را معرفی کنید و {(referral?.earnings ?? 0).toLocaleString('fa-IR')} تومان درآمد داشته باشید!
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-tg-secondary-bg p-3 rounded-lg truncate text-tg-text" dir="ltr">
            {referral?.link || '...'}
          </code>
          <button onClick={copyRefLink} className="p-3 bg-tg-button rounded-lg active:scale-95 transition-transform">
            <Copy size={14} className="text-tg-button-text" />
          </button>
          <button
            onClick={() => {
              if (referral?.link) {
                (window as any).Telegram?.WebApp?.openTelegramLink?.(
                  `https://t.me/share/url?url=${encodeURIComponent(referral.link)}&text=${encodeURIComponent('بیا VPN بخر!')}`
                );
              }
            }}
            className="p-3 bg-green-500 rounded-lg active:scale-95 transition-transform"
          >
            <Share2 size={14} className="text-white" />
          </button>
        </div>
      </motion.div>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-tg-bg rounded-2xl shadow-sm overflow-hidden"
      >
        <button className="w-full flex items-center justify-between p-4 active:bg-tg-secondary-bg transition-colors">
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-tg-hint" />
            <span className="text-sm font-medium text-tg-text">زبان / Language</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-tg-hint">فارسی</span>
            <ChevronLeft size={14} className="text-tg-hint" />
          </div>
        </button>
      </motion.div>
    </div>
  );
}
