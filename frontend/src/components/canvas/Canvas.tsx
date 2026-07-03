import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCanvasStore } from '../../store/canvasStore';
import StickyNode from './StickyNode';
import GroupNode from './GroupNode';
import WebsiteNode from './WebsiteNode';
import YoutubeNode from './YoutubeNode';
import InstagramNode from './InstagramNode';
import TiktokNode from './TiktokNode';
import CarouselNode from './CarouselNode';
import AnnotationNode from './AnnotationNode';
import VoiceNode from './VoiceNode';
import DriveNode from './DriveNode';
import DottedDeleteEdge from './DottedDeleteEdge';
import { Plus, PlayCircle, Camera, Music2, Loader2, Type, Mic, Square, Circle, HardDrive } from 'lucide-react';
import { workspaceApi } from '../../lib/api';

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'google_drive';

const PLATFORM_CONFIG: Record<Platform, {
  label: string;
  icon: React.ReactNode;
  color: string;
  border: string;
  accent: string;
  placeholder: string;
  hint: string;
}> = {
  youtube: {
    label: 'YouTube',
    icon: <PlayCircle className="w-4 h-4" />,
    color: 'text-red-400',
    border: 'border-red-500',
    accent: 'bg-red-600 hover:bg-red-500 shadow-red-500/20',
    placeholder: 'https://youtube.com/watch?v=... or youtu.be/...',
    hint: 'Paste a YouTube video URL to extract the transcript.',
  },
  instagram: {
    label: 'Instagram',
    icon: <Camera className="w-4 h-4" />,
    color: 'text-pink-400',
    border: 'border-pink-500',
    accent: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-pink-500/20',
    placeholder: 'https://instagram.com/reel/... or /p/...',
    hint: 'Paste a Reel URL for a video card, or a /p/ post URL for a carousel with OCR.',
  },
  tiktok: {
    label: 'TikTok',
    icon: <Music2 className="w-4 h-4" />,
    color: 'text-cyan-400',
    border: 'border-cyan-400',
    accent: 'bg-[#fe2c55] hover:bg-[#fe2c55]/85 shadow-[#fe2c55]/20',
    placeholder: 'https://tiktok.com/@user/video/...',
    hint: 'Paste a TikTok video URL to extract the transcript.',
  },
  google_drive: {
    label: 'Google Drive',
    icon: <HardDrive className="w-4 h-4" />,
    color: 'text-blue-400',
    border: 'border-blue-500',
    accent: 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20',
    placeholder: 'https://docs.google.com/document/d/...',
    hint: 'Paste a public Google Doc or Google Sheet link (Anyone with the link can view) to extract text.',
  }
};

const nodeTypes = {
  sticky: StickyNode,
  group: GroupNode,
  website: WebsiteNode,
  youtube: YoutubeNode,
  instagram: InstagramNode,
  tiktok: TiktokNode,
  instagram_carousel: CarouselNode,
  annotation: AnnotationNode,
  voice: VoiceNode,
  google_drive: DriveNode,
};

const edgeTypes = {
  deleteEdge: DottedDeleteEdge,
};

const defaultEdgeOptions = {
  style: { strokeWidth: 3, stroke: '#a855f7' }, // Purple wire
  type: 'deleteEdge', // Use custom hover-to-delete edge
  animated: true, // Make it flow!
};

interface CanvasProps {
  workspaceId: string;
}

