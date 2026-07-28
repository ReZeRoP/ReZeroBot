import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../api/client';

export function Users() {
  const [q, setQ] = useState('');
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', q],
    queryFn: () => adminApi.users(1, q),
  });

  const block = useMutation({
    mutationFn: ({ id, blocked }: { id: number; blocked: boolean }) =>
      adminApi.blockUser(id, blocked),
    onSuccess: () => {
      toast.success('به‌روز شد');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">کاربران</h1>
      </div>

      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی کاربر..."
          className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">نام</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">تلگرام</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">موجودی</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  در حال بارگذاری...
                </td>
              </tr>
            ) : (
              (users || []).map((user: any) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{user.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {user.firstName || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500" dir="ltr">
                    {user.username ? `@${user.username}` : user.telegramId}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {Number(user.balance).toLocaleString('fa-IR')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        !user.isBlocked
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.isBlocked ? 'مسدود' : 'فعال'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        block.mutate({ id: user.id, blocked: !user.isBlocked })
                      }
                      className="text-blue-600 text-xs hover:underline"
                    >
                      {user.isBlocked ? 'رفع مسدودیت' : 'مسدود'}
                    </button>
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
