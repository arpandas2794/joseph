import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, Send, Bot, User, BrainCircuit, Plus, Loader2, Menu, ChevronDown, Mic, Lightbulb, FileText, Check, Trash2, Pencil, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';
import { useSettingsStore } from '../../store/settingsStore';

interface MobileChatScreenProps {
  workspaceId: string;
  chatNode: any;
  onBack: () => void;
}

const MODELS = [
  { id: 'gemini', name: 'Gemini 2.5 Flash' },
  { id: 'openai', name: 'GPT-4o' },
  { id: 'anthropic', name: 'Claude Sonnet 5' }
];

export default function MobileChatScreen({ workspaceId, chatNode, onBack }: MobileChatScreenProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isContextSheetOpen, setIsContextSheetOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { apiKeys, setIsSettingsModalOpen } = useSettingsStore();
  const { edges, nodes } = useCanvasStore();
  const incomingConnections = edges.filter(e => e.target === chatNode.id);
  const contextNodes = incomingConnections.map(e => nodes.find(n => n.id === e.source)).filter(Boolean);

  useEffect(() => {
    loadConversations();
  }, [chatNode.id]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadConversations = async () => {
    try {
      const convs = await workspaceApi.getConversations(chatNode.id);
      setConversations(convs);
      if (convs.length > 0 && !activeConversationId) {
        setActiveConversationId(convs[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const msgs = await workspaceApi.getMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const handleSend = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const currentApiKey = apiKeys[selectedModel as keyof typeof apiKeys];
    if (!currentApiKey) {
      // Display inline error or open settings modal
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Error:** API Key required for ${MODELS.find(m => m.id === selectedModel)?.name}. Please add it in Settings.`,
        created_at: new Date().toISOString()
      }]);
      setIsSettingsModalOpen(true);
      return;
    }

    let convId = activeConversationId;
    
    // Create conversation if none exists
    if (!convId) {
      try {
        const newConv = await workspaceApi.createConversation(chatNode.id);
        convId = newConv.id;
        setActiveConversationId(convId);
        setConversations(prev => [newConv, ...prev]);
      } catch (err) {
        console.error('Failed to create conversation', err);
        return;
      }
    }

    const newMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputMessage,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      // Use selected model
      await workspaceApi.sendMessage(convId, chatNode.id, currentInput, selectedModel, currentApiKey);
      await loadMessages(convId);
    } catch (err: any) {
      console.error('Failed to send message', err);
      // Display error to the user inline
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Error:** ${err.message || 'Generation failed'}`,
        created_at: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (content: string) => {
    // Basic formatting for bold text, headers, and bullet points
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      let formattedLine = line;
      
      // Headers
      if (formattedLine.startsWith('### ')) {
        return <h4 key={idx} className="text-sm font-bold mt-2 mb-1 text-indigo-300">{formattedLine.replace('### ', '')}</h4>;
      }
      if (formattedLine.startsWith('## ')) {
        return <h3 key={idx} className="text-base font-bold mt-3 mb-1 text-indigo-400">{formattedLine.replace('## ', '')}</h3>;
      }
      if (formattedLine.startsWith('# ')) {
        return <h2 key={idx} className="text-lg font-bold mt-4 mb-2 text-indigo-500">{formattedLine.replace('# ', '')}</h2>;
      }

      // Bullet points
      if (formattedLine.startsWith('* ') || formattedLine.startsWith('- ')) {
        return <li key={idx} className="ml-4 list-disc text-[15px] my-0.5 leading-relaxed">{formattedLine.substring(2)}</li>;
      }

      // Bold formatting (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      if (boldRegex.test(formattedLine)) {
        const parts = formattedLine.split(boldRegex);
        return (
          <p key={idx} className="text-[15px] leading-relaxed my-1">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-white">{part}</strong> : part)}
          </p>
        );
      }

      return <p key={idx} className="text-[15px] leading-relaxed my-1">{formattedLine}</p>;
    });
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 bg-[#0a0a0c] z-[100] flex flex-col w-full h-full"
    >
      {/* Header */}
      <header className="h-14 border-b border-white/10 bg-[#121214] flex items-center px-4 flex-shrink-0 justify-between relative z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="hidden sm:flex flex-col min-w-0 flex-1 cursor-pointer" onClick={() => setIsContextSheetOpen(true)}>
            <h2 className="font-semibold text-[16px] text-white truncate leading-tight">{chatNode.data?.title || 'AI Assistant'}</h2>
            <p className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              {contextNodes.length} {contextNodes.length === 1 ? 'Source' : 'Sources'} Connected
            </p>
          </div>
        </div>

        {/* Mobile-only visible header title block */}
        <div className="sm:hidden absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer" onClick={() => setIsContextSheetOpen(true)}>
          <h2 className="font-semibold text-[15px] text-white truncate max-w-[120px]">{chatNode.data?.title || 'AI Assistant'}</h2>
          <p className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            {contextNodes.length} {contextNodes.length === 1 ? 'Source' : 'Sources'}
          </p>
        </div>

        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-[13px] font-medium text-white truncate max-w-[120px]">
              {MODELS.find(m => m.id === selectedModel)?.name}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {isModelDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsModelDropdownOpen(false)} />
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl py-1 z-50 overflow-hidden">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-white/5 transition-colors ${selectedModel === m.id ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-300'}`}
                  >
                    {m.name}
                    {selectedModel === m.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[110]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="absolute top-0 left-0 bottom-0 w-[280px] bg-[#121214] border-r border-white/10 z-[120] flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-semibold text-white">Chat Threads</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <button 
                  onClick={async () => {
                    const newConv = await workspaceApi.createConversation(chatNode.id);
                    setConversations([newConv, ...conversations]);
                    setActiveConversationId(newConv.id);
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4 flex flex-col gap-1 custom-scrollbar">
                {conversations.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveConversationId(c.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${activeConversationId === c.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate text-sm flex-1">{c.title || `Chat Thread #${c.id.substring(0, 4)}`}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Context Bottom Sheet Overlay */}
      <AnimatePresence>
        {isContextSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsContextSheetOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[110]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-[#1a1a24] rounded-t-3xl border-t border-white/10 z-[120] flex flex-col shadow-2xl"
            >
              {/* Drag Handle & Header */}
              <div className="p-4 flex flex-col items-center border-b border-white/5 relative flex-shrink-0">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
                <h2 className="font-bold text-lg text-white">Connected Sources</h2>
                <p className="text-sm text-emerald-400 mt-1 font-medium">{contextNodes.length} active context sources</p>
                <button 
                  onClick={() => setIsContextSheetOpen(false)} 
                  className="absolute right-4 top-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Sources List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                {contextNodes.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    <p>No assets connected.</p>
                  </div>
                ) : (
                  contextNodes.map((cn: any) => {
                    const title = cn.data?.title || cn.data?.customTitle || cn.data?.name || 'Asset';
                    const thumbnailUrl = cn.data?.metadata?.thumbnail;
                    
                    return (
                      <div key={cn.id} className="flex items-center gap-4 bg-black/30 border border-white/5 rounded-2xl p-3">
                        {thumbnailUrl ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-black/50 border border-white/10">
                            <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[15px] text-white truncate">{title}</h4>
                          <span className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">{cn.type}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
            <BrainCircuit className="w-12 h-12 mb-4 text-indigo-500/50" />
            <p className="text-sm font-medium text-white mb-2">Welcome to {chatNode.data?.title || 'AI Chat'}</p>
            <p className="text-xs">Any assets connected as context will be visible at the top. Ask me anything.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.id || idx} className={`flex gap-3 max-w-[95%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 ${
                msg.role === 'user' 
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' 
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`flex flex-col gap-1 min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed break-words markdown-body ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white/5 text-gray-100 rounded-tl-sm border border-white/5'
                }`}>
                  {msg.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {renderMessageContent(msg.content)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 bg-white/5 text-gray-400 border border-white/10">
              <Bot className="w-4 h-4" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/5 text-gray-400 rounded-tl-sm border border-white/5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#121214] border-t border-white/5 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-end gap-2 bg-black/40 border border-white/10 rounded-2xl p-2 focus-within:border-indigo-500/50 transition-colors">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message... (Shift+Enter for newline)"
            className="flex-1 bg-transparent border-none outline-none text-white text-[15px] resize-none max-h-32 min-h-[44px] py-2.5 px-2 placeholder:text-gray-500"
            rows={Math.min(5, inputMessage.split('\n').length)}
          />
          <button
            className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex-shrink-0"
            title="Voice Note"
          >
            <Mic className="w-5 h-5" />
          </button>
          <button
            onClick={handleSend}
            disabled={!inputMessage.trim() || isLoading}
            className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-gray-500 text-white flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-1 -mx-2 px-2">
          <button 
            onClick={() => setInputMessage(prev => prev + (prev ? '\n' : '') + 'Please provide a deep insight based on the context.')}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0"
          >
            <Lightbulb className="w-4 h-4" />
            Insight
          </button>
          <button 
            onClick={() => setInputMessage(prev => prev + (prev ? '\n' : '') + 'Please summarize the key points of the context.')}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0"
          >
            <FileText className="w-4 h-4" />
            Summarize
          </button>
        </div>
      </div>
    </motion.div>
  );
}
