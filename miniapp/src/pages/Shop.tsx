import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Clock, HardDrive, Tag } from 'lucide-react';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { clsx } from 'clsx';

export function Shop() {
  const { haptic } = useTelegram();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: api.getProducts,
  });

  const buyMutation = useMutation({
    mutationFn: api.createOrder,
    onSuccess: () => {
      haptic.success();
      toast.success('خرید با موفقیت انجام شد!');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setShowCheckout(false);
      setSelectedProduct(null);
    },
    onError: (err: Error) => {
      haptic.error();
      toast.error(err.message || 'خطا در خرید');
    },
  });

  const currentProducts = selectedCategory
    ? categories?.find((c: any) => c.id === selectedCategory)?.products || []
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-tg-text">فروشگاه</h1>

      {/* Category Tabs */}
      {isLoading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-9 w-20 rounded-full" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {categories?.map((cat: any) => (
            <button
              key={cat.id}
              onClick={() => {
                haptic.light();
                setSelectedCategory(cat.id);
              }}
              className={clsx(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                selectedCategory === cat.id
                  ? 'bg-tg-button text-tg-button-text shadow-md'
                  : 'bg-tg-bg text-tg-text shadow-sm',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      {!selectedCategory ? (
        <div className="text-center py-12">
          <Tag size={40} className="mx-auto text-tg-hint opacity-40" />
          <p className="text-sm text-tg-hint mt-3">یک دسته‌بندی انتخاب کنید</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
            {currentProducts.map((product: any, i: number) => (
              <motion.button
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  haptic.light();
                  setSelectedProduct(product);
                  setShowCheckout(true);
                }}
                className="w-full p-4 rounded-2xl bg-tg-bg shadow-sm text-right active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-tg-text">{product.name}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-tg-hint">
                        <HardDrive size={12} />
                        {product.volumeGb > 0 ? `${product.volumeGb} گیگ` : 'نامحدود'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-tg-hint">
                        <Clock size={12} />
                        {product.durationDays} روز
                      </span>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-tg-button text-lg">
                      {product.price.toLocaleString('fa-IR')}
                    </p>
                    <p className="text-[10px] text-tg-hint">تومان</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Checkout Bottom Sheet */}
      <AnimatePresence>
        {showCheckout && selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowCheckout(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full bg-tg-bg rounded-t-3xl p-6 safe-bottom"
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-bold text-tg-text">{selectedProduct.name}</h3>
              <div className="flex items-center gap-4 mt-3 text-sm text-tg-hint">
                <span className="flex items-center gap-1">
                  <HardDrive size={14} />
                  {selectedProduct.volumeGb > 0 ? `${selectedProduct.volumeGb} گیگ` : 'نامحدود'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {selectedProduct.durationDays} روز
                </span>
              </div>
              <div className="mt-4 p-3 bg-tg-secondary-bg rounded-xl">
                <div className="flex justify-between text-sm">
                  <span className="text-tg-hint">قیمت</span>
                  <span className="font-bold text-tg-text">
                    {selectedProduct.price.toLocaleString('fa-IR')} تومان
                  </span>
                </div>
              </div>
              <button
                onClick={() => buyMutation.mutate({ productId: selectedProduct.id })}
                disabled={buyMutation.isPending}
                className="w-full mt-4 py-3.5 bg-tg-button text-tg-button-text rounded-xl font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {buyMutation.isPending ? 'در حال پردازش...' : 'خرید از کیف پول'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
