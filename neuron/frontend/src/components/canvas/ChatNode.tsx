import { useState, useEffect, useRef } from 'react';
import { Position, NodeResizer, useReactFlow } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';
import { 
  Sparkles, MessageSquare, Send, Mic, 
  Trash2, ChevronDown, Bot, User, BrainCircuit,
  Lightbulb, FileText, Plus, Loader2, GitFork, Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MODELS = [
  { id: 'gemini', name: 'Gemini 2.5 Flash' },
  { id: 'openai', name: 'GPT-4o' },
  { id: 'anthropic', name: 'Claude 3.5 Sonnet' }
];

export default function ChatNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const reactFlow = useReactFlow();
  const removeNode = useCanvasStore((state) => state.removeNode);

  // Conversations & Messages State
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState('');
  
  // UI State
  const [inputMessage, setInputMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording graph & timer states
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspaceId) return;
    const newTitle = e.target.value;
    const freshNodes = useCanvasStore.getState().nodes;
    useCanvasStore.getState().setNodes(
      freshNodes.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, title: newTitle } };
        }
        return n;
      })
    );
    try {
      await workspaceApi.updateCardData(workspaceId, id, { ...data, title: newTitle });
    } catch (err) {
      console.error('Failed to update chatbox title', err);
    }
  };
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const visualizerBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const shouldTranscribeRef = useRef(true);

  // Clean up recording listeners on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Dynamic context source count (incoming connections)
  const incomingConnections = reactFlow.getEdges().filter(e => e.target === id);
  const sourceCount = incomingConnections.length;

  // Load conversations on mount or when id changes
  useEffect(() => {
    loadConversations();
  }, [id]);

  // Load messages whenever active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadConversations = async () => {
    try {
      const convs = await workspaceApi.getConversations(id);
      
      const convsWithTitles = await Promise.all(
        convs.map(async (c) => {
          try {
            const firstMsg = await workspaceApi.getFirstMessage(c.id);
            let titleText = c.title;
            if (!titleText) {
              titleText = `Chat Thread #${c.id.substring(0, 4)}`;
              if (firstMsg && firstMsg.content) {
                const cleaned = firstMsg.content.trim();
                titleText = cleaned.length > 25 ? cleaned.substring(0, 23) + '...' : cleaned;
                
                if (firstMsg.metadata && firstMsg.metadata.is_branched_conversation) {
                  titleText = `Branch - ${titleText}`;
                }
              }
            }
            return { ...c, displayTitle: titleText };
          } catch (e) {
            return { ...c, title: `Chat Thread #${c.id.substring(0, 4)}` };
          }
        })
      );

      setConversations(convsWithTitles);
      if (convsWithTitles.length > 0 && !activeConversationId) {
        setActiveConversationId(convsWithTitles[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const msgs = await workspaceApi.getMessages(convId);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleCreateChat = async () => {
    try {
      const newConv = await workspaceApi.createConversation(id);
      setConversations([newConv, ...conversations]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setErrorMsg('');
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleRenameThread = async (convId: string) => {
    if (!editingThreadTitle.trim()) {
      setEditingThreadId(null);
      return;
    }
    try {
      await workspaceApi.renameConversation(convId, editingThreadTitle.trim());
      await loadConversations();
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    } finally {
      setEditingThreadId(null);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    let convId = activeConversationId;
    setErrorMsg('');

    try {
      setIsLoading(true);

      // Create conversation on the fly if none active
      if (!convId) {
        const newConv = await workspaceApi.createConversation(id);
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
        convId = newConv.id;
      }

      // Add user message locally for instant response
      const tempUserMsg = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: text,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMsg]);
      
      setInputMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Send message to backend
      await workspaceApi.sendMessage(convId!, id, text, selectedModel);
      
      // Load updated message list from DB to ensure sync
      await loadMessages(convId!);
      
      // Update thread list in case names updated
      loadConversations();
    } catch (err: any) {
      console.error('Send message error:', err);
      setErrorMsg(err.message || 'Generation failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBranchInNewChat = async (messageId: string) => {
    if (!activeConversationId || isLoading) return;
    try {
      setIsLoading(true);
      const originalConv = conversations.find(c => c.id === activeConversationId);
      const originalTitle = originalConv?.displayTitle || originalConv?.title || 'Original Conversation';
      
      const newConv = await workspaceApi.branchConversation(activeConversationId, messageId, id, originalTitle);
      await loadConversations();
      setActiveConversationId(newConv.id);
    } catch (err: any) {
      console.error('Failed to branch chat:', err);
      setErrorMsg(err.message || 'Failed to branch conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCancelRecording = () => {
    shouldTranscribeRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        shouldTranscribeRef.current = true;

        // Initialize Web Audio API Analyser
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
          }
          if (timerRef.current) clearInterval(timerRef.current);

          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());

          if (!shouldTranscribeRef.current) {
            audioChunksRef.current = [];
            return;
          }

          setIsTranscribing(true);
          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const { transcript } = await workspaceApi.transcribeVoice(audioBlob);
            if (transcript) {
              setInputMessage(prev => prev ? prev + ' ' + transcript : transcript);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                }
              }, 10);
            }
          } catch (err) {
            console.error('Transcription error:', err);
            setErrorMsg('Failed to transcribe voice.');
          } finally {
            setIsTranscribing(false);
          }
        };

        setRecordingTime(0);
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);

        mediaRecorder.start();
        setIsRecording(true);

        // Voice Graph visualizer loop
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVisualizer = () => {
          if (mediaRecorder.state === 'inactive') return;
          analyser.getByteFrequencyData(dataArray);

          for (let i = 0; i < 16; i++) {
            const bar = visualizerBarsRef.current[i];
            if (bar) {
              const dataIndex = Math.min(Math.floor(i * (bufferLength / 16)), bufferLength - 1);
              const value = dataArray[dataIndex];
              // Map 0-255 amplitude to a scale factor for height
              const scale = 1 + (value / 255) * 5; 
              bar.style.transform = `scaleY(${scale})`;
            }
          }
          animationFrameIdRef.current = requestAnimationFrame(updateVisualizer);
        };
        animationFrameIdRef.current = requestAnimationFrame(updateVisualizer);

      } catch (err) {
        console.error('Microphone access denied:', err);
        setErrorMsg('Microphone access is required.');
      }
    }
  };

  const handleDeleteNode = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to delete chat node:", err);
    }
  };

  const handleResizeEnd = (_evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'ai_chat', // matching schema 'ai_chat' (or 'chat')
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  // Simple formatter to format assistant responses
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
        return <li key={idx} className="ml-4 list-disc text-xs my-0.5 leading-relaxed">{formattedLine.substring(2)}</li>;
      }

      // Bold formatting (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      if (boldRegex.test(formattedLine)) {
        const parts = formattedLine.split(boldRegex);
        return (
          <p key={idx} className="text-xs leading-relaxed my-1">
            {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-bold text-white">{part}</strong> : part)}
          </p>
        );
      }

      return <p key={idx} className="text-xs leading-relaxed my-1">{formattedLine}</p>;
    });
  };

  const activeModel = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  return (
    <>
      <NodeResizer 
        color="#818cf8" 
        isVisible={selected} 
        minWidth={550} 
        minHeight={400} 
        onResizeEnd={handleResizeEnd} 
      />
      
      <div className={`w-full h-full bg-[#0d0d12]/85 backdrop-blur-2xl text-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border flex flex-col overflow-hidden transition-all duration-300 ${selected ? 'border-indigo-500/50 shadow-indigo-500/15 scale-[1.001]' : 'border-white/[0.05]'}`}>
        
        {/* Header */}
        <div className="h-14 flex-shrink-0 bg-white/[0.01] border-b border-white/5 flex items-center px-4 justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-1.5 flex-shrink-0 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400 shadow-[0_2px_8px_rgba(99,102,241,0.1)]">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={data.title || ''}
                onChange={handleTitleChange}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-transparent border-none outline-none focus:ring-0 text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent placeholder-indigo-400/50 cursor-text min-w-0"
                placeholder="AI Assistant"
              />
              <p className="text-[9px] text-gray-400 font-semibold flex items-center gap-1.5 mt-0.5 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                {sourceCount} {sourceCount === 1 ? 'context source' : 'context sources'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Selector Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] hover:bg-white/[0.06] rounded-xl border border-white/5 hover:border-indigo-500/30 text-[10px] font-bold text-gray-300 hover:text-white shadow-sm transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                {activeModel.name}
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>

              <AnimatePresence>
                {isModelDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute right-0 mt-1.5 w-44 bg-[#0d0d11]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden"
                  >
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setIsModelDropdownOpen(false);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors hover:bg-white/5 flex items-center gap-2 cursor-pointer ${selectedModel === m.id ? 'text-indigo-400 bg-indigo-500/5 font-semibold' : 'text-gray-400'}`}
                      >
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        {m.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Delete Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteNode();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition-all cursor-pointer"
              title="Delete Chat Box"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Double Column Body */}
        <div className="flex-1 flex min-h-0 w-full">
          
          {/* Left Column: Sidebar Threads */}
          <div className="w-[180px] bg-[#0a0a0f]/50 border-r border-white/[0.05] flex flex-col min-h-0 nodrag nowheel overflow-y-auto">
            {/* New Chat Button */}
            <div className="p-3">
              <button
                onClick={handleCreateChat}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white rounded-xl text-xs font-bold shadow-[0_4px_12px_rgba(99,102,241,0.2)] hover:shadow-[0_4px_16px_rgba(99,102,241,0.35)] active:scale-[0.98] transition-all cursor-pointer border border-indigo-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chat
              </button>
            </div>

            {/* Scrollable list of conversations */}
            <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1 select-none custom-scrollbar nowheel">
              <AnimatePresence initial={false}>
                {conversations.length === 0 ? (
                  <div className="text-[10px] text-gray-500 text-center py-4 px-2 italic">
                    No chats started
                  </div>
                ) : (
                  conversations.map((c) => {
                    const isActive = activeConversationId === c.id;
                    return (
                      <motion.div 
                        layoutId={`thread-container-${c.id}`}
                        key={c.id}
                        className="relative w-full flex items-center justify-between p-2 rounded-xl border border-transparent transition-all group overflow-hidden"
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeThreadBackground"
                            className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}

                        {editingThreadId === c.id ? (
                          <input
                            type="text"
                            value={editingThreadTitle}
                            onChange={(e) => setEditingThreadTitle(e.target.value)}
                            onBlur={() => handleRenameThread(c.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameThread(c.id);
                              }
                            }}
                            autoFocus
                            className="flex-1 bg-black/40 text-white text-[10px] px-2 py-1 rounded outline-none border border-indigo-500/50 z-10 w-full min-w-0"
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <>
                            <button
                              onClick={() => setActiveConversationId(c.id)}
                              className={`flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer bg-transparent border-none outline-none z-10 transition-colors ${isActive ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
                              <span className="text-[10px] truncate leading-tight">{c.displayTitle || c.title || 'New Chat'}</span>
                            </button>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 ml-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingThreadId(c.id);
                                  setEditingThreadTitle(c.displayTitle || c.title || '');
                                }}
                                className="text-gray-500 hover:text-indigo-400 p-0.5 rounded transition-colors cursor-pointer"
                                title="Rename Thread"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this chat thread?')) {
                                    try {
                                      await workspaceApi.deleteConversation(c.id);
                                      const remaining = conversations.filter(x => x.id !== c.id);
                                      setConversations(remaining);
                                      if (activeConversationId === c.id) {
                                        setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
                                      }
                                    } catch (err) {
                                      console.error('Failed to delete conversation:', err);
                                    }
                                  }
                                }}
                                className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                                title="Delete Thread"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Chat Box Pane */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#07070a]/30">
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 nodrag nowheel custom-scrollbar">
              <AnimatePresence initial={false}>
                {messages.length === 0 && !isLoading ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center p-6 select-none opacity-40"
                  >
                    <Bot className="w-10 h-10 text-indigo-400 mb-2 animate-bounce" style={{ animationDuration: '3s' }} />
                    <h4 className="text-xs font-semibold text-white">Ask your workspace AI</h4>
                    <p className="text-[10px] text-gray-400 max-w-[240px] mt-1 leading-relaxed">
                      Connect files, videos, websites, or groups to this chat box. I will read their contents to answer your queries.
                    </p>
                  </motion.div>
                ) : (
                  messages.map((m) => {
                    const isAI = m.role === 'assistant';

                    return (
                      <div key={m.id}>
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className={`flex gap-3 max-w-[90%] w-full ${isAI ? 'self-start' : 'self-end flex-row-reverse'}`}
                      >
                        {/* Avatar */}
                        {isAI ? (
                          <div className="relative w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-[1px] shadow-[0_0_12px_rgba(99,102,241,0.25)] flex items-center justify-center flex-shrink-0 animate-[pulse_3s_infinite]">
                            <div className="w-full h-full rounded-full bg-[#0d0d12] flex items-center justify-center text-indigo-400">
                              <Sparkles className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.25)] flex items-center justify-center flex-shrink-0 text-[10px]">
                            <User className="w-3.5 h-3.5" />
                          </div>
                        )}

                        <div className="flex flex-col gap-1 w-full max-w-full select-text">
                          {/* Text Bubble */}
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed relative group/bubble transition-all select-text ${
                            isAI 
                              ? 'bg-gradient-to-b from-[#1a1a24] to-[#14141c] text-slate-200 border border-white/[0.08] rounded-tl-sm shadow-sm hover:border-indigo-500/30 pb-8' 
                              : 'bg-gradient-to-tr from-indigo-600 to-violet-700 text-white rounded-tr-sm shadow-md border border-indigo-500/20'
                          }`}>
                            
                            {isAI ? renderMessageContent(m.content) : <p className="text-xs leading-relaxed">{m.content}</p>}

                            {/* Actions UI overlay */}
                            {isAI && (
                              <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); console.log('Branch clicked for:', m.id); handleBranchInNewChat(m.id); }} 
                                  className="text-gray-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded px-1.5 py-0.5 flex items-center gap-1 cursor-pointer"
                                  title="Branch in new chat"
                                >
                                  <GitFork className="w-3 h-3" />
                                  <span className="text-[9px] font-semibold">Branch</span>
                                </button>
                                
                                <button
                                  onClick={() => handleCopy(m.content, m.id)}
                                  className="text-gray-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded px-1.5 py-0.5 cursor-pointer flex items-center gap-1 select-none"
                                  title="Copy response"
                                >
                                  <span className="text-[9px] font-semibold">{copiedId === m.id ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Branch Point Divider */}
                      {(() => {
                        if (!m.metadata?.is_branch_point) return null;
                        const sourceConvId = m.metadata.branched_from_conversation_id;
                        const sourceConv = conversations.find(c => c.id === sourceConvId);
                        const displayTitle = sourceConv ? (sourceConv.displayTitle || sourceConv.title || 'Original Conversation') : (m.metadata.branched_from_title || 'Original Conversation');
                        
                        return (
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            className="flex items-center gap-3 my-10 w-full max-w-[90%] mx-auto"
                          >
                            <div className="h-px bg-white/[0.05] flex-1"></div>
                            <span className="text-[10px] text-gray-500 font-medium tracking-wide flex items-center gap-1.5 px-2">
                              Branched from 
                              {sourceConvId ? (
                                <button 
                                  onClick={() => setActiveConversationId(sourceConvId)}
                                  className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors cursor-pointer"
                                >
                                  {displayTitle}
                                </button>
                              ) : (
                                <span>{displayTitle}</span>
                              )}
                            </span>
                            <div className="h-px bg-white/[0.05] flex-1"></div>
                          </motion.div>
                        );
                      })()}
                      </div>
                    );
                  })
                )}
              </AnimatePresence>

              {/* Typing/Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 self-start">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.05] p-3 rounded-2xl rounded-tl-sm text-xs text-gray-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Error Message bar */}
            {errorMsg && (
              <div className="px-4 py-1.5 bg-red-950/40 border-y border-red-500/20 text-red-300 text-[10px] font-medium flex justify-between items-center select-none">
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg('')} className="hover:text-red-200 cursor-pointer">dismiss</button>
              </div>
            )}

            {/* Footer Input Controls */}
            <div className="p-3 border-t border-white/[0.06] bg-[#0d0d11]/80 flex flex-col gap-2 nodrag">
              {/* Text Input Row */}
              <div className="flex items-center gap-2 bg-black/40 border border-white/[0.08] rounded-2xl px-3 py-1.5 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
                {isRecording ? (
                  <div className="flex-1 flex items-center justify-between gap-4 py-1 select-none">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      <span className="text-[10px] text-red-400 font-black uppercase tracking-widest">Recording</span>
                      <span className="text-xs font-mono text-gray-400 font-bold">{formatTime(recordingTime)}</span>
                    </div>

                    {/* Audio Wave Graph */}
                    <div className="flex-1 flex items-center justify-center gap-1.5 h-8 max-w-[220px] px-3">
                      {[...Array(16)].map((_, i) => (
                        <div
                          key={i}
                          ref={el => { visualizerBarsRef.current[i] = el; }}
                          className="w-1 h-1.5 bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-transform duration-75"
                          style={{ transform: 'scaleY(1)', transformOrigin: 'center' }}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleCancelRecording}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-[10px] text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <textarea 
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    rows={1}
                    className="flex-1 bg-transparent border-none outline-none text-xs placeholder:text-gray-500 py-1.5 cursor-text resize-none max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 select-text nowheel"
                    placeholder={activeConversationId ? "Type a message... (Shift+Enter for newline)" : "Start a conversation..."}
                  />
                )}
                
                <button 
                  onClick={handleToggleRecording}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={isTranscribing}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    isRecording 
                      ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.25)]' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`} 
                  title={isRecording ? "Stop recording and transcribe" : "Record voice note"}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  ) : (
                    <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse text-red-500' : ''}`} />
                  )}
                </button>

                <button 
                  onClick={() => handleSendMessage()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={isLoading || !inputMessage.trim() || isRecording || isTranscribing}
                  className={`p-1.5 rounded-full flex items-center justify-center transition-all ${
                    inputMessage.trim() && !isLoading && !isRecording && !isTranscribing
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-[0_2px_8px_rgba(99,102,241,0.2)] cursor-pointer' 
                      : 'text-gray-600 bg-white/[0.02]'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom Quick-Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => handleSendMessage('Give me an insight on the connected assets.')}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/20 text-indigo-300 rounded-full px-3 py-1 text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-[0_2px_8px_rgba(99,102,241,0.05)] hover:shadow-[0_2px_12px_rgba(99,102,241,0.15)]"
                  >
                    <Lightbulb className="w-3 h-3" />
                    Insight
                  </button>
                  <button 
                    onClick={() => handleSendMessage('Summarize the connected assets.')}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/20 text-emerald-300 rounded-full px-3 py-1 text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.05)] hover:shadow-[0_2px_12px_rgba(16,185,129,0.15)]"
                  >
                    <FileText className="w-3 h-3" />
                    Summarize
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Target connection Handle (input only, no output) */}
      <SmartHandle 
        type="target" 
        position={Position.Left} 
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-black" 
      />
    </>
  );
}
