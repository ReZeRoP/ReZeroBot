import { useQuery } from '@tanstack/react-query';
import { Server, CheckCircle, XCircle } from 'lucide-react';
import { adminApi } from '../api/client';

export function Panels() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['panel-health'],
    queryFn: adminApi.panelHealth,
  });
  const { data: panels } = useQuery({
    queryKey: ['admin-panels'],
    queryFn: adminApi.panels,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">پنل‌ها</h1>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg"
        >
          بررسی مجدد
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Server size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Sanaei / 3x-ui (از .env)</h3>
            <p className="text-xs text-gray-500">اتصال از طریق PANEL_URL / PANEL_API_KEY</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">در حال بررسی...</p>
        ) : health?.success ? (
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} />
            {health.message}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <XCircle size={16} />
            {health?.message || 'Connection failed'}
          </div>
        )}
      </div>

      {(panels || []).length > 0 && (
        <div className="bg-white rounded-xl border p-5 space-y-2">
          <h3 className="font-bold mb-2">پنل‌های ثبت‌شده در دیتابیس</h3>
          {panels!.map((p: any) => (
            <div key={p.id} className="text-sm text-gray-700 border-b py-2">
              {p.name} — {p.url} ({p.status})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
