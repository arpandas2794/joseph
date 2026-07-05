import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { workspaceApi } from '../../lib/api';
import { Plus, PlayCircle, Camera, Layers, BrainCircuit, FileText, LayoutGrid, Globe, Mic, HardDrive, Video, StickyNote, Search } from 'lucide-react';
import AssetCard from './AssetCard';
import MobileGroupCard from './MobileGroupCard';
import MobileChatCard from './MobileChatCard';
import CreationMenu from './CreationMenu';
import ActionMenu from './ActionMenu';
import MobileChatScreen from './MobileChatScreen';
import MobileNoteScreen from './MobileNoteScreen';
import MobileAssetViewer from './MobileAssetViewer';
import VoiceRecordingModal from '../shared/VoiceRecordingModal';

interface MobileWorkspaceProps {
  workspaceId: string;
}

const FILTER_TABS = [
  { id: 'all', label: 'All', icon: LayoutGrid, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'ai_chat', label: 'Chats', icon: BrainCircuit, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'youtube', label: 'YouTube', icon: PlayCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  { id: 'instagram', label: 'Instagram', icon: Camera, color: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  { id: 'group', label: 'Groups', icon: Layers, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  { id: 'note', label: 'Notes', icon: StickyNote, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { id: 'document', label: 'Rich Text', icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'voice', label: 'Voice', icon: Mic, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { id: 'google_drive', label: 'Drive', icon: HardDrive, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { id: 'loom', label: 'Loom', icon: Video, color: 'text-[#625DF5]', bg: 'bg-[#625DF5]/10', border: 'border-[#625DF5]/20' }
];

export default function MobileWorkspace({ workspaceId }: MobileWorkspaceProps) {
  const { nodes, edges, setNodes, setEdges } = useCanvasStore();

  // State for Menus
  const [isCreationMenuOpen, setIsCreationMenuOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [actionNode, setActionNode] = useState<any>(null);
  const [activeChatNode, setActiveChatNode] = useState<any>(null);
  const [activeNoteNode, setActiveNoteNode] = useState<any>(null);
  const [activeViewerNode, setActiveViewerNode] = useState<any>(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMenuInitialView, setActionMenuInitialView] = useState<'actions' | 'connect_chat' | 'rename' | 'move_to_group'>('actions');

  useEffect(() => {
    workspaceApi.getWorkspaceData(workspaceId).then((data) => {
      // Map DB cards to store nodes (we reuse the same structure so they are compatible)
      const initialNodes = data.cards.map((card: any) => ({
        id: card.id,
        type: card.type,
        position: { x: card.x, y: card.y },
        data: card.data || {},
        parentId: card.data?.parentId || undefined,
      }));
      setNodes(initialNodes);

      const initialEdges = data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source_id,
        target: edge.target_chat_id,
      }));
      setEdges(initialEdges);
    }).catch(console.error);
  }, [workspaceId, setNodes, setEdges]);

  // If a chat is active, render the full-screen chat component
  if (activeChatNode) {
    return <MobileChatScreen workspaceId={workspaceId} chatNode={activeChatNode} onBack={() => setActiveChatNode(null)} />;
  }

  // If a note/document is active, render the full-screen note editor
  if (activeNoteNode) {
    return <MobileNoteScreen workspaceId={workspaceId} node={activeNoteNode} onBack={() => setActiveNoteNode(null)} />;
  }

  // If a media asset is active, render the full-screen viewer
  if (activeViewerNode) {
    return <MobileAssetViewer node={activeViewerNode} onBack={() => setActiveViewerNode(null)} />;
  }

  const handleDelete = async (node: any) => {
    try {
      await workspaceApi.deleteCard(node.id);
      useCanvasStore.getState().removeNode(node.id);
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const handleSwipeConnect = (node: any) => {
    setActionNode(node);
    setActionMenuInitialView('connect_chat');
    setIsCreationMenuOpen(false); // ensure others are closed
  };

  // Root nodes (not inside a group)
  const rootNodes = nodes.filter(n => {
    if (n.parentId || n.type === 'annotation') return false;

    if (activeFilter === 'all') { } // Skip filter
    else if (activeFilter === 'note' && n.type !== 'sticky') return false;
    else if (activeFilter === 'instagram' && n.type !== 'instagram' && n.type !== 'instagram_carousel') return false;
    else if (activeFilter !== 'all' && activeFilter !== 'note' && activeFilter !== 'instagram' && n.type !== activeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (n.data?.customTitle || n.data?.title || n.data?.metadata?.title || n.data?.name || '').toLowerCase();
      if (!title.includes(q)) return false;
    }

    return true;
  });

  return (
    <div className="w-full h-full relative flex flex-col bg-[#121214]">
      {/* Search Bar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 bg-[#121214] z-10">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Filter Pill Bar */}
      <div className="flex-shrink-0 border-b border-white/5 bg-[#121214] z-10 pt-2 pb-3 px-4">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {FILTER_TABS.map(tab => {
            const isActive = activeFilter === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all whitespace-nowrap flex-shrink-0 ${isActive
                    ? `${tab.bg} ${tab.border} ${tab.color} shadow-lg shadow-black/20`
                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? '' : 'opacity-70'}`} />
                <span className="text-sm font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 pb-28 custom-scrollbar">
        {rootNodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
            <LayoutGrid className="w-12 h-12 mb-4 text-white/10" />
            <p className="text-[15px] font-medium text-white mb-1">No assets found</p>
            <p className="text-sm">Tap the + button to add a {FILTER_TABS.find(t => t.id === activeFilter)?.label.toLowerCase()} asset.</p>
          </div>
        ) : (
          rootNodes.map(node => {
            if (node.type === 'group') {
              return (
                <MobileGroupCard
                  key={node.id}
                  node={node}
                  onOpenActions={(n) => {
                    setActionNode(n);
                    setActionMenuInitialView('actions');
                  }}
                  onTapAsset={(n) => {
                    if (n.type === 'ai_chat') setActiveChatNode(n);
                    else if (n.type === 'document' || n.type === 'sticky') setActiveNoteNode(n);
                    else setActiveViewerNode(n);
                  }}
                  onDelete={() => handleDelete(node)}
                  onDeleteChild={(childNode) => handleDelete(childNode)}
                  onConnectChild={(childNode) => handleSwipeConnect(childNode)}
                />
              );
            }
            if (node.type === 'ai_chat') {
              return (
                <MobileChatCard
                  key={node.id}
                  node={node}
                  onOpenActions={(n) => {
                    setActionNode(n);
                    setActionMenuInitialView('actions');
                  }}
                  onTap={(n) => setActiveChatNode(n)}
                  onDelete={() => handleDelete(node)}
                />
              );
            }
            return (
              <AssetCard
                key={node.id}
                node={node}
                onOpenActions={(n) => {
                  setActionNode(n);
                  setActionMenuInitialView('actions');
                }}
                onTap={(n) => {
                  if (n.type === 'document' || n.type === 'sticky') setActiveNoteNode(n);
                  else setActiveViewerNode(n);
                }}
                onDelete={() => handleDelete(node)}
                onConnectToChat={() => handleSwipeConnect(node)}
              />
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsCreationMenuOpen(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-[0_4px_24px_rgba(79,70,229,0.4)] hover:bg-indigo-500 transition-colors z-[90]"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Menus */}
      <CreationMenu
        workspaceId={workspaceId}
        isOpen={isCreationMenuOpen}
        onClose={() => setIsCreationMenuOpen(false)}
        onRecordVoice={() => setIsVoiceModalOpen(true)}
      />

      <VoiceRecordingModal
        workspaceId={workspaceId}
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        defaultPosition={{ x: Math.random() * 50, y: Math.random() * 50 }}
      />

      {actionNode && (
        <ActionMenu
          workspaceId={workspaceId}
          node={actionNode}
          isOpen={!!actionNode}
          initialView={actionMenuInitialView}
          onClose={() => {
            setActionNode(null);
            setActionMenuInitialView('actions');
          }}
        />
      )}
    </div>
  );
}
