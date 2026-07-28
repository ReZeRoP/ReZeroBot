import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminApi, clearAdminToken } from '../api/client';
import { useNavigate } from 'react-router-dom';

export function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-settings'], queryFn: adminApi.settings });
  const [form, setForm] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      if (newPassword) payload.admin_password = newPassword;
      return adminApi.saveSettings(payload);
    },
    onSuccess: () => {
      toast.success('ذخیره شد');
      setNewPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">تنظیمات</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="font-bold text-gray-900">رمز ادمین</h3>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="رمز جدید (خالی = بدون تغییر)"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          dir="ltr"
        />
        <button
          onClick={() => save.mutate()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          ذخیره
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">خروج</h3>
        <button
          onClick={() => {
            clearAdminToken();
            navigate('/login');
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          خروج از حساب
        </button>
      </div>
    </div>
  );
}
