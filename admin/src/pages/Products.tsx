import { Plus } from 'lucide-react';

export function Products() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">محصولات</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} />
          افزودن محصول
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { name: 'VLESS ماهانه ۵۰ گیگ', price: '۱۵۰,۰۰۰', volume: '۵۰ گیگ', duration: '۳۰ روز', active: true },
          { name: 'VLESS ماهانه نامحدود', price: '۲۵۰,۰۰۰', volume: 'نامحدود', duration: '۳۰ روز', active: true },
          { name: 'Trojan سه ماهه', price: '۴۰۰,۰۰۰', volume: '۱۵۰ گیگ', duration: '۹۰ روز', active: false },
        ].map((product, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm">{product.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs ${product.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {product.active ? 'فعال' : 'غیرفعال'}
              </span>
            </div>
            <div className="space-y-1 text-sm text-gray-500">
              <p>قیمت: {product.price} تومان</p>
              <p>حجم: {product.volume}</p>
              <p>مدت: {product.duration}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="flex-1 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">ویرایش</button>
              <button className="flex-1 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
