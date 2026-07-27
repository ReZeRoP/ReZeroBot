import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, ChevronDown, MessageCircle, BookOpen } from 'lucide-react';
import { api } from '../api/client';

export function Support() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: faq } = useQuery({
    queryKey: ['faq'],
    queryFn: api.getFaq,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tg-text">پشتیبانی</h1>

      {/* Contact Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-5 text-white shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Headphones size={22} />
          </div>
          <div>
            <h3 className="font-bold">نیاز به کمک دارید؟</h3>
            <p className="text-sm opacity-80 mt-0.5">تیم پشتیبانی ۲۴ ساعته آماده است</p>
          </div>
        </div>
        <button className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-white/20 rounded-xl text-sm font-medium backdrop-blur-sm active:scale-95 transition-transform">
          <MessageCircle size={16} />
          تماس با ادمین
        </button>
      </motion.div>

      {/* FAQ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={18} className="text-tg-hint" />
          <h2 className="font-bold text-tg-text">سوالات متداول</h2>
        </div>

        <div className="space-y-2">
          {(faq || []).map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-tg-bg rounded-xl shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-right"
              >
                <span className="text-sm font-medium text-tg-text">{item.q}</span>
                <ChevronDown
                  size={16}
                  className={`text-tg-hint transition-transform duration-200 ${
                    openFaq === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <p className="px-4 pb-4 text-sm text-tg-hint leading-relaxed">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Tutorials */}
      <div className="bg-tg-bg rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-tg-text mb-3">آموزش‌ها</h3>
        <div className="space-y-2">
          {['آموزش اتصال در اندروید', 'آموزش اتصال در آیفون', 'آموزش اتصال در ویندوز'].map(
            (title, i) => (
              <button
                key={i}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-tg-secondary-bg active:scale-[0.98] transition-transform"
              >
                <span className="text-sm text-tg-text">{title}</span>
                <ChevronDown size={14} className="text-tg-hint -rotate-90" />
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
