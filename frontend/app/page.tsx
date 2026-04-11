'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const t = localStorage.getItem('theme') || 'dark';
    setTheme(t);
  }, []);

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-gray-950' : 'bg-gray-100';
  const card = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400';

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('email', data.email);
        localStorage.setItem('is_admin', data.is_admin);
        router.push('/dashboard');
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Cannot connect to server. Is Flask running?');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <main className={`min-h-screen ${bg} flex items-center justify-center p-6 transition-colors`}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🛡️</div>
          <h1 className={`text-4xl font-bold ${text} mb-2`}>AI Reliability</h1>
          <p className={subtext}>Monitor and guard LLM outputs in real time</p>
        </div>

        <div className={`rounded-2xl p-8 border shadow-2xl ${card}`}>
          {/* Toggle */}
          <div className={`flex rounded-xl p-1 mb-6 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
            {['Login', 'Sign Up'].map((label, idx) => (
              <button key={label}
                onClick={() => { setIsLogin(idx === 0); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                  ${isLogin === (idx === 0)
                    ? 'bg-blue-600 text-white'
                    : `${subtext} hover:text-blue-400`}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className={`text-sm mb-1 block ${subtext}`}>Email</label>
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="you@example.com"
                className={`w-full rounded-xl px-4 py-3 border focus:outline-none focus:border-blue-500 ${inputBg}`}
              />
            </div>

            <div>
              <label className={`text-sm mb-1 block ${subtext}`}>Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className={`w-full rounded-xl px-4 py-3 pr-12 border focus:outline-none focus:border-blue-500 ${inputBg}`}
                />
                <button type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${subtext} hover:text-blue-400 transition-colors`}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {isLogin && (
              <div className="text-right">
                <button
                  onClick={() => router.push('/forgot-password')}
                  className="text-blue-400 text-sm hover:text-blue-300 transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            {!isLogin && (
              <p className={`text-xs ${subtext}`}>Password must be at least 6 characters</p>
            )}

            {error && (
              <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
                         text-white font-semibold py-3 rounded-xl transition-all">
              {loading ? '⏳ Please wait...' : isLogin ? '🔑 Login' : '🚀 Create Account'}
            </button>
          </div>
        </div>

        <p className={`text-center text-xs mt-6 ${subtext}`}>
          AI Reliability Platform • Built with Flask + Next.js
        </p>
      </div>
    </main>
  );
}