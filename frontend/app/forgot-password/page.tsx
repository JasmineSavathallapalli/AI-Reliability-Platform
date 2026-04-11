'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://ai-reliability-backend.onrender.com/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
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
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-white mb-2">Forgot Password</h1>
          <p className="text-gray-400">We'll send a reset link to your email</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <p className="text-green-400 font-semibold text-lg">Reset link sent!</p>
              <p className="text-gray-400 text-sm">
                Check your inbox at <span className="text-white font-medium">{email}</span>
              </p>
              <p className="text-gray-500 text-xs">
                The link expires in 1 hour. Check spam if you don't see it.
              </p>
              <button onClick={() => router.push('/')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white
                           font-semibold py-3 rounded-xl transition-all mt-4">
                ← Back to Login
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Email address</label>
                <input type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="you@example.com"
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
                {loading ? '⏳ Sending...' : '📧 Send Reset Link'}
              </button>
              <button onClick={() => router.push('/')}
                className="w-full text-gray-400 hover:text-white text-sm transition-colors py-2">
                ← Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}