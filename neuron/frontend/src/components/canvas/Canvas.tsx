import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  SelectionMode,
  BackgroundVariant,
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
import LoomNode from './LoomNode';
import DottedDeleteEdge from './DottedDeleteEdge';
import { Plus, PlayCircle, Camera, Music2, Loader2, Type, Mic, Square, Circle, HardDrive, Video, Layers } from 'lucide-react';
import { workspaceApi } from '../../lib/api';
import { layoutGroupChildren } from '../../utils/gridLayout';

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'google_drive' | 'loom' | 'instagram_carousel';

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
  instagram_carousel: {
    label: 'Instagram Carousel',
    icon: <Camera className="w-4 h-4" />,
    color: 'bg-pink-500',
    border: 'border-pink-500/20',
    accent: 'text-pink-500',
    placeholder: 'Paste Instagram Carousel URL...',
    hint: 'Works with public carousels'
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
  },
  loom: {
    label: 'Loom',
    icon: <Video className="w-4 h-4" />,
    color: 'text-[#625DF5]',
    border: 'border-[#625DF5]',
    accent: 'bg-[#625DF5] hover:bg-[#514deb] shadow-[#625DF5]/20',
    placeholder: 'https://www.loom.com/share/...',
    hint: 'Paste a Loom video URL to extract the transcript.',
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
  loom: LoomNode,
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
  const [isGroupingMode, setIsGroupingMode] = React.useState(false);

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
        parentId: card.data?.parentId || undefined,
      }));
      initialNodes.sort((a: any, b: any) => (a.type === 'group' ? -1 : 1) - (b.type === 'group' ? -1 : 1));
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

  const handleToggleGroupMode = () => {
    setIsGroupingMode(true);
    setNodes(nodes.map(n => ({ ...n, selected: false })));
  };

  const onSelectionEnd = useCallback(() => {
    if (!isGroupingMode) return;
    
    const state = useCanvasStore.getState();
    const currentNodes = state.nodes;
    const selectedNodes = currentNodes.filter(n => n.selected && n.type !== 'group' && n.type !== 'annotation' && !n.parentId);
    
    if (selectedNodes.length === 0) {
      setIsGroupingMode(false);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach(n => {
      const w = Number(n.style?.width || 256);
      const h = Number(n.style?.height || 256);
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
      if (n.position.x + w > maxX) maxX = n.position.x + w;
      if (n.position.y + h > maxY) maxY = n.position.y + h;
    });

    const paddingX = 40;
    const paddingYTop = 60;
    const paddingYBottom = 40;

    const groupX = minX - paddingX;
    const groupY = minY - paddingYTop;
    const groupW = (maxX - minX) + (paddingX * 2);
    const groupH = (maxY - minY) + paddingYTop + paddingYBottom;
    const groupId = crypto.randomUUID();

    const newGroupNode = {
      id: groupId,
      type: 'group',
      position: { x: groupX, y: groupY },
      style: { width: groupW, height: groupH, zIndex: -1 },
      data: { title: 'Untitled Group', count: selectedNodes.length },
    };

    let groupChildren = currentNodes
      .filter(n => selectedNodes.some(sn => sn.id === n.id))
      .map(n => ({
        ...n,
        parentId: groupId,
        data: { ...n.data, originalPosition: (n as any).positionAbsolute || n.position },
        selected: false,
      }));

    const { updatedChildren, newGroupStyle } = layoutGroupChildren(newGroupNode, groupChildren);
    newGroupNode.style = newGroupStyle as any;

    const updatedNodes = currentNodes.map(n => {
      const childMatch = updatedChildren.find(c => c.id === n.id);
      if (childMatch) return childMatch;
      return n;
    });

    // Group node MUST come before its children in the nodes array for React Flow to bind them correctly
    state.setNodes([newGroupNode, ...updatedNodes]);
    setIsGroupingMode(false);

    try {
      workspaceApi.upsertCard(workspaceId, newGroupNode);
      Promise.all(updatedChildren.map(c => workspaceApi.upsertCard(workspaceId, c)));
      state.setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to save group', err);
    }
  }, [isGroupingMode, workspaceId]);

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
    const isLoomUrl = urlLower.includes('loom.com/share');

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
    if (activePlatform === 'loom' && !isLoomUrl) {
      setExtractError('This doesn\'t look like a Loom URL. Please paste a loom.com/share/ link.');
      return;
    }
    // ─────────────────────────────────────────────────────────────────────

    const nodeId = crypto.randomUUID();
    
    // --- Immediate UI Update ---
    let initialData: any = { status: 'processing', metadata: { title: 'Extracting...' }, content: 'Extraction in progress...' };
    let initialType = activePlatform || 'website';
    let width = 320;
    let height = 280;

    if (activePlatform === 'youtube') {
      // Try to parse video ID immediately for thumbnail
      let videoId = '';
      if (linkUrl.includes('youtu.be/')) {
        videoId = linkUrl.split('youtu.be/')[1]?.split('?')[0];
      } else if (linkUrl.includes('youtube.com/watch')) {
        try {
          const urlParams = new URLSearchParams(new URL(linkUrl).search);
          videoId = urlParams.get('v') || '';
        } catch(e) {}
      }
      initialData = {
        type: 'youtube',
        status: 'processing',
        metadata: {
          videoId: videoId || 'unknown',
          title: 'Processing Transcript...',
          channel: 'Fetching details...'
        },
        content: 'Transcription in progress... please wait.'
      };
      height = 280;
    } else if (activePlatform === 'loom') {
      let videoId = '';
      if (linkUrl.includes('loom.com/share/')) {
        videoId = linkUrl.split('loom.com/share/')[1]?.split('?')[0];
      }
      initialData = {
        type: 'loom',
        status: 'processing',
        metadata: {
          videoId,
          title: 'Processing Transcript...',
          channel: 'Fetching details...'
        },
        content: 'Transcription in progress... please wait.'
      };
      height = 280;
    } else if (activePlatform === 'instagram') {
      const isCarousel = linkUrl.includes('/p/');
      initialType = isCarousel ? 'instagram_carousel' : 'instagram';
      initialData = {
        type: initialType,
        status: 'processing',
        metadata: {
          title: isCarousel ? 'Extracting Slides...' : 'Processing Reel...',
        },
        content: isCarousel ? 'Reading text from images...' : 'Transcription in progress...'
      };
      height = isCarousel ? 420 : 400;
    } else if (activePlatform === 'tiktok') {
      initialType = 'tiktok';
      initialData = {
        type: initialType,
        status: 'processing',
        metadata: {
          title: 'Processing TikTok...',
        },
        content: 'Transcription in progress...'
      };
      height = 400;
    } else {
      height = 400; // default for shorts/reels
    }

    const newNode = {
      id: nodeId,
      type: initialType,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      style: { width, height },
      data: initialData,
    };

    // Immediately add to canvas and DB so the user sees it
    addNode(newNode);
    try {
      await workspaceApi.upsertCard(workspaceId, newNode);
    } catch (err) {
      console.error('Failed to create placeholder node in DB', err);
    }
    
    // Close modal instantly
    setShowLinkModal(false);
    setLinkUrl('');
    setExtractError('');
    setExtracting(false); // We can unset this since modal is gone

    // --- Background Extraction Process ---
    // Do NOT await this so the function returns and UI doesn't block
    workspaceApi.extractLink(linkUrl).then(async (extracted) => {
      const isYoutube = extracted.type === 'youtube';
      const isShorts = ['instagram', 'tiktok'].includes(extracted.type);
      const isCarousel = extracted.type === 'instagram_carousel';
      const isGoogleDrive = extracted.type === 'google_drive';
      
      const finalNode = {
        ...newNode,
        type: extracted.type,
        style: {
          width: ['youtube', 'instagram', 'tiktok', 'instagram_carousel', 'google_drive', 'loom'].includes(extracted.type) ? 320 : 288,
          height: isYoutube || extracted.type === 'loom' ? 280 : isCarousel ? 420 : isShorts ? 400 : isGoogleDrive ? 400 : 220
        },
        data: { ...extracted, status: 'completed' },
      };

      // Update the node locally
      useCanvasStore.getState().setNodes(
        useCanvasStore.getState().nodes.map(n => n.id === nodeId ? finalNode : n)
      );

      // Save final node to DB
      await workspaceApi.upsertCard(workspaceId, finalNode);
      useCanvasStore.getState().setLastSaved(new Date());

    }).catch((err) => {
      console.error('Extraction failed in background:', err);
      // Update node to show error
      const errorNode = {
        ...newNode,
        data: {
          ...newNode.data,
          status: 'error',
          content: 'Extraction failed: ' + (err.message || 'Unknown error'),
          metadata: { ...newNode.data.metadata, title: 'Extraction Failed' }
        }
      };
      useCanvasStore.getState().setNodes(
        useCanvasStore.getState().nodes.map(n => n.id === nodeId ? errorNode : n)
      );
      workspaceApi.upsertCard(workspaceId, errorNode).catch(console.error);
    });
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
        const state = useCanvasStore.getState();
        const currentNodes = state.nodes;
        let updatedNode = { ...node };

        // Handle dropping into/out of groups
        if (updatedNode.type !== 'group' && updatedNode.type !== 'annotation') {
          let skipGroupLogic = false;
          if (updatedNode.parentId) {
            const parentNode = currentNodes.find(n => n.id === updatedNode.parentId);
            if (parentNode && parentNode.selected) {
              skipGroupLogic = true;
            }
          }

          if (!skipGroupLogic) {
            const groupNodes = currentNodes.filter(n => n.type === 'group' && n.id !== updatedNode.id);
          const droppedGroup = groupNodes.find(g => {
            const gX = g.position.x;
            const gY = g.position.y;
            const gW = Number(g.style?.width || 0);
            const gH = Number(g.style?.height || 0);
            let absX = updatedNode.position.x;
            let absY = updatedNode.position.y;
            if (updatedNode.parentId) {
              const p = currentNodes.find(n => n.id === updatedNode.parentId);
              if (p) {
                absX += p.position.x;
                absY += p.position.y;
              }
            }
const nX = (updatedNode as any).positionAbsolute?.x || absX;
const nY = (updatedNode as any).positionAbsolute?.y || absY;
            
            // Check if center of dragged node is inside the group bounds
            const nodeW = Number(updatedNode.style?.width || 256);
            const nodeH = Number(updatedNode.style?.height || 256);
            const centerX = nX + (nodeW / 2);
            const centerY = nY + (nodeH / 2);

            return centerX >= gX && centerX <= gX + gW && centerY >= gY && centerY <= gY + gH;
          });

          if (droppedGroup && updatedNode.parentId !== droppedGroup.id) {
            
            // Need absolute coords for accurate relative math
            let absX = updatedNode.position.x;
            let absY = updatedNode.position.y;
            if (updatedNode.parentId) {
              const p = currentNodes.find(n => n.id === updatedNode.parentId);
              if (p) {
                absX += p.position.x;
                absY += p.position.y;
              }
            }
const currentAbsX = (updatedNode as any).positionAbsolute?.x ?? absX;
const currentAbsY = (updatedNode as any).positionAbsolute?.y ?? absY;

            updatedNode.parentId = droppedGroup.id;
            updatedNode.data = { ...updatedNode.data, originalPosition: { x: currentAbsX, y: currentAbsY } };
            
            const groupChildren = currentNodes.filter(n => n.parentId === droppedGroup.id && n.id !== updatedNode.id);
            groupChildren.push(updatedNode);

            const { updatedChildren, newGroupStyle } = layoutGroupChildren(droppedGroup, groupChildren);
            
            const newNodes = currentNodes.map(n => {
              if (n.id === droppedGroup.id) return { ...droppedGroup, style: newGroupStyle };
              const childMatch = updatedChildren.find(c => c.id === n.id);
              if (childMatch) return childMatch;
              return n;
            });
            
            newNodes.sort((a, b) => (a.type === 'group' ? -1 : 1) - (b.type === 'group' ? -1 : 1));
            state.setNodes(newNodes);
            
            workspaceApi.upsertCard(workspaceId, { ...droppedGroup, style: newGroupStyle });
            updatedChildren.forEach(c => workspaceApi.upsertCard(workspaceId, c));
            
          } else if (!droppedGroup && updatedNode.parentId) {
            let absX = updatedNode.position.x;
            let absY = updatedNode.position.y;
            const previousGroupId = updatedNode.parentId;
            const p = currentNodes.find(n => n.id === previousGroupId);
            if (p) {
              absX += p.position.x;
              absY += p.position.y;
            }
            
            updatedNode.parentId = undefined;
            if (updatedNode.data?.originalPosition) {
              updatedNode.position = updatedNode.data.originalPosition;
              const { originalPosition, ...restData } = updatedNode.data;
              updatedNode.data = restData;
            } else {
              updatedNode.position = {
x: (updatedNode as any).positionAbsolute?.x ?? absX,
y: (updatedNode as any).positionAbsolute?.y ?? absY,
              };
            }
            
            const previousGroupNode = currentNodes.find(n => n.id === previousGroupId);
            const remainingChildren = currentNodes.filter(n => n.parentId === previousGroupId && n.id !== updatedNode.id);
            
            let finalNodes = currentNodes.map(n => n.id === updatedNode.id ? updatedNode : n);
            
            if (previousGroupNode) {
              const { updatedChildren, newGroupStyle } = layoutGroupChildren(previousGroupNode, remainingChildren);
              finalNodes = finalNodes.map(n => {
                if (n.id === previousGroupId) return { ...previousGroupNode, style: newGroupStyle };
                const childMatch = updatedChildren.find(c => c.id === n.id);
                if (childMatch) return childMatch;
                return n;
              });
              workspaceApi.upsertCard(workspaceId, { ...previousGroupNode, style: newGroupStyle });
              updatedChildren.forEach(c => workspaceApi.upsertCard(workspaceId, c));
            }
            
            state.setNodes(finalNodes);
          }
        }
      }

        await workspaceApi.upsertCard(workspaceId, updatedNode);
        state.setLastSaved(new Date());
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

    // Group nodes should only connect to Chat nodes
    if (sourceNode?.type === 'group' && targetNode?.type !== 'chat') {
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
        panOnDrag={!isGroupingMode}
        selectionOnDrag={isGroupingMode}
        selectionMode={SelectionMode.Partial}
        onSelectionEnd={onSelectionEnd}
        panOnScroll={true}
        className="touch-none"
      >
        <div className="absolute inset-0 pointer-events-none">
          <Background color="#3f3f46" variant={BackgroundVariant.Dots} gap={20} size={1.5} />
        </div>
        <Controls 
          className="!bg-[#18181b]/80 backdrop-blur-xl !border-white/5 !rounded-2xl !shadow-2xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-b-white/5 [&>button:last-child]:!border-b-0 hover:[&>button]:!bg-white/10 [&>button>svg]:!fill-gray-400 hover:[&>button>svg]:!fill-white transition-all" 
          showInteractive={false} 
        />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'sticky') return '#eab308';
            if (n.type === 'youtube') return '#ef4444';
            if (n.type === 'instagram') return '#e1306c';
            if (n.type === 'tiktok') return '#00f2fe';
            if (n.type === 'instagram_carousel') return '#c026d3';
            if (n.type === 'website') return '#6366f1';
            if (n.type === 'loom') return '#625DF5';
            return '#3f3f46';
          }}
          className="!bg-[#18181b]/90 !border-white/5 !rounded-2xl !shadow-2xl overflow-hidden backdrop-blur-xl"
          maskColor="rgba(0,0,0,0.6)"
          nodeBorderRadius={6}
          nodeStrokeWidth={0}
        />

        <Panel position="bottom-center" className="mb-6">
          <div className="flex items-center gap-2 bg-[#18181b]/90 backdrop-blur-xl border border-white/5 px-4 py-2.5 rounded-2xl shadow-2xl">
            {/* Group */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={handleToggleGroupMode}
                className={`p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 ${
                  isGroupingMode ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'hover:bg-white/10 text-white'
                }`}
              >
                <Layers className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                {isGroupingMode ? 'Draw group box...' : 'Create Group'}
              </span>
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Sticky */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={handleAddSticky}
                className="p-2.5 hover:bg-yellow-500/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-yellow-400"
              >
                <Plus className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                Sticky Note
              </span>
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* YouTube */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={() => openPlatformModal('youtube')}
                className="p-2.5 hover:bg-red-500/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-red-500"
              >
                <PlayCircle className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                YouTube
              </span>
            </div>

            {/* Instagram */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={() => openPlatformModal('instagram')}
                className="p-2.5 hover:bg-pink-500/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-pink-500"
              >
                <Camera className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                Instagram
              </span>
            </div>

            {/* TikTok */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={() => openPlatformModal('tiktok')}
                className="p-2.5 hover:bg-cyan-400/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-cyan-400"
              >
                <Music2 className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                TikTok
              </span>
            </div>

            {/* Loom */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={() => openPlatformModal('loom')}
                className="p-2.5 hover:bg-[#625DF5]/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-[#625DF5]"
              >
                <Video className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                Loom
              </span>
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Annotation */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={handleAddAnnotation}
                className="p-2.5 hover:bg-orange-400/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-orange-400"
              >
                <Type className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                Annotation
              </span>
            </div>

            {/* Voice Note */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={() => setShowVoiceModal(true)}
                className="p-2.5 hover:bg-purple-500/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-purple-400"
              >
                <Mic className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                Voice Note
              </span>
            </div>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {/* Google Drive */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={() => openPlatformModal('google_drive')}
                className="p-2.5 hover:bg-blue-500/10 rounded-xl transition-all hover:scale-105 active:scale-95 text-blue-500"
              >
                <HardDrive className="w-5 h-5" />
              </button>
              <span className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-[#18181b] text-gray-200 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10 shadow-xl">
                Google Drive
              </span>
            </div>
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
