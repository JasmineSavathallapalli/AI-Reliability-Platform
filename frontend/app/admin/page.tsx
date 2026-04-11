'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function Admin() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [queries, setQueries] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'queries' | 'users'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useState('dark');

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-gray-950' : 'bg-gray-100';
  const nav = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500';
  const card = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const tableHead = isDark ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-100 text-gray-500';
  const tableRow = isDark ? 'border-gray-800 hover:bg-gray-800/50' : 'border-gray-200 hover:bg-gray-50';
  const tabActive = 'bg-blue-600 text-white';
  const tabInactive = isDark
    ? 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
    : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200';
  const divider = isDark ? 'border-gray-800' : 'border-gray-200';

  const getToken = () => localStorage.getItem('token');

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [statsRes, queriesRes, usersRes] = await Promise.all([
        fetch('https://ai-reliability-backend.onrender.com/admin/stats', {
          headers: { Authorization: `Bearer ${getToken()}` }
        }),
        fetch('https://ai-reliability-backend.onrender.com/admin/queries', {
          headers: { Authorization: `Bearer ${getToken()}` }
        }),
        fetch('https://ai-reliability-backend.onrender.com/admin/users', {
          headers: { Authorization: `Bearer ${getToken()}` }
        })
      ]);
      setStats(await statsRes.json());
      setQueries((await queriesRes.json()).queries || []);
      setUsers((await usersRes.json()).users || []);
    } catch { console.error('Failed to fetch'); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('is_admin');
    if (!token || isAdmin !== 'true') { router.push('/'); return; }
    setTheme(localStorage.getItem('theme') || 'dark');
    fetchData();
  }, [fetchData]);

  const handleBlockUser = async (userId: number) => {
    try {
      const res = await fetch(`https://ai-reliability-backend.onrender.com/admin/users/${userId}/block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.blocked !== undefined) {
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_blocked: data.blocked } : u
        ));
        // Update blocked_users count in stats
        setStats((prev: any) => ({
          ...prev,
          blocked_users: data.blocked
            ? (prev.blocked_users || 0) + 1
            : Math.max((prev.blocked_users || 0) - 1, 0)
        }));
      }
    } catch { console.error('Block failed'); }
  };

  const getGradeColor = (grade: string) => {
    if (grade === 'A') return 'text-green-400';
    if (grade === 'B') return 'text-blue-400';
    if (grade === 'C') return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) return (
    <main className={`min-h-screen ${bg} flex items-center justify-center`}>
      <p className={`${subtext} animate-pulse`}>Loading admin data...</p>
    </main>
  );

  return (
    <main className={`min-h-screen ${bg} ${text} transition-colors`}>

      {/* Navbar */}
      <nav className={`${nav} border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10`}>
        <div className="flex items-center gap-3">
          <span className="text-xl">⚙️</span>
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} disabled={refreshing}
            className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}
                       disabled:opacity-50 text-sm px-4 py-2 rounded-lg
                       flex items-center gap-2 transition-all`}>
            <span className={refreshing ? 'animate-spin inline-block' : ''}>🔄</span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
            ← Dashboard
          </button>
          <button onClick={() => { localStorage.clear(); router.push('/'); }}
            className={`${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'} text-sm px-4 py-2 rounded-lg`}>
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Users', value: stats?.total_users ?? 0, icon: '👥', color: 'text-blue-400' },
            { label: 'Total Queries', value: stats?.total_queries ?? 0, icon: '💬', color: 'text-green-400' },
            { label: 'Blocked Users', value: stats?.blocked_users ?? 0, icon: '🚫', color: 'text-red-400' },
            { label: 'Avg Score', value: stats?.avg_score ?? 0, icon: '📊', color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label} className={`${card} rounded-2xl p-5 border`}>
              <div className="flex justify-between items-start mb-3">
                <span className="text-2xl">{s.icon}</span>
                <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
              </div>
              <p className={`${subtext} text-sm`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['overview', 'queries', 'users'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all
                ${activeTab === tab ? tabActive : tabInactive}`}>
              {tab === 'overview' ? '📊 Overview' :
               tab === 'queries' ? '💬 Queries' : '👥 Users'}
            </button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className={`${card} rounded-2xl p-6 border`}>
              <h3 className="font-semibold mb-4">📈 Platform Summary</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Users', value: stats?.total_users },
                  { label: 'Blocked Users', value: stats?.blocked_users },
                  { label: 'Total Queries', value: stats?.total_queries },
                  { label: 'Blocked Queries', value: stats?.blocked_queries },
                  { label: 'Success Rate',
                    value: stats?.total_queries
                      ? `${(((stats.total_queries - stats.blocked_queries) / stats.total_queries) * 100).toFixed(1)}%`
                      : '0%' },
                  { label: 'Avg Quality Score', value: stats?.avg_score },
                ].map(item => (
                  <div key={item.label} className={`flex justify-between py-2 border-b ${divider}`}>
                    <span className={`${subtext} text-sm`}>{item.label}</span>
                    <span className="font-semibold text-sm">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${card} rounded-2xl p-6 border`}>
              <h3 className="font-semibold mb-4">👥 Recent Users</h3>
              <div className="space-y-2">
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className={`flex justify-between items-center py-2 border-b ${divider}`}>
                    <div>
                      <p className="text-sm">{u.email}</p>
                      <p className={`text-xs ${subtext}`}>{u.created_at?.slice(0, 10)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs ${subtext}`}>{u.total_queries} queries</p>
                      {u.is_admin && <span className="text-xs text-yellow-400">Admin</span>}
                      {u.is_blocked && <span className="text-xs text-red-400 block">Blocked</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Queries */}
        {activeTab === 'queries' && (
          <div className={`${card} rounded-2xl border overflow-hidden`}>
            <div className={`p-4 border-b ${divider}`}>
              <h3 className="font-semibold">💬 All Queries ({queries.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Query</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-center py-3 px-4">Score</th>
                    <th className="text-center py-3 px-4">Grade</th>
                    <th className="text-left py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map(q => (
                    <tr key={q.id} className={`border-b ${tableRow} transition-all`}>
                      <td className="py-3 px-4 text-blue-400 text-xs">{q.email}</td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="truncate">{q.user_message}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {q.blocked
                          ? <span className="text-red-400 text-xs">🚫 Blocked</span>
                          : <span className="text-green-400 text-xs">✅ OK</span>}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">{q.overall_score ?? '-'}</td>
                      <td className={`py-3 px-4 text-center font-bold ${getGradeColor(q.grade)}`}>
                        {q.grade ?? '-'}
                      </td>
                      <td className={`py-3 px-4 text-xs ${subtext}`}>
                        {q.created_at?.slice(0, 16)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className={`${card} rounded-2xl border overflow-hidden`}>
            <div className={`p-4 border-b ${divider}`}>
              <h3 className="font-semibold">👥 All Users ({users.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="text-left py-3 px-4">ID</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-center py-3 px-4">Role</th>
                    <th className="text-center py-3 px-4">Queries</th>
                    <th className="text-center py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Joined</th>
                    <th className="text-center py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className={`border-b ${tableRow} transition-all`}>
                      <td className={`py-3 px-4 ${subtext}`}>#{u.id}</td>
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4 text-center">
                        {u.is_admin
                          ? <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-lg text-xs">Admin</span>
                          : <span className={`${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'} px-2 py-1 rounded-lg text-xs`}>User</span>}
                      </td>
                      <td className="py-3 px-4 text-center">{u.total_queries}</td>
                      <td className="py-3 px-4 text-center">
                        {u.is_blocked
                          ? <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-lg text-xs">🚫 Blocked</span>
                          : <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-lg text-xs">✅ Active</span>}
                      </td>
                      <td className={`py-3 px-4 text-xs ${subtext}`}>{u.created_at?.slice(0, 10)}</td>
                      <td className="py-3 px-4 text-center">
                        {!u.is_admin && (
                          <button onClick={() => handleBlockUser(u.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                              ${u.is_blocked
                                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/40'
                                : 'bg-red-600/20 text-red-400 hover:bg-red-600/40'}`}>
                            {u.is_blocked ? '✅ Unblock' : '🚫 Block'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}