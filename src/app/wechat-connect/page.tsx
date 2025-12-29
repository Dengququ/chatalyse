'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Users,
  User,
  RefreshCw,
  Check,
  Sparkles,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Link2,
  Search,
  CheckCircle,
  ChevronRight,
  Clock,
  Cloud,
  X
} from 'lucide-react';
import WordCloud from '@/components/WordCloud';

interface Contact {
  userName: string;
  nickName: string;
  remark: string;
  isFriend: boolean;
}

interface ParsedSession {
  id: string;
  name: string;
  type: 'group' | 'friend' | 'official' | 'openim' | 'system';
}

interface WordData {
  text: string;
  value: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function WechatConnectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [chatlogUrl, setChatlogUrl] = useState('http://localhost:5030');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const [sessions, setSessions] = useState<ParsedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, status: '' });
  const [analysisResults, setAnalysisResults] = useState<{ session: string; todos: number; error?: string }[]>([]);

  const [generatingWordCloud, setGeneratingWordCloud] = useState(false);
  const [wordCloudData, setWordCloudData] = useState<WordData[]>([]);
  const [showWordCloud, setShowWordCloud] = useState(false);
  const [wordCloudSessionName, setWordCloudSessionName] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const getSessionType = (userName: string): 'group' | 'friend' | 'official' | 'openim' | 'system' => {
    if (userName.includes('@chatroom')) return 'group';
    if (userName.includes('@openim')) return 'openim';
    if (userName.startsWith('gh_')) return 'official';
    if (userName.startsWith('wxid_')) return 'friend';
    const systemIds = ['brandsessionholder', 'brandservicesessionholder', 'notifymessage',
                       'weixin', 'newsapp', 'floatbottle', 'medianote', 'fmessage', 'filehelper'];
    if (systemIds.includes(userName)) return 'system';
    return 'friend';
  };

  const testConnection = async () => {
    setConnecting(true);
    setConnectionError('');
    setConnected(false);

    try {
      const res = await fetch(chatlogUrl + '/api/v1/contact?format=json', { method: 'GET', mode: 'cors' });
      if (res.ok) {
        setConnected(true);
        await loadSessions();
      } else {
        setConnectionError('连接失败: ' + res.status);
      }
    } catch (error: any) {
      setConnectionError('无法连接到chatlog服务: ' + error.message);
    } finally {
      setConnecting(false);
    }
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(chatlogUrl + '/api/v1/contact?format=json');
      const data = await res.json();

      if (!data.items) {
        setConnectionError('获取联系人列表失败');
        return;
      }

      const parsed: ParsedSession[] = data.items
        .map((item: Contact) => ({
          id: item.userName,
          name: item.remark || item.nickName || item.userName,
          type: getSessionType(item.userName),
        }))
        .filter((s: ParsedSession) => s.type === 'group' || s.type === 'friend');

      setSessions(parsed);
    } catch (error: any) {
      setConnectionError('加载会话失败: ' + error.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  const toggleSession = (id: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSessions(newSelected);
  };

  const selectAllGroups = () => {
    const groups = sessions.filter(s => s.type === 'group').map(s => s.id);
    setSelectedSessions(new Set(groups));
  };

  const clearSelection = () => {
    setSelectedSessions(new Set());
  };

  const generateWordCloud = async () => {
    if (selectedSessions.size === 0) {
      setConnectionError('请至少选择一个会话');
      return;
    }

    setGeneratingWordCloud(true);
    setConnectionError('');

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const timeRange = `${startDate.toISOString().split('T')[0]}~${endDate.toISOString().split('T')[0]}`;

      let allMessages = '';
      const sessionNames: string[] = [];

      for (const id of Array.from(selectedSessions)) {
        const sessionInfo = sessions.find(s => s.id === id);
        sessionNames.push(sessionInfo?.name || id);

        const encodedTalker = encodeURIComponent(id);
        const messagesRes = await fetch(
          `${chatlogUrl}/api/v1/chatlog?time=${timeRange}&talker=${encodedTalker}&limit=1000`
        );
        const messagesText = await messagesRes.text();

        if (messagesText && !messagesText.includes('"error"')) {
          allMessages += messagesText + '\n';
        }
      }

      if (!allMessages.trim()) {
        setConnectionError('未获取到聊天记录');
        setGeneratingWordCloud(false);
        return;
      }

      const wordCloudRes = await fetch('/api/wordcloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatContent: allMessages, limit: 100 }),
      });

      const wordCloudResult = await wordCloudRes.json();

      if (wordCloudResult.success && wordCloudResult.words?.length > 0) {
        setWordCloudData(wordCloudResult.words);
        setWordCloudSessionName(sessionNames.length > 1 ? `${sessionNames.length}个会话` : sessionNames[0]);
        setShowWordCloud(true);
      } else {
        setConnectionError('生成词云失败');
      }
    } catch (error: any) {
      setConnectionError('生成词云失败: ' + error.message);
    } finally {
      setGeneratingWordCloud(false);
    }
  };

  const analyzeSelected = async () => {
    if (selectedSessions.size === 0) {
      setConnectionError('请至少选择一个会话');
      return;
    }

    setAnalyzing(true);
    setConnectionError('');
    setAnalysisResults([]);
    setAnalysisProgress({ current: 0, total: selectedSessions.size, status: '准备中...' });

    const results: { session: string; todos: number; error?: string }[] = [];
    let current = 0;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const timeRange = `${startDate.toISOString().split('T')[0]}~${endDate.toISOString().split('T')[0]}`;

    const sessionList = Array.from(selectedSessions);

    for (let i = 0; i < sessionList.length; i++) {
      const id = sessionList[i];
      current++;
      const sessionInfo = sessions.find(s => s.id === id);
      const sourceName = sessionInfo?.name || id;

      setAnalysisProgress({
        current,
        total: selectedSessions.size,
        status: `正在分析: ${sourceName}`
      });

      try {
        const encodedTalker = encodeURIComponent(id);
        const messagesRes = await fetch(
          `${chatlogUrl}/api/v1/chatlog?time=${timeRange}&talker=${encodedTalker}&limit=100`
        );
        const messagesText = await messagesRes.text();

        if (!messagesText.trim() || messagesText.includes('"error"')) {
          results.push({ session: sourceName, todos: 0, error: '无聊天记录' });
          continue;
        }

        let analyzeData = null;
        let retryCount = 0;
        const maxRetries = 2;

        while (retryCount <= maxRetries) {
          const analyzeRes = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatContent: messagesText, source: sourceName }),
          });

          const responseData = await analyzeRes.json();

          if (analyzeRes.ok) {
            analyzeData = responseData;
            break;
          } else if (responseData.error?.includes('rate_limit')) {
            retryCount++;
            if (retryCount <= maxRetries) {
              setAnalysisProgress({
                current,
                total: selectedSessions.size,
                status: `速率限制，等待重试...`
              });
              await delay(5000);
            }
          } else {
            results.push({ session: sourceName, todos: -1, error: responseData.error });
            break;
          }
        }

        if (analyzeData?.todos?.length > 0) {
          for (const todo of analyzeData.todos) {
            await fetch('/api/todos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: todo.content,
                date: todo.date,
                priority: todo.priority,
                category: todo.category,
                source: todo.source || sourceName,
                appId: 'wechat_connect',
                sessionId: id,
              }),
            });
          }
          results.push({ session: sourceName, todos: analyzeData.todos.length });
        } else if (analyzeData) {
          results.push({ session: sourceName, todos: 0 });
        }
      } catch (error: any) {
        results.push({ session: sourceName, todos: -1, error: error.message });
      }

      if (i < sessionList.length - 1) {
        setAnalysisProgress({
          current,
          total: selectedSessions.size,
          status: '等待避免速率限制...'
        });
        await delay(3000);
      }
    }

    setAnalysisResults(results);
    setAnalyzing(false);

    const totalTodos = results.reduce((sum, r) => sum + Math.max(0, r.todos), 0);
    alert(totalTodos > 0 ? `分析完成！共提取 ${totalTodos} 个待办事项` : '分析完成，但未找到待办事项');
  };

  const filteredSessions = sessions.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupSessions = filteredSessions.filter(s => s.type === 'group');
  const friendSessions = filteredSessions.filter(s => s.type === 'friend');

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">微信连接</h1>
                <p className="text-sm text-gray-500">连接本地chatlog，选择群聊提取待办</p>
              </div>
            </div>
          </div>
          {connected && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">已连接</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Link2 size={20} className="text-indigo-600" />
            连接chatlog服务
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={chatlogUrl}
              onChange={(e) => setChatlogUrl(e.target.value)}
              placeholder="chatlog地址"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              onClick={testConnection}
              disabled={connecting}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 size={18} />}
              {connecting ? '连接中...' : '连接'}
            </button>
          </div>
          {connectionError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600">
              <AlertCircle size={18} />
              <span className="text-sm">{connectionError}</span>
            </div>
          )}
        </div>

        {connected && (
          <>
            <div className="bg-white rounded-xl border p-4 mb-4 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜索会话..."
                    className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                  />
                </div>
                <button
                  onClick={loadSessions}
                  disabled={loadingSessions}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="刷新会话列表"
                >
                  <RefreshCw size={18} className={loadingSessions ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-500">
                  已选择 <span className="font-bold text-indigo-600">{selectedSessions.size}</span> 个会话
                </span>
                <button onClick={selectAllGroups} className="text-sm text-indigo-600 hover:text-indigo-700">
                  选择所有群聊
                </button>
                <button onClick={clearSelection} className="text-sm text-gray-500 hover:text-gray-700">
                  清除选择
                </button>
                <button
                  onClick={generateWordCloud}
                  disabled={generatingWordCloud || selectedSessions.size === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                >
                  {generatingWordCloud ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Cloud size={18} />
                      生成词云
                    </>
                  )}
                </button>
                <button
                  onClick={analyzeSelected}
                  disabled={analyzing || selectedSessions.size === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      分析中 ({analysisProgress.current}/{analysisProgress.total})
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      AI分析提取待办
                    </>
                  )}
                </button>
              </div>
            </div>

            {analyzing && analysisProgress.status && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                <Clock size={18} className="text-blue-600" />
                <span className="text-blue-700">{analysisProgress.status}</span>
              </div>
            )}

            {analysisResults.length > 0 && (
              <div className="bg-white rounded-xl border p-4 mb-4">
                <h3 className="font-bold text-gray-800 mb-3">分析结果</h3>
                <div className="space-y-2">
                  {analysisResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-gray-700">{r.session}</span>
                      {r.todos >= 0 ? (
                        <span className={'text-sm px-2 py-0.5 rounded ' + (r.todos > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500')}>
                          {r.todos > 0 ? r.todos + ' 个待办' : '无待办'}
                        </span>
                      ) : (
                        <span className="text-sm text-red-500" title={r.error}>分析失败</span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1"
                >
                  返回查看待办 <ChevronRight size={16} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-green-600" />
                    <span className="font-bold text-gray-800">群聊</span>
                  </div>
                  <span className="text-sm text-gray-500">{groupSessions.length} 个</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {groupSessions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">暂无群聊</div>
                  ) : (
                    groupSessions.map((sess) => (
                      <div
                        key={sess.id}
                        onClick={() => toggleSession(sess.id)}
                        className={'p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ' + (selectedSessions.has(sess.id) ? 'bg-indigo-50' : '')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={'w-5 h-5 rounded border-2 flex items-center justify-center ' + (selectedSessions.has(sess.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300')}>
                            {selectedSessions.has(sess.id) && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">{sess.name || '未命名群聊'}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border">
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-blue-600" />
                    <span className="font-bold text-gray-800">好友</span>
                  </div>
                  <span className="text-sm text-gray-500">{friendSessions.length} 个</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {friendSessions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">暂无好友</div>
                  ) : (
                    friendSessions.map((sess) => (
                      <div
                        key={sess.id}
                        onClick={() => toggleSession(sess.id)}
                        className={'p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ' + (selectedSessions.has(sess.id) ? 'bg-indigo-50' : '')}
                      >
                        <div className="flex items-center gap-3">
                          <div className={'w-5 h-5 rounded border-2 flex items-center justify-center ' + (selectedSessions.has(sess.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300')}>
                            {selectedSessions.has(sess.id) && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 truncate">{sess.name}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {!connected && !connecting && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={40} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">连接微信聊天记录</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              请先在本地运行 chatlog server 命令，然后点击上方连接按钮
            </p>
            <div className="bg-gray-50 rounded-lg p-4 max-w-lg mx-auto text-left">
              <p className="text-sm text-gray-600 mb-2">本地运行命令：</p>
              <code className="block bg-gray-800 text-green-400 p-3 rounded text-sm">
                chatlog server --addr 127.0.0.1:5030
              </code>
            </div>
          </div>
        )}
      </main>

      {showWordCloud && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">聊天词云</h3>
                  <p className="text-sm text-gray-500">{wordCloudSessionName} - 最近90天</p>
                </div>
              </div>
              <button
                onClick={() => setShowWordCloud(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex justify-center">
              <WordCloud words={wordCloudData} width={600} height={400} />
            </div>
            <div className="p-4 border-t bg-gray-50">
              <div className="flex flex-wrap gap-2 justify-center">
                {wordCloudData.slice(0, 10).map((word, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-white border rounded-full text-sm"
                  >
                    {word.text}: <span className="font-bold text-purple-600">{word.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
