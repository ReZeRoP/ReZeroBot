import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, RefreshCw, PlusCircle, Link, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';

export function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.getOrder(Number(id)),
    enabled: !!id,
  });

  const renewMutation = useMutation({
    mutationFn: () => api.renewOrder(Number(id), order?.durationDays || 30),
    onSuccess: () => {
      haptic.success();
      toast.success('سرویس تمدید شد!');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: () => toast.error('خطا در تمدید'),
  });

  const volumeMutation = useMutation({
    mutationFn: () => api.addVolume(Number(id), 10),
    onSuccess: () => {
      haptic.success();
      toast.success('حجم اضافه شد!');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: () => toast.error('خطا در اضافه کردن حجم'),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    haptic.medium();
    toast.success('کپی شد!');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-48 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <p className="text-tg-hint">سرویس یافت نشد</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/services')} className="p-2 rounded-lg bg-tg-bg shadow-sm">
          <ArrowRight size={18} className="text-tg-text" />
        </button>
        <h1 className="text-lg font-bold text-tg-text">سرویس #{order.id}</h1>
        <span className={`text-xs px-2 py-1 rounded-full ${
          order.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {order.status === 'active' ? 'فعال' : 'منقضی'}
        </span>
      </div>

      {/* Info Card */}
      <div className="bg-tg-bg rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">حجم</span>
          <span className="font-medium text-tg-text">
            {order.volumeGb > 0 ? `${order.volumeGb} گیگابایت` : 'نامحدود'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">مدت</span>
          <span className="font-medium text-tg-text">{order.durationDays} روز</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">انقضا</span>
          <span className="font-medium text-tg-text">
            {order.expireAt ? new Date(order.expireAt).toLocaleDateString('fa-IR') : '-'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-tg-hint">نام کاربری</span>
          <span className="font-medium text-tg-text font-mono text-xs">{order.usernameOnPanel}</span>
        </div>
      </div>

      {/* QR Code */}
      {order.subLink && (
        <div className="bg-tg-bg rounded-2xl p-5 shadow-sm flex flex-col items-center">
          <p className="text-sm text-tg-hint mb-3">اسکن برای اتصال سریع</p>
          <div className="p-3 bg-white rounded-xl">
            <QRCodeSVG value={order.subLink} size={160} />
          </div>
        </div>
      )}

      {/* Subscription Link */}
      {order.subLink && (
        <div className="bg-tg-bg rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-tg-hint mb-2">لینک سابسکریپشن</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-tg-secondary-bg p-2.5 rounded-lg truncate text-tg-text" dir="ltr">
              {order.subLink}
            </code>
            <button
              onClick={() => copyToClipboard(order.subLink)}
              className="p-2.5 bg-tg-button rounded-lg"
            >
              <Copy size={14} className="text-tg-button-text" />
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => renewMutation.mutate()}
          disabled={renewMutation.isPending}
          className="flex items-center justify-center gap-2 py-3 bg-tg-bg rounded-xl shadow-sm font-medium text-sm text-tg-text active:scale-95 transition-transform disabled:opacity-50"
        >
          <RefreshCw size={16} className="text-tg-button" />
          تمدید
        </button>
        <button
          onClick={() => volumeMutation.mutate()}
          disabled={volumeMutation.isPending}
          className="flex items-center justify-center gap-2 py-3 bg-tg-bg rounded-xl shadow-sm font-medium text-sm text-tg-text active:scale-95 transition-transform disabled:opacity-50"
        >
          <PlusCircle size={16} className="text-green-500" />
          +۱۰ گیگ حجم
        </button>
      </div>

      <button
        onClick={() => order.subLink && copyToClipboard(order.subLink)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-tg-button text-tg-button-text rounded-xl font-bold text-sm active:scale-[0.98] transition-transform"
      >
        <Link size={16} />
        کپی لینک کانفیگ
      </button>
    </div>
  );
}
