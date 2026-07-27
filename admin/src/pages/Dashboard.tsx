import { Users, ShoppingCart, DollarSign, Package } from 'lucide-react';

export function Dashboard() {
  const stats = [
    { label: 'کاربران', value: '۱,۲۳۴', icon: Users, color: 'bg-blue-500' },
    { label: 'سفارشات', value: '۵۶۷', icon: ShoppingCart, color: 'bg-green-500' },
    { label: 'درآمد (تومان)', value: '۱۲,۳۴۵,۰۰۰', icon: DollarSign, color: 'bg-purple-500' },
    { label: 'سرویس فعال', value: '۸۹', icon: Package, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">داشبورد</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                <stat.icon size={22} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-900 mb-4">فعالیت‌های اخیر</h2>
        <div className="space-y-3">
          {[
            { text: 'کاربر جدید ثبت‌نام کرد', time: '۵ دقیقه پیش' },
            { text: 'سفارش #۱۲۳ پرداخت شد', time: '۱۵ دقیقه پیش' },
            { text: 'سرویس #۴۵ منقضی شد', time: '۱ ساعت پیش' },
            { text: 'پرداخت کارت به کارت تأیید شد', time: '۲ ساعت پیش' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{item.text}</span>
              <span className="text-xs text-gray-400">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
