import { Search } from 'lucide-react';

export function Users() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">کاربران</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="جستجوی کاربر..."
          className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-right px-4 py-3 font-medium text-gray-500">ID</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">نام</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">یوزرنیم</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">موجودی</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">وضعیت</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: 1, name: 'علی رضایی', username: '@ali', balance: '۵۰,۰۰۰', active: true },
              { id: 2, name: 'مریم احمدی', username: '@maryam', balance: '۱۲۰,۰۰۰', active: true },
              { id: 3, name: 'حسن محمدی', username: '@hasan', balance: '۰', active: false },
            ].map((user) => (
              <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{user.id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                <td className="px-4 py-3 text-gray-500">{user.username}</td>
                <td className="px-4 py-3 text-gray-700">{user.balance}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.active ? 'فعال' : 'مسدود'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-blue-600 text-xs hover:underline">ویرایش</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
