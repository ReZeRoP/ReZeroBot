export function Payments() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">پرداخت‌ها</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-bold text-gray-900 mb-4">در انتظار تأیید</h2>
        <div className="space-y-3">
          {[
            { id: 1, user: 'علی', amount: '۱۵۰,۰۰۰', gateway: 'کارت به کارت', time: '۱۰ دقیقه پیش' },
            { id: 2, user: 'رضا', amount: '۲۵۰,۰۰۰', gateway: 'کارت به کارت', time: '۱ ساعت پیش' },
          ].map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-100">
              <div>
                <p className="text-sm font-medium text-gray-900">{p.user} - {p.amount} تومان</p>
                <p className="text-xs text-gray-500 mt-1">{p.gateway} | {p.time}</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">تأیید</button>
                <button className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">رد</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
