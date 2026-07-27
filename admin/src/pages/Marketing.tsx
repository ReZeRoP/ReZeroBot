import { Plus, Tag, Gift, Trophy } from 'lucide-react';

export function Marketing() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">بازاریابی</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Discount Codes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag size={18} className="text-blue-500" />
            <h3 className="font-bold text-gray-900">کد تخفیف</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">۳ کد فعال</p>
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100">
            <Plus size={14} />
            ساخت کد جدید
          </button>
        </div>

        {/* Gift Codes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gift size={18} className="text-orange-500" />
            <h3 className="font-bold text-gray-900">کد هدیه</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">۱۰ کد استفاده نشده</p>
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100">
            <Plus size={14} />
            تولید کد هدیه
          </button>
        </div>

        {/* Lottery */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={18} className="text-yellow-500" />
            <h3 className="font-bold text-gray-900">قرعه‌کشی</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">بدون قرعه‌کشی فعال</p>
          <button className="w-full flex items-center justify-center gap-2 py-2 bg-yellow-50 text-yellow-600 rounded-lg text-sm font-medium hover:bg-yellow-100">
            <Plus size={14} />
            ایجاد قرعه‌کشی
          </button>
        </div>
      </div>

      {/* Referral Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">تنظیمات معرفی</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">پاداش معرفی (تومان)</label>
            <input type="number" defaultValue={10000} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">کش‌بک خرید (%)</label>
            <input type="number" defaultValue={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          ذخیره
        </button>
      </div>
    </div>
  );
}
