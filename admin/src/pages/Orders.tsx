import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/client';

export function Orders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => adminApi.orders(1),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">سفارشات</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">کاربر</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">محصول</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">قیمت</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">تاریخ</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  ...
                </td>
              </tr>
            ) : (
              (orders || []).map((order: any) => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">#{order.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">#{order.userId}</td>
                  <td className="px-4 py-3 text-gray-700">#{order.productId}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {Number(order.finalPrice).toLocaleString('fa-IR')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        order.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : order.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleDateString('fa-IR')
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
