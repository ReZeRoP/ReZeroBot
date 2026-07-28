import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi } from '../api/client';

export function Payments() {
  const queryClient = useQueryClient();
  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => adminApi.payments(),
  });

  const approve = useMutation({
    mutationFn: (id: number) => adminApi.approvePayment(id),
    onSuccess: () => {
      toast.success('تأیید شد');
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (id: number) => adminApi.rejectPayment(id),
    onSuccess: () => {
      toast.success('رد شد');
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (payments || []).filter((p: any) => p.status === 'pending');
  const others = (payments || []).filter((p: any) => p.status !== 'pending');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">پرداخت‌ها</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-900 mb-4">در انتظار تأیید</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">در حال بارگذاری...</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-500">موردی نیست</p>
        ) : (
          <div className="space-y-3">
            {pending.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    #{p.id} — {Number(p.amount).toLocaleString('fa-IR')} تومان
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {p.gateway} | {p.purpose || 'wallet'} | user #{p.userId}
                    {p.productId ? ` | product #${p.productId}` : ''}
                    {p.description ? ` | ${p.description}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve.mutate(p.id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                  >
                    تأیید
                  </button>
                  <button
                    onClick={() => reject.mutate(p.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                  >
                    رد
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-right px-4 py-3 text-gray-500">ID</th>
              <th className="text-right px-4 py-3 text-gray-500">مبلغ</th>
              <th className="text-right px-4 py-3 text-gray-500">درگاه</th>
              <th className="text-right px-4 py-3 text-gray-500">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {others.slice(0, 30).map((p: any) => (
              <tr key={p.id} className="border-b border-gray-50">
                <td className="px-4 py-3">#{p.id}</td>
                <td className="px-4 py-3">{Number(p.amount).toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3">{p.gateway}</td>
                <td className="px-4 py-3">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
