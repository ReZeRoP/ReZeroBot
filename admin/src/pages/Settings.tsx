export function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">تنظیمات</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <h3 className="font-bold text-gray-900">تنظیمات ربات</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">نام ربات</label>
            <input type="text" defaultValue="VPN Bot" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-sm text-gray-500 block mb-1">کانال اجباری</label>
            <input type="text" defaultValue="@my_channel" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" dir="ltr" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" defaultChecked className="rounded" />
            تست رایگان فعال
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" defaultChecked className="rounded" />
            سیستم معرفی فعال
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded" />
            تأیید شماره تلفن
          </label>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          ذخیره تنظیمات
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">مدیران</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-700">ادمین اصلی (ID: 123456789)</span>
            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">مالک</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">پشتیبان‌گیری</h3>
        <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
          دریافت بکاپ
        </button>
      </div>
    </div>
  );
}
