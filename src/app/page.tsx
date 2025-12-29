'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import {
  MessageSquare,
  Upload,
  CheckCircle,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Briefcase,
  BookOpen,
  Coffee,
  Inbox,
  ExternalLink,
  MessageCircle,
  LogOut,
  Plus,
  RefreshCw,
  FolderSearch,
  Check,
  BarChart2,
  AlertCircle,
  Users,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Sparkles,
  Trash2,
  FolderOpen,
  File,
  X
} from 'lucide-react';

// File System Access API types
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

interface ScannedFile {
  name: string;
  path: string;
  size: number;
  content?: string;
  handle: FileSystemFileHandle;
}

interface Todo {
  _id?: string;
  id?: number;
  content: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
  category: 'work' | 'study' | 'life';
  source: string;
  sessionId?: string;
  appId?: string;
  done: boolean;
}

const App = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Auth State
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');

  // View State
  const [currentView, setCurrentView] = useState('todos');

  // App Data
  const [configuredApps, setConfiguredApps] = useState([
    {
      id: 'app_1',
      name: 'AI分析',
      type: 'ai',
      sessions: [
        { id: 'ai_session', name: 'AI提取的待办', type: 'ai' }
      ]
    },
  ]);

  // Modals
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [showFileScanModal, setShowFileScanModal] = useState(false);
  const [chatTextInput, setChatTextInput] = useState('');
  const [chatSourceName, setChatSourceName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // File System Access API State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [scanError, setScanError] = useState('');
  const [fsApiSupported, setFsApiSupported] = useState(false);

  // Filters
  const [expandedAppId, setExpandedAppId] = useState<string | null>('app_1');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Context Modal
  const [showContextModal, setShowContextModal] = useState(false);
  const [currentTodoContext, setCurrentTodoContext] = useState<any>(null);

  // Todos
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);

  // Check File System Access API support
  useEffect(() => {
    setFsApiSupported(typeof window !== 'undefined' && 'showDirectoryPicker' in window);
  }, []);

  // Load todos from API
  useEffect(() => {
    if (session?.user) {
      fetchTodos();
    }
  }, [session]);

  const fetchTodos = async () => {
    setTodosLoading(true);
    try {
      const res = await fetch('/api/todos');
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    } finally {
      setTodosLoading(false);
    }
  };

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setAuthError(result.error);
      }
    } catch (error) {
      setAuthError('登录失败，请稍后重试');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    if (password !== confirmPassword) {
      setAuthError('两次输入的密码不一致');
      setAuthLoading(false);
      return;
    }

    if (password.length < 6) {
      setAuthError('密码至少6位');
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || '注册失败');
        return;
      }

      await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
    } catch (error) {
      setAuthError('注册失败，请稍后重试');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    signOut({ redirect: false });
  };

  // File System Access API - Scan Directory
  const handleScanDirectory = async () => {
    if (!window.showDirectoryPicker) {
      setScanError('您的浏览器不支持文件夹访问功能，请使用Chrome或Edge浏览器');
      return;
    }

    setIsScanning(true);
    setScanError('');
    setScannedFiles([]);
    setSelectedFiles(new Set());

    try {
      const dirHandle = await window.showDirectoryPicker();
      const files: ScannedFile[] = [];

      // Recursive function to scan directory
      const scanDir = async (handle: FileSystemDirectoryHandle, path: string = ''): Promise<void> => {
        for await (const entry of handle.values()) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;

          if (entry.kind === 'file') {
            const fileHandle = entry as FileSystemFileHandle;
            const file = await fileHandle.getFile();

            // Only include text files that might be chat records
            const ext = entry.name.toLowerCase().split('.').pop();
            if (['txt', 'log', 'csv', 'json'].includes(ext || '')) {
              files.push({
                name: entry.name,
                path: entryPath,
                size: file.size,
                handle: fileHandle,
              });
            }
          } else if (entry.kind === 'directory') {
            // Recursively scan subdirectories (limit depth to avoid too deep)
            if (path.split('/').length < 3) {
              await scanDir(entry as FileSystemDirectoryHandle, entryPath);
            }
          }
        }
      };

      await scanDir(dirHandle);

      // Sort by size (larger files likely have more content)
      files.sort((a, b) => b.size - a.size);

      setScannedFiles(files);

      if (files.length === 0) {
        setScanError('未找到聊天记录文件（.txt, .log, .csv, .json）');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setScanError('扫描文件夹失败: ' + error.message);
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle file selection
  const toggleFileSelection = (path: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedFiles(newSelected);
  };

  // Select all files
  const selectAllFiles = () => {
    if (selectedFiles.size === scannedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(scannedFiles.map(f => f.path)));
    }
  };

  // Analyze selected files
  const handleAnalyzeSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      setScanError('请至少选择一个文件');
      return;
    }

    setIsAnalyzing(true);
    setScanError('');
    let totalTodos = 0;

    try {
      const filePaths = Array.from(selectedFiles);
      for (const filePath of filePaths) {
        const fileInfo = scannedFiles.find(f => f.path === filePath);
        if (!fileInfo) continue;

        // Read file content
        const file = await fileInfo.handle.getFile();
        const content = await file.text();

        if (!content.trim()) continue;

        // Limit content size to avoid API limits
        const truncatedContent = content.length > 10000
          ? content.substring(0, 10000) + '\n... (内容过长，已截断)'
          : content;

        // Call analyze API
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatContent: truncatedContent,
            source: fileInfo.name.replace(/\.[^.]+$/, ''), // Remove extension as source name
          }),
        });

        const data = await res.json();

        if (res.ok && data.todos && data.todos.length > 0) {
          // Save todos to database
          for (const todo of data.todos) {
            await fetch('/api/todos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: todo.content,
                date: todo.date,
                priority: todo.priority,
                category: todo.category,
                source: todo.source || fileInfo.name,
                appId: 'app_1',
                sessionId: 'ai_session',
              }),
            });
          }
          totalTodos += data.todos.length;
        }
      }

      // Refresh todos
      await fetchTodos();

      // Close modal and show result
      setShowFileScanModal(false);
      setScannedFiles([]);
      setSelectedFiles(new Set());

      if (totalTodos > 0) {
        alert(`成功从 ${selectedFiles.size} 个文件中提取 ${totalTodos} 个待办事项！`);
      } else {
        alert('未从选中的文件中发现待办事项');
      }
    } catch (error: any) {
      setScanError('分析文件失败: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // AI Analysis Handler (for text input)
  const handleAnalyzeChat = async () => {
    if (!chatTextInput.trim()) {
      setAnalysisError('请输入聊天内容');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatContent: chatTextInput,
          source: chatSourceName || 'AI分析'
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnalysisError(data.error || '分析失败');
        return;
      }

      // Save extracted todos to database
      if (data.todos && data.todos.length > 0) {
        for (const todo of data.todos) {
          await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: todo.content,
              date: todo.date,
              priority: todo.priority,
              category: todo.category,
              source: todo.source || chatSourceName || 'AI分析',
              appId: 'app_1',
              sessionId: 'ai_session',
            }),
          });
        }

        // Refresh todos
        await fetchTodos();

        // Close modal and reset
        setShowTextInputModal(false);
        setChatTextInput('');
        setChatSourceName('');
        alert(`成功提取 ${data.todos.length} 个待办事项！`);
      } else {
        setAnalysisError('未发现待办事项，请检查聊天内容');
      }
    } catch (error: any) {
      setAnalysisError('分析失败: ' + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Todo Handlers
  const toggleTodoDone = async (todo: Todo) => {
    const id = todo._id || todo.id;
    try {
      const res = await fetch('/api/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, done: !todo.done }),
      });

      if (res.ok) {
        setTodos(todos.map(t =>
          (t._id || t.id) === id ? { ...t, done: !t.done } : t
        ));
      }
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const deleteTodo = async (todo: Todo) => {
    const id = todo._id || todo.id;
    if (!confirm('确定删除这个待办吗？')) return;

    try {
      const res = await fetch(`/api/todos?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setTodos(todos.filter(t => (t._id || t.id) !== id));
      }
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const getFilteredTodos = () => {
    return todos.filter(t => {
      const matchSource =
        selectedSourceFilter === 'all' ||
        t.appId === selectedSourceFilter ||
        t.sessionId === selectedSourceFilter;
      const matchCategory = activeCategory === 'all' || t.category === activeCategory;
      const matchDate = !dateFilter || (t.date && t.date.includes(dateFilter));
      return matchSource && matchCategory && matchDate;
    });
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Login/Register Screen
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-gray-50 animate-fade-in">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg transform rotate-3">
              <CheckCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">ChatSync 智聊清单</h1>
            <p className="text-gray-500 mt-2 text-sm">一键提取聊天记录中的待办事项</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
              <input
                type="text"
                placeholder="昵称（可选）"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            )}
            <input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {isRegistering && (
              <input
                type="password"
                placeholder="确认密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            )}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
            >
              {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRegistering ? '注册' : '登录'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError('');
              }}
              className="text-indigo-600 hover:text-indigo-700 text-sm"
            >
              {isRegistering ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Workspace Layout
  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r flex flex-col flex-shrink-0 z-20 shadow-sm">
        <div className="p-5 border-b flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
            <CheckCircle size={20} />
          </div>
          <h1 className="font-bold text-gray-800 text-lg tracking-tight">ChatSync</h1>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">数据源</span>
              <button
                onClick={() => setShowAddAppModal(true)}
                className="p-1 hover:bg-gray-100 rounded text-indigo-600 transition-colors"
              >
                <Plus size={16}/>
              </button>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedSourceFilter('all')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${selectedSourceFilter === 'all' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3">
                  <FolderSearch size={18} className={selectedSourceFilter === 'all' ? 'text-indigo-600' : 'text-gray-400'}/>
                  <span>全部待办</span>
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">{todos.length}</span>
              </button>

              {configuredApps.map(app => (
                <div key={app.id} className="space-y-1">
                  <div className="flex items-center group">
                    <button
                      onClick={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      <ChevronRight size={14} className={`transform transition-transform ${expandedAppId === app.id ? 'rotate-90' : ''}`}/>
                    </button>
                    <button
                      onClick={() => setSelectedSourceFilter(app.id)}
                      className={`flex-1 flex items-center justify-between pr-3 py-2 rounded-lg transition-all ${selectedSourceFilter === app.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Sparkles size={16} className="text-purple-500"/>
                        <span className="truncate text-sm">{app.name}</span>
                      </div>
                    </button>
                  </div>

                  {expandedAppId === app.id && (
                    <div className="ml-8 space-y-1 border-l-2 border-gray-100 pl-2 animate-slide-down">
                      {app.sessions.map(sess => (
                        <button
                          key={sess.id}
                          onClick={() => setSelectedSourceFilter(sess.id)}
                          className={`w-full flex items-center px-2 py-1.5 rounded-md text-sm transition-all ${selectedSourceFilter === sess.id ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full mr-2 bg-purple-300"></span>
                          <span className="truncate">{sess.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="px-2 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">待办分类</div>
            <div className="space-y-1">
              <SidebarItem icon={<Briefcase size={18}/>} label="工作事项" count={todos.filter(t=>t.category==='work').length} active={activeCategory === 'work'} onClick={() => setActiveCategory('work')} color="text-blue-500" />
              <SidebarItem icon={<BookOpen size={18}/>} label="学习任务" count={todos.filter(t=>t.category==='study').length} active={activeCategory === 'study'} onClick={() => setActiveCategory('study')} color="text-purple-500" />
              <SidebarItem icon={<Coffee size={18}/>} label="生活琐事" count={todos.filter(t=>t.category==='life').length} active={activeCategory === 'life'} onClick={() => setActiveCategory('life')} color="text-green-500" />
              <SidebarItem icon={<Inbox size={18}/>} label="全部显示" active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} />
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {session.user?.name?.charAt(0) || session.user?.email?.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-700 truncate">{session.user?.name || session.user?.email}</p>
                <p className="text-xs text-gray-400 truncate">ERNIE 5.0</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-gray-200 transition-colors">
              <LogOut size={18}/>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative">
        <header className="px-8 py-5 border-b flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              {selectedSourceFilter === 'all' ? '所有待办' : 'AI提取的待办'}
              <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                {getFilteredTodos().length} 个任务
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              <input
                type="text"
                placeholder="筛选日期..."
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-40"
              />
            </div>
            {fsApiSupported && (
              <button
                onClick={() => setShowFileScanModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
              >
                <FolderOpen size={16}/> 扫描文件夹
              </button>
            )}
            <button
              onClick={() => setShowTextInputModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
            >
              <Sparkles size={16}/> AI分析聊天
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          {todosLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : getFilteredTodos().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Sparkles size={40} className="text-gray-300"/>
              </div>
              <p className="text-lg font-medium">暂无待办事项</p>
              <p className="text-sm mt-2">点击右上角按钮开始提取待办</p>
              <div className="flex gap-3 mt-6">
                {fsApiSupported && (
                  <button
                    onClick={() => setShowFileScanModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
                  >
                    <FolderOpen size={18}/> 扫描文件夹
                  </button>
                )}
                <button
                  onClick={() => setShowTextInputModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2"
                >
                  <Sparkles size={18}/> 粘贴聊天记录
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-5xl mx-auto">
              {getFilteredTodos().map(todo => (
                <div key={todo._id || todo.id} className={`group bg-white rounded-xl border p-5 flex items-start justify-between transition-all hover:shadow-md ${todo.done ? 'bg-gray-50 opacity-60' : 'border-gray-200 hover:border-indigo-300'}`}>
                  <div className="flex items-start gap-4 flex-1">
                    <button
                      onClick={() => toggleTodoDone(todo)}
                      className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${todo.done ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 hover:border-indigo-500'}`}
                    >
                      {todo.done && <Check size={14} className="text-white" />}
                    </button>
                    <div className="flex-1">
                      <h3 className={`font-bold text-gray-800 text-lg mb-1 ${todo.done ? 'line-through text-gray-400' : ''}`}>{todo.content}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded font-medium ${
                          todo.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' :
                          todo.priority === 'medium' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                          'bg-green-50 text-green-600 border border-green-100'
                        }`}>
                          {todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}
                        </span>
                        {todo.date && <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded"><Calendar size={12}/> {todo.date}</span>}
                        {todo.source && <span className="flex items-center gap-1 bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-medium">
                          <Sparkles size={12}/> {todo.source}
                        </span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <button
                      onClick={() => deleteTodo(todo)}
                      className="px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Trash2 size={14} /> 删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Source Modal */}
      {showAddAppModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">添加数据源</h3>
              <button onClick={() => setShowAddAppModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-8">
              <div className="space-y-4">
                {fsApiSupported && (
                  <button
                    onClick={() => { setShowAddAppModal(false); setShowFileScanModal(true); }}
                    className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-green-500 hover:bg-green-50 cursor-pointer transition-all"
                  >
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <FolderOpen size={24} className="text-green-600"/>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-800">扫描文件夹</h4>
                      <p className="text-sm text-gray-500">选择文件夹自动扫描聊天记录</p>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => { setShowAddAppModal(false); setShowTextInputModal(true); }}
                  className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <FileText size={24} className="text-purple-600"/>
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-800">粘贴聊天文本</h4>
                    <p className="text-sm text-gray-500">复制聊天记录并粘贴分析</p>
                  </div>
                </button>

                <button
                  onClick={() => { setShowAddAppModal(false); router.push('/wechat-connect'); }}
                  className="w-full flex items-center gap-4 p-4 border rounded-xl hover:border-green-500 hover:bg-green-50 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <MessageCircle size={24} className="text-green-600"/>
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-800">微信记录</h4>
                    <p className="text-sm text-gray-500">连接本地chatlog，选择会话提取待办</p>
                  </div>
                </button>

                <div className="flex items-center gap-4 p-4 border rounded-xl opacity-50 cursor-not-allowed">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <MessageSquare size={24} className="text-blue-600"/>
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-gray-800">QQ记录 <span className="text-xs text-gray-400 ml-2">即将支持</span></h4>
                    <p className="text-sm text-gray-500">扫描本地QQ数据</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Scan Modal */}
      {showFileScanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-800">扫描文件夹</h3>
                <p className="text-xs text-gray-500">选择包含聊天记录的文件夹，自动扫描并分析</p>
              </div>
              <button
                onClick={() => {
                  setShowFileScanModal(false);
                  setScannedFiles([]);
                  setSelectedFiles(new Set());
                  setScanError('');
                }}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              {scannedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <FolderOpen size={40} className="text-green-600"/>
                  </div>
                  <p className="text-gray-600 font-medium mb-2">选择文件夹开始扫描</p>
                  <p className="text-sm text-gray-400 mb-6 text-center max-w-md">
                    支持扫描 .txt, .log, .csv, .json 格式的聊天记录文件<br/>
                    例如微信导出的聊天记录
                  </p>
                  <button
                    onClick={handleScanDirectory}
                    disabled={isScanning}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        扫描中...
                      </>
                    ) : (
                      <>
                        <FolderOpen size={18} />
                        选择文件夹
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      找到 <span className="font-bold text-green-600">{scannedFiles.length}</span> 个文件
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={selectAllFiles}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {selectedFiles.size === scannedFiles.length ? '取消全选' : '全选'}
                      </button>
                      <button
                        onClick={handleScanDirectory}
                        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <RefreshCw size={14} /> 重新扫描
                      </button>
                    </div>
                  </div>

                  <div className="border rounded-xl divide-y max-h-80 overflow-y-auto">
                    {scannedFiles.map(file => (
                      <label
                        key={file.path}
                        className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${
                          selectedFiles.has(file.path) ? 'bg-green-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.path)}
                          onChange={() => toggleFileSelection(file.path)}
                          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <File size={20} className="text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{file.name}</p>
                          <p className="text-xs text-gray-400 truncate">{file.path}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {scanError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {scanError}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {selectedFiles.size > 0 && (
                  <span>已选择 <span className="font-bold text-green-600">{selectedFiles.size}</span> 个文件</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowFileScanModal(false);
                    setScannedFiles([]);
                    setSelectedFiles(new Set());
                  }}
                  className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleAnalyzeSelectedFiles}
                  disabled={isAnalyzing || selectedFiles.size === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-xl font-medium flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      开始分析
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text Input Modal */}
      {showTextInputModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-800">AI智能分析</h3>
                <p className="text-xs text-gray-500">粘贴聊天记录，AI将自动提取待办事项</p>
              </div>
              <button onClick={() => { setShowTextInputModal(false); setAnalysisError(''); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">来源名称（可选）</label>
                  <input
                    type="text"
                    placeholder="如：产品群、张三"
                    value={chatSourceName}
                    onChange={(e) => setChatSourceName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">聊天内容</label>
                  <textarea
                    placeholder="粘贴聊天记录...&#10;&#10;示例：&#10;张三：记得明天把周报交了&#10;李四：好的，下午之前发你&#10;张三：对了，下周一开会别忘了"
                    value={chatTextInput}
                    onChange={(e) => setChatTextInput(e.target.value)}
                    className="w-full h-64 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm"
                  />
                </div>

                {analysisError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {analysisError}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                使用 <span className="font-bold text-purple-600">ERNIE 5.0</span> 分析
              </div>
              <button
                onClick={handleAnalyzeChat}
                disabled={isAnalyzing || !chatTextInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-medium flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    开始分析
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analyzing Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 mb-6">
            <Sparkles className="w-full h-full animate-pulse text-purple-400" />
          </div>
          <h3 className="text-2xl font-bold mb-2">ERNIE 5.0 正在分析</h3>
          <p className="text-gray-300 text-sm animate-pulse">正在智能识别待办事项...</p>
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ icon, label, count, active, onClick, color }: {icon: React.ReactNode; label: string; count?: number; active: boolean; onClick: () => void; color?: string}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg mb-1 transition-all ${active ? 'bg-white shadow-sm text-indigo-700 font-medium ring-1 ring-gray-100' : 'text-gray-500 hover:bg-gray-100'}`}
  >
    <div className="flex items-center gap-3">
      <span className={`${active ? 'text-indigo-600' : color || 'text-gray-400'}`}>{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
    {count !== undefined && (
      <span className={`text-xs px-2 py-0.5 rounded-md font-bold ${active ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
        {count}
      </span>
    )}
  </button>
);

export default App;
