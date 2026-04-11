'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [queriesRemaining, setQueriesRemaining] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [fontSize, setFontSize] = useState('medium');
  const [showEval, setShowEval] = useState(true);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const sidebar = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const text = isDark ? 'text-white' : 'text-gray-900';
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400';
  const aiBubble = isDark
    ? 'bg-gray-800 text-gray-100'
    : 'bg-white border border-gray-200 text-gray-900';
  const hoverItem = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100';
  const activeConv = isDark
    ? 'bg-gray-800 border-l-2 border-blue-500'
    : 'bg-blue-50 border-l-2 border-blue-500';
  const settingsPanel = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const divider = isDark ? 'border-gray-800' : 'border-gray-200';
  const fontClass = fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/'); return; }
    setEmail(localStorage.getItem('email') || '');
    setIsAdmin(localStorage.getItem('is_admin') === 'true');
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    setFontSize(localStorage.getItem('fontSize') || 'medium');
    setShowEval(localStorage.getItem('showEval') !== 'false');
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getToken = () => localStorage.getItem('token');

  const fetchConversations = async () => {
    try {
      const res = await fetch('https://ai-reliability-backend.onrender.com/conversations', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.conversations) setConversations(data.conversations);
    } catch { }
  };

  const loadConversation = async (convId: number) => {
    setCurrentConvId(convId);
    try {
      const res = await fetch(`https://ai-reliability-backend.onrender.com/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch { }
  };

  const startNewChat = () => {
    setCurrentConvId(null);
    setMessages([]);
    setMessage('');
    setUploadedFile(null);
  };

  const sendMessage = async (msgText: string, convId: number | null) => {
    setLoading(true);
    setMessages(prev => [...prev, {
      id: Date.now(),
      user_message: msgText,
      ai_response: null,
      loading: true,
      file: uploadedFile
    }]);

    try {
      const res = await fetch('https://ai-reliability-backend.onrender.com/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          message: msgText,
          conversation_id: convId,
          file_context: uploadedFile
        })
      });
      const data = await res.json();

      if (data.conversation_id && !convId) {
        setCurrentConvId(data.conversation_id);
        fetchConversations();
      }
      if (data.queries_remaining !== undefined) {
        setQueriesRemaining(data.queries_remaining);
      }

      setMessages(prev => prev.map(m =>
        m.loading ? {
          ...m,
          ai_response: data.blocked ? `🚫 Blocked: ${data.reason}` : data.ai_response,
          evaluation: data.evaluation,
          blocked: data.blocked,
          loading: false
        } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.loading ? { ...m, ai_response: '❌ Failed to connect.', loading: false } : m
      ));
    }
    setUploadedFile(null);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!message.trim() && !uploadedFile) return;
    const msg = message || `Please analyze this file: ${uploadedFile?.filename}`;
    setMessage('');
    await sendMessage(msg, currentConvId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEditSubmit = async (msgId: number) => {
    if (!editingText.trim()) return;
    const idx = messages.findIndex(m => m.id === msgId);
    setMessages(messages.slice(0, idx));
    setEditingMsgId(null);
    await sendMessage(editingText, currentConvId);
  };

  const deleteConversation = async (convId: number) => {
    if (!confirm('Delete this chat?')) return;
    await fetch(`https://ai-reliability-backend.onrender.com/conversations/${convId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    if (currentConvId === convId) {
      setCurrentConvId(null);
      setMessages([]);
    }
    fetchConversations();
  };

  const clearHistory = async () => {
    if (!confirm('Clear all chat history?')) return;
    await fetch('https://ai-reliability-backend.onrender.com/history/clear', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    setConversations([]);
    setMessages([]);
    setCurrentConvId(null);
  };

  const handleLogout = () => { localStorage.clear(); router.push('/'); };
  const saveSetting = (key: string, value: string) => localStorage.setItem(key, value);

  const getGradeColor = (grade: string) => {
    if (grade === 'A') return 'text-green-400';
    if (grade === 'B') return 'text-blue-400';
    if (grade === 'C') return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('https://ai-reliability-backend.onrender.com/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) setUploadedFile(data.file_context);
    } catch { console.error('Upload failed'); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={`flex h-screen ${bg} ${text} overflow-hidden transition-colors`}>

      {/* SIDEBAR */}
      <div className={`w-64 flex flex-col border-r ${sidebar} shrink-0`}>
        <div className={`px-4 py-4 border-b ${divider}`}>
          <h1 className="text-lg font-bold">🛡️ AI Reliability</h1>
          <p className={`text-xs ${subtext} mt-0.5 truncate`}>{email}</p>
        </div>

        <div className="p-3">
          <button onClick={startNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white
                       text-sm font-semibold py-2.5 rounded-xl transition-all
                       flex items-center justify-center gap-2">
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <p className={`text-xs ${subtext} px-2 mb-2 uppercase tracking-wider font-medium`}>
            Recent Chats
          </p>
          {conversations.length === 0
            ? <p className={`text-xs ${subtext} px-2`}>No chats yet</p>
            : conversations.map(conv => (
              <div key={conv.id}
                className={`group flex items-center gap-1 rounded-xl mb-1 transition-all
                  ${currentConvId === conv.id ? activeConv : hoverItem}`}>
                <button onClick={() => loadConversation(conv.id)}
                  className="flex-1 text-left px-3 py-2.5 min-w-0">
                  <p className={`text-sm font-medium ${text} truncate`}>{conv.title}</p>
                  <p className={`text-xs ${subtext}`}>{conv.message_count} messages</p>
                </button>
                <button onClick={() => deleteConversation(conv.id)}
                  className="opacity-0 group-hover:opacity-100 pr-2 text-gray-500
                             hover:text-red-400 transition-all text-sm shrink-0">
                  🗑️
                </button>
              </div>
            ))
          }
        </div>

        <div className={`p-3 border-t ${divider} space-y-0.5`}>
          <p className={`text-xs ${subtext} text-center mb-2`}>
            🔥 {queriesRemaining}/30 queries left today
          </p>
          {isAdmin && (
            <button onClick={() => router.push('/admin')}
              className="w-full text-left px-3 py-2 rounded-xl text-sm
                         text-yellow-400 hover:bg-yellow-400/10 transition-all">
              ⚙️ Admin Dashboard
            </button>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm ${subtext} ${hoverItem} transition-all`}>
            🎛️ Settings
          </button>
          <button onClick={clearHistory}
            className="w-full text-left px-3 py-2 rounded-xl text-sm
                       text-red-400 hover:bg-red-400/10 transition-all">
            🗑️ Clear All History
          </button>
          <button onClick={handleLogout}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm ${subtext} ${hoverItem} transition-all`}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Settings */}
        {showSettings && (
          <div className={`${settingsPanel} border-b ${divider} p-5`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`font-bold ${text}`}>🎛️ Settings</h3>
              <button onClick={() => setShowSettings(false)}
                className="text-sm text-red-400 hover:text-red-300">✕ Close</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className={`text-xs ${subtext} mb-2 font-medium uppercase tracking-wide`}>Theme</p>
                <div className="flex gap-2">
                  {['dark', 'light'].map(t => (
                    <button key={t} onClick={() => { setTheme(t); saveSetting('theme', t); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${theme === t ? 'bg-blue-600 text-white'
                          : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                      {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={`text-xs ${subtext} mb-2 font-medium uppercase tracking-wide`}>Font Size</p>
                <div className="flex gap-1">
                  {['small', 'medium', 'large'].map(f => (
                    <button key={f} onClick={() => { setFontSize(f); saveSetting('fontSize', f); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${fontSize === f ? 'bg-blue-600 text-white'
                          : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                      {f === 'small' ? 'S' : f === 'medium' ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={`text-xs ${subtext} mb-2 font-medium uppercase tracking-wide`}>Eval Scores</p>
                <button onClick={() => { setShowEval(!showEval); saveSetting('showEval', String(!showEval)); }}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${showEval ? 'bg-green-600 text-white'
                      : isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                  {showEval ? '✅ Visible' : '🚫 Hidden'}
                </button>
              </div>
              <div className="col-span-2 md:col-span-3">
                <p className={`text-xs ${subtext} mb-2 font-medium uppercase tracking-wide`}>Account</p>
                <div className={`rounded-xl px-4 py-3 text-xs space-y-1
                  ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <p>📧 {email}</p>
                  <p className={subtext}>🔥 {queriesRemaining}/30 queries remaining today</p>
                  <p className={subtext}>🛡️ {isAdmin ? 'Admin Account' : 'Standard Account'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="text-7xl">🛡️</div>
              <h2 className={`text-2xl font-bold ${text}`}>AI Reliability Platform</h2>
              <p className={subtext}>Send a message or upload a file to start</p>
              <div className="grid grid-cols-2 gap-3 mt-4 max-w-lg w-full">
                {[
                  'What is machine learning?',
                  'Explain neural networks',
                  'What is prompt injection?',
                  'How does RAG work?'
                ].map(s => (
                  <button key={s} onClick={() => setMessage(s)}
                    className={`text-left px-4 py-3 rounded-xl text-sm border transition-all
                      ${isDark
                        ? 'border-gray-700 hover:bg-gray-800 text-gray-300'
                        : 'border-gray-300 hover:bg-gray-100 text-gray-600'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg.id || i} className="space-y-3 max-w-3xl mx-auto w-full">

                {/* User Message */}
                <div className="flex justify-end">
                  <div className="relative max-w-xl w-full">
                    {editingMsgId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          className={`w-full rounded-2xl px-4 py-3 text-sm border
                                     focus:outline-none focus:border-blue-500 resize-none ${inputBg}`}
                          rows={3} autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingMsgId(null)}
                            className={`px-3 py-1 text-xs rounded-lg transition-all
                              ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                            Cancel
                          </button>
                          <button onClick={() => handleEditSubmit(msg.id)}
                            className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                            Send ➤
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        {msg.file && (
                          <div className={`px-3 py-1.5 rounded-xl text-xs mb-1
                            ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>
                            📎 {msg.file.filename}
                          </div>
                        )}
                        <div className={`px-4 py-3 rounded-2xl rounded-tr-sm bg-blue-600 text-white ${fontClass}`}>
                          <p>{msg.user_message}</p>
                        </div>
                        <button
                          onClick={() => { setEditingMsgId(msg.id); setEditingText(msg.user_message); }}
                          className={`text-xs px-2 py-0.5 rounded-lg transition-all
                            ${isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}>
                          ✏️ Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex justify-start">
                  <div className={`max-w-xl px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm ${aiBubble}`}>
                    {msg.loading ? (
                      <div className="flex gap-1.5 items-center py-1">
                        {[0, 150, 300].map(d => (
                          <div key={d} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    ) : (
                      <>
                        <p className={`whitespace-pre-wrap ${fontClass}`}>{msg.ai_response}</p>
                        {showEval && msg.evaluation && !msg.blocked && (
                          <div className={`mt-3 pt-3 border-t ${divider}`}>
                            <div className="flex gap-4 flex-wrap items-center">
                              {['relevance', 'length', 'quality', 'overall'].map(k => (
                                <div key={k} className="text-center">
                                  <p className={`text-xs ${subtext} capitalize`}>{k}</p>
                                  <p className="text-xs font-bold">{msg.evaluation[k]}</p>
                                </div>
                              ))}
                              <div className="ml-auto">
                                <span className={`text-xs ${subtext}`}>Grade </span>
                                <span className={`font-bold text-lg ${getGradeColor(msg.evaluation.grade)}`}>
                                  {msg.evaluation.grade}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-4 border-t ${divider}`}>
          <div className="max-w-3xl mx-auto">

            {/* File preview */}
            {uploadedFile && (
              <div className={`mb-2 px-3 py-2 rounded-xl flex items-center gap-2 text-sm
                ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <span>
                  {uploadedFile.type === 'pdf' ? '📄' :
                   uploadedFile.type === 'image' ? '🖼️' : '📝'}
                </span>
                <span className={`${text} truncate flex-1`}>{uploadedFile.filename}</span>
                <button onClick={() => setUploadedFile(null)}
                  className="text-red-400 hover:text-red-300 text-xs shrink-0">
                  ✕ Remove
                </button>
              </div>
            )}

            {uploading && (
              <div className={`mb-2 px-3 py-2 rounded-xl text-sm
                ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <span className={subtext}>⏳ Uploading file...</span>
              </div>
            )}

            <div className="flex gap-3 items-end">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.txt,.csv,.md,.json,.jpg,.jpeg,.png,.gif,.webp"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload file"
                className={`rounded-2xl px-3 py-3 transition-all shrink-0 border
                  ${isDark
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-white'
                    : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-500 hover:text-gray-900'}`}>
                📎
              </button>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={uploadedFile
                  ? `Ask something about ${uploadedFile.filename}...`
                  : "Message AI Reliability... (Enter to send, Shift+Enter for new line)"}
                rows={1}
                className={`flex-1 rounded-2xl px-4 py-3 ${fontClass} border
                           focus:outline-none focus:border-blue-500 resize-none ${inputBg}`}
                style={{ minHeight: '48px', maxHeight: '200px' }}
              />
              <button onClick={handleSubmit}
                disabled={loading || (!message.trim() && !uploadedFile)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
                           text-white rounded-2xl px-5 py-3 font-semibold
                           transition-all shrink-0 text-lg">
                ➤
              </button>
            </div>
            <p className={`text-xs ${subtext} text-center mt-2`}>
              🔥 {queriesRemaining}/30 queries remaining • 📎 Supports PDF, images, text files
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}