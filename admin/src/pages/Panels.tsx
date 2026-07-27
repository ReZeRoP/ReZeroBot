import { Server, CheckCircle } from 'lucide-react';

export function Panels() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">پنل‌ها</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Server size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">پنل اصلی (Sanaei)</h3>
              <p className="text-xs text-gray-500">http://panel.example.com:2053</p>
            </div>
          </div>
          <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs">
            <CheckCircle size={12} />
            متصل
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">تعداد Inbound</p>
            <p className="text-lg font-bold text-gray-900">۵</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">کلاینت‌های فعال</p>
            <p className="text-lg font-bold text-gray-900">۸۹</p>
          </div>
        </div>
        <button className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          تست اتصال
        </button>
      </div>
    </div>
  );
}
