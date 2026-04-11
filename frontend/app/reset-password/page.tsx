'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) { router.push('/'); return; }
    setToken(t);
  }, [searchParams]);

  const handleSubmit = async () => {
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('https://ai-reliability-backend.onrender.com/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Cannot connect to server');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔑</div>
          <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-gray-400">Enter your new password below</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          {success ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-green-400 font-semibold text-lg">Password reset!</p>
              <p className="text-gray-400 text-sm">You can now login with your new password.</p>
              <button onClick={() => router.push('/')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white
                           font-semibold py-3 rounded-xl transition-all">
                🔑 Go to Login
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 pr-12
                               border border-gray-700 focus:outline-none focus:border-blue-500"
                  />
                  <button type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Confirm Password</label>
                <input type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 text-white rounded-xl px-4 py-3
                             border border-gray-700 focus:outline-none focus:border-blue-500"
                />
              </div>
              {error && (
                <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}
              <button onClick={handleSubmit} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
                           text-white font-semibold py-3 rounded-xl transition-all">
                {loading ? '⏳ Resetting...' : '🔑 Reset Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    }>
      <ResetForm />
    </Suspense>
  );
}