export function Orders() {
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
            {[
              { id: 1, user: 'علی', product: 'VLESS ۵۰ گیگ', price: '۱۵۰,۰۰۰', status: 'active', date: '۱۴۰۵/۰۵/۰۱' },
              { id: 2, user: 'مریم', product: 'نامحدود ماهانه', price: '۲۵۰,۰۰۰', status: 'pending', date: '۱۴۰۵/۰۵/۰۲' },
              { id: 3, user: 'حسن', product: 'Trojan سه ماهه', price: '۴۰۰,۰۰۰', status: 'expired', date: '۱۴۰۵/۰۴/۱۵' },
            ].map((order) => (
              <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">#{order.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{order.user}</td>
                <td className="px-4 py-3 text-gray-700">{order.product}</td>
                <td className="px-4 py-3 text-gray-700">{order.price}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.status === 'active' ? 'bg-green-100 text-green-700' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {order.status === 'active' ? 'فعال' : order.status === 'pending' ? 'در انتظار' : 'منقضی'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{order.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
