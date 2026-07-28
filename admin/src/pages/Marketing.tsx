import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../api/client';

export function Marketing() {
  const queryClient = useQueryClient();
  const { data: discounts } = useQuery({
    queryKey: ['admin-discounts'],
    queryFn: adminApi.discounts,
  });
  const { data: gifts } = useQuery({
    queryKey: ['admin-gifts'],
    queryFn: adminApi.gifts,
  });

  const [disc, setDisc] = useState({ code: '', percent: 10, maxUses: 0 });
  const [giftForm, setGiftForm] = useState({ count: 5, amount: 10000 });

  const createDisc = useMutation({
    mutationFn: () => adminApi.createDiscount(disc),
    onSuccess: () => {
      toast.success('کد تخفیف ساخته شد');
      queryClient.invalidateQueries({ queryKey: ['admin-discounts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const genGifts = useMutation({
    mutationFn: async () => {
      const list = await adminApi.generateGifts(giftForm.count, giftForm.amount);
      return list as any[];
    },
    onSuccess: (list) => {
      toast.success(`${list.length} کد هدیه ساخته شد`);
      queryClient.invalidateQueries({ queryKey: ['admin-gifts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">بازاریابی</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={18} className="text-blue-500" />
            <h3 className="font-bold text-gray-900">کد تخفیف</h3>
          </div>
          <input
            placeholder="CODE"
            value={disc.code}
            onChange={(e) => setDisc({ ...disc, code: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            dir="ltr"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={disc.percent}
              onChange={(e) => setDisc({ ...disc, percent: Number(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
            <input
              type="number"
              value={disc.maxUses}
              onChange={(e) => setDisc({ ...disc, maxUses: Number(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
          </div>
          <button
            onClick={() => createDisc.mutate()}
            className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium"
          >
            <Plus size={14} />
            ساخت
          </button>
          <ul className="text-xs text-gray-600 space-y-1 max-h-40 overflow-auto">
            {(discounts || []).map((d: any) => (
              <li key={d.id}>
                {d.code} — {d.percent}% ({d.usedCount}/{d.maxUses || '∞'})
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Gift size={18} className="text-orange-500" />
            <h3 className="font-bold text-gray-900">کد هدیه</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              value={giftForm.count}
              onChange={(e) => setGiftForm({ ...giftForm, count: Number(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
            <input
              type="number"
              value={giftForm.amount}
              onChange={(e) => setGiftForm({ ...giftForm, amount: Number(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
          </div>
          <button
            onClick={() => genGifts.mutate()}
            className="w-full flex items-center justify-center gap-2 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium"
          >
            <Plus size={14} />
            تولید
          </button>
          <ul className="text-xs text-gray-600 space-y-1 max-h-40 overflow-auto" dir="ltr">
            {(gifts || [])
              .filter((g: any) => !g.isUsed)
              .slice(0, 20)
              .map((g: any) => (
                <li key={g.id}>
                  {g.code} — {g.amount}
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