export default function Canvas({ workspaceId }: CanvasProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setNodes, setEdges } = useCanvasStore();
  const [showLinkModal, setShowLinkModal] = React.useState(false);
  const [activePlatform, setActivePlatform] = React.useState<Platform>('youtube');
  const [linkUrl, setLinkUrl] = React.useState('');
  const [extracting, setExtracting] = React.useState(false);
  const [extractError, setExtractError] = React.useState('');

  // Voice Recording State
  const [showVoiceModal, setShowVoiceModal] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [processingVoice, setProcessingVoice] = React.useState(false);
  const [voiceStatus, setVoiceStatus] = React.useState(''); // Used for entertaining loading text
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const openPlatformModal = (platform: Platform) => {
    setActivePlatform(platform);
    setLinkUrl('');
    setExtractError('');
    setShowLinkModal(true);
  };

  useEffect(() => {
    // Fetch initial data
    workspaceApi.getWorkspaceData(workspaceId).then((data) => {
      // Map DB cards to React Flow nodes
      const initialNodes = data.cards.map((card: any) => ({
        id: card.id,
        type: card.type,
        position: { x: card.x, y: card.y },
        style: {
          width: card.width || (['youtube', 'instagram', 'tiktok', 'instagram_carousel'].includes(card.type) ? 320 : 256),
          height: card.height || (card.type === 'youtube' ? 240 : ['instagram', 'tiktok'].includes(card.type) ? 400 : card.type === 'instagram_carousel' ? 420 : 256)
        },
        data: card.data || {},
      }));
      setNodes(initialNodes);

      // Map DB connections to React Flow edges
      const initialEdges = data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source_id,
        target: edge.target_chat_id,
      }));
      setEdges(initialEdges);
    }).catch(console.error);
  }, [workspaceId, setNodes, setEdges]);

  const handleAddSticky = async () => {
    const newNode = {
      id: crypto.randomUUID(),
      type: 'sticky',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      style: { width: 256, height: 256 },
      data: { title: 'Untitled', content: '', color: 'bg-yellow-200' },
    };

    // Add locally immediately for fast UI
    addNode(newNode);

    // Save to DB
    try {
      await workspaceApi.upsertCard(workspaceId, newNode);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to create sticky in DB', err);
    }
  };

  const handleExtractLink = async () => {
    if (!linkUrl) return;

    // ── Platform URL validation ──────────────────────────────────────────
    const urlLower = linkUrl.toLowerCase();
    const isYoutubeUrl = urlLower.includes('youtube.com') || urlLower.includes('youtu.be');
    const isInstagramUrl = urlLower.includes('instagram.com');
    const isTikTokUrl = urlLower.includes('tiktok.com');
    const isGoogleDriveUrl = urlLower.includes('docs.google.com/document') || urlLower.includes('docs.google.com/spreadsheets');

    if (activePlatform === 'youtube' && !isYoutubeUrl) {
      setExtractError('This doesn\'t look like a YouTube URL. Please paste a youtube.com or youtu.be link.');
      return;
    }
    if (activePlatform === 'instagram' && !isInstagramUrl) {
      setExtractError('This doesn\'t look like an Instagram URL. Please paste an instagram.com link.');
      return;
    }
    if (activePlatform === 'tiktok' && !isTikTokUrl) {
      setExtractError('This doesn\'t look like a TikTok URL. Please paste a tiktok.com link.');
      return;
    }
    if (activePlatform === 'google_drive' && !isGoogleDriveUrl) {
      setExtractError('This doesn\'t look like a Google Doc or Google Sheet URL. Please paste a docs.google.com link.');
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    setExtracting(true);
    setExtractError('');
    try {
      const extracted = await workspaceApi.extractLink(linkUrl);

      const isYoutube = extracted.type === 'youtube';
      const isShorts = ['instagram', 'tiktok'].includes(extracted.type);
      const isCarousel = extracted.type === 'instagram_carousel';
      const isGoogleDrive = extracted.type === 'google_drive';
      const newNode = {
        id: crypto.randomUUID(),
        type: extracted.type,
        position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
        style: {
          width: ['youtube', 'instagram', 'tiktok', 'instagram_carousel', 'google_drive'].includes(extracted.type) ? 320 : 288,
          height: isYoutube ? 280 : isCarousel ? 420 : isShorts ? 400 : isGoogleDrive ? 400 : 220
        },
        data: extracted,
      };

      addNode(newNode);

      await workspaceApi.upsertCard(workspaceId, newNode);
      useCanvasStore.getState().setLastSaved(new Date());
      setShowLinkModal(false);
      setLinkUrl('');
    } catch (err: any) {
      setExtractError(err.message || 'Failed to extract link');
    } finally {
      setExtracting(false);
    }
  };

  const handleConnect = async (connection: any) => {
    const edgeId = crypto.randomUUID();
    const newEdge = {
      ...connection,
      id: edgeId,
      style: defaultEdgeOptions.style,
      type: defaultEdgeOptions.type,
      animated: defaultEdgeOptions.animated,
    };

    setEdges([...edges, newEdge]);

    try {
      await workspaceApi.createEdge(workspaceId, {
        id: edgeId,
        source_id: connection.source,
        target_id: connection.target,
        source_type: 'card'
      });
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save connection', err);
    }
  };

  const handleAddAnnotation = async () => {
    const newNode = {
      id: crypto.randomUUID(),
      type: 'annotation',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 80 },
      style: { width: 360, height: 60 },
      data: { text: 'Headline', size: 'xl', color: 'white' },
    };
    addNode(newNode);
    try {
      await workspaceApi.upsertCard(workspaceId, newNode);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to create annotation', err);
    }
  };

  // ── Voice Recording Handlers ──────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopAndSaveRecording = async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        clearInterval(timerRef.current!);
        setIsRecording(false);
        setProcessingVoice(true);
        setVoiceStatus('Uploading audio to cloud...');

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const fileName = `${workspaceId}_${Date.now()}.webm`;

          // 1. Upload to Supabase Storage
          const publicUrl = await workspaceApi.uploadVoiceToStorage(audioBlob, fileName);

          setVoiceStatus('AI is listening... (Transcribing)');

          // 2. Transcribe via Gemini
          const { transcript } = await workspaceApi.transcribeVoice(audioBlob);

          setVoiceStatus('Creating Voice Note card...');

          // 3. Create Voice Node
          const newNode = {
            id: crypto.randomUUID(),
            type: 'voice',
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
            style: { width: 320, height: 280 },
            data: {
              customTitle: 'Voice Note',
              content: transcript,
              metadata: { audioUrl: publicUrl }
            },
          };

          addNode(newNode);
          await workspaceApi.upsertCard(workspaceId, newNode);
          useCanvasStore.getState().setLastSaved(new Date());

          setShowVoiceModal(false);
        } catch (err: any) {
          console.error('Failed to process voice note:', err);
          alert(`Failed to save voice note: ${err.message}`);
        } finally {
          setProcessingVoice(false);
          // Stop mic tracks
          mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
          resolve();
        }
      };

      mediaRecorderRef.current!.stop();
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    clearInterval(timerRef.current!);
    setIsRecording(false);
    setShowVoiceModal(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  // ─────────────────────────────────────────────────────────────────────

  const onNodeDragStop = useCallback(
    async (event: any, node: any) => {
      try {
        await workspaceApi.upsertCard(workspaceId, node);
        useCanvasStore.getState().setLastSaved(new Date());
      } catch (err) {
        console.error('Failed to save position', err);
      }
    },
    [workspaceId]
  );

  const isValidConnection = useCallback((connection: any) => {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    // Annotation nodes have no handles — block all connections involving them
    if (sourceNode?.type === 'annotation' || targetNode?.type === 'annotation') {
      return false;
    }

    // Media assets (youtube, instagram, tiktok, carousel, voice, google_drive) can only be sources, not targets of each other
    const mediaTypes = ['youtube', 'instagram', 'tiktok', 'instagram_carousel', 'voice', 'google_drive'];
    if (sourceNode && targetNode && mediaTypes.includes(sourceNode.type || '') && mediaTypes.includes(targetNode.type || '')) {
      return false;
    }

    // Prevent connecting sticky notes to other sticky notes
    if (sourceNode?.type === 'sticky' && targetNode?.type === 'sticky') {
      return false;
    }

    return true;
  }, [nodes]);

  return (
    <div className="w-full h-full bg-black/40">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        panOnDrag={false}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        panOnScroll={true}
        className="touch-none"
      >
        <div className="opacity-10 absolute inset-0 pointer-events-none">
          <Background color="#aa3bff" gap={24} size={1} />
        </div>
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'sticky') return '#eab308';
            if (n.type === 'website') return '#3b82f6';
            if (n.type === 'youtube') return '#ef4444';
            if (n.type === 'instagram') return '#e1306c';
            if (n.type === 'tiktok') return '#00f2fe';
            if (n.type === 'instagram_carousel') return '#c026d3';
            return '#333';
          }}
          className="bg-black/50 border border-white/10 rounded-lg overflow-hidden"
          maskColor="rgba(0,0,0,0.5)"
        />

        <Panel position="bottom-center" className="mb-4">
          <div className="flex items-center gap-1 bg-black/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl">
            {/* Sticky */}
            <button
              onClick={handleAddSticky}
              className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors font-medium text-yellow-400"
            >
              <Plus className="w-4 h-4" /> Sticky
            </button>

            <div className="w-px h-5 bg-white/10" />

            {/* YouTube */}
            <button
              onClick={() => openPlatformModal('youtube')}
              className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/10 rounded-xl transition-colors font-medium text-red-400"
            >
              <PlayCircle className="w-4 h-4" /> YouTube
            </button>

            <div className="w-px h-5 bg-white/10" />

            {/* Instagram */}
            <button
              onClick={() => openPlatformModal('instagram')}
              className="flex items-center gap-2 px-4 py-2 hover:bg-pink-500/10 rounded-xl transition-colors font-medium text-pink-400"
            >
              <Camera className="w-4 h-4" /> Instagram
            </button>

            <div className="w-px h-5 bg-white/10" />

            {/* TikTok */}
            <button
              onClick={() => openPlatformModal('tiktok')}
              className="flex items-center gap-2 px-4 py-2 hover:bg-cyan-400/10 rounded-xl transition-colors font-medium text-cyan-400"
            >
              <Music2 className="w-4 h-4" /> TikTok
            </button>

            <div className="w-px h-5 bg-white/10" />

            {/* Annotation */}
            <button
              onClick={handleAddAnnotation}
              className="flex items-center gap-2 px-4 py-2 hover:bg-orange-400/10 rounded-xl transition-colors font-medium text-orange-400"
            >
              <Type className="w-4 h-4" /> Annotation
            </button>
            {/* Voice Note */}
            <button
              onClick={() => setShowVoiceModal(true)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-purple-500/10 rounded-xl transition-colors font-medium text-purple-400"
            >
              <Mic className="w-4 h-4" /> Voice Note
            </button>

            <div className="w-px h-5 bg-white/10" />

            {/* Google Drive */}
            <button
              onClick={() => openPlatformModal('google_drive')}
              className="flex items-center gap-2 px-4 py-2 hover:bg-blue-500/10 rounded-xl transition-colors font-medium text-blue-400"
            >
              <HardDrive className="w-4 h-4" /> Google Drive
            </button>
          </div>
        </Panel>
      </ReactFlow>

      {/* Voice Recording Modal */}
      {showVoiceModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] border border-purple-500/30 rounded-3xl p-8 w-full max-w-sm shadow-[0_0_50px_-12px_rgba(168,85,247,0.3)] flex flex-col items-center gap-6 relative overflow-hidden">

            {/* Animated background glow during recording */}
            {isRecording && !processingVoice && (
              <div className="absolute inset-0 bg-purple-500/10 animate-pulse pointer-events-none" />
            )}

            <div className="text-center z-10 w-full">
              <h2 className="text-xl font-bold text-white mb-2">Voice Note</h2>
              <p className="text-sm text-gray-400">
                {processingVoice ? 'Processing your voice...' : isRecording ? 'Recording in progress...' : 'Ready to record'}
              </p>
            </div>

            {/* Main Visualizer Area */}
            <div className="relative w-32 h-32 flex items-center justify-center z-10">
              {processingVoice ? (
                // Processing Animation
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-24 h-24 border-4 border-purple-500/20 rounded-full" />
                  <div className="absolute w-24 h-24 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <Mic className="w-8 h-8 text-purple-400 animate-pulse" />
                </div>
              ) : isRecording ? (
                // Recording Animation (Waveform)
                <div className="flex items-center justify-center gap-1.5 h-16 w-full">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-purple-400 rounded-full animate-[wave_1s_ease-in-out_infinite]"
                      style={{
                        height: '100%',
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: `${0.8 + Math.random() * 0.5}s`
                      }}
                    />
                  ))}
                </div>
              ) : (
                // Idle Mic Button
                <button
                  onClick={startRecording}
                  className="w-24 h-24 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group"
                >
                  <Mic className="w-10 h-10 text-purple-400 group-hover:text-purple-300" />
                </button>
              )}
            </div>

            {/* Timer */}
            <div className="text-3xl font-mono font-light text-white z-10 tracking-widest">
              {formatTime(recordingTime)}
            </div>

            {/* Status / Controls */}
            <div className="w-full flex flex-col gap-3 z-10">
              {processingVoice ? (
                <div className="text-center py-2 text-purple-300 text-sm font-medium animate-pulse">
                  {voiceStatus}
                </div>
              ) : isRecording ? (
                <div className="flex gap-3">
                  <button
                    onClick={cancelRecording}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={stopAndSaveRecording}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4 fill-current" /> Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={cancelRecording}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-medium transition-colors"
                >
                  Close
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Platform URL Modal */}
      {showLinkModal && (() => {
        const cfg = PLATFORM_CONFIG[activePlatform];
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`bg-[#18181b] border rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 ${cfg.border} shadow-lg`}>
              {/* Modal header */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5 ${cfg.color}`}>
                  {cfg.icon}
                </div>
                <div>
                  <h2 className={`text-base font-semibold ${cfg.color}`}>Add {cfg.label}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{cfg.hint}</p>
                </div>
              </div>

              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && linkUrl && !extracting) handleExtractLink(); }}
                placeholder={cfg.placeholder}
                className={`w-full bg-black/50 border rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder:text-gray-600 ${cfg.border} focus:ring-0`}
                autoFocus
              />

              {extractError && (
                <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {extractError}
                </p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowLinkModal(false); setLinkUrl(''); setExtractError(''); }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExtractLink}
                  disabled={!linkUrl || extracting}
                  className={`px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all flex items-center gap-2 shadow-lg ${cfg.accent}`}
                >
                  {extracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</>
                  ) : (
                    <>Add {cfg.label}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
