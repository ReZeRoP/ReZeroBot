import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../api/client';

export function Products() {
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: adminApi.products,
  });
  const { data: categories } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: adminApi.categories,
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    price: 100000,
    volumeGb: 50,
    durationDays: 30,
    categoryId: 0,
    inboundId: 1,
  });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createProduct({
        ...form,
        categoryId: form.categoryId || categories?.[0]?.id,
      }),
    onSuccess: () => {
      toast.success('محصول ایجاد شد');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminApi.deleteProduct(id),
    onSuccess: () => {
      toast.success('حذف شد');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">محصولات</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          افزودن محصول
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="نام"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value={0}>دسته...</option>
              {(categories || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="قیمت (تومان)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
            <input
              type="number"
              placeholder="حجم GB"
              value={form.volumeGb}
              onChange={(e) => setForm({ ...form, volumeGb: Number(e.target.value) })}
              className="border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
            <input
              type="number"
              placeholder="روز"
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
              className="border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
            <input
              type="number"
              placeholder="Panel Inbound ID"
              value={form.inboundId}
              onChange={(e) => setForm({ ...form, inboundId: Number(e.target.value) })}
              className="border rounded-lg px-3 py-2 text-sm"
              dir="ltr"
            />
          </div>
          <p className="text-xs text-gray-500">
            inboundId = شناسه inbound در پنل 3x-ui (نه id جدول محلی)
          </p>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            ذخیره
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-sm text-gray-500">...</p>}
        {(products || []).map((product: any) => (
          <div key={product.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">{product.name}</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {product.isActive ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
            <div className="space-y-1 text-sm text-gray-500">
              <p>قیمت: {Number(product.price).toLocaleString('fa-IR')} تومان</p>
              <p>حجم: {product.volumeGb > 0 ? `${product.volumeGb} گیگ` : 'نامحدود'}</p>
              <p>مدت: {product.durationDays} روز</p>
              <p dir="ltr">inbound: {product.inboundId ?? '—'}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (confirm('حذف شود؟')) remove.mutate(product.id);
                }}
                className="flex-1 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
