import React, { useState } from 'react';
import BottomSheet from './BottomSheet';
import { PlayCircle, Camera, Music2, Globe, FileText, Image as ImageIcon, Mic, StickyNote, BrainCircuit, Layers, Check, Video, Type, HardDrive, MessageSquare, Plus } from 'lucide-react';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

interface CreationMenuProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onRecordVoice: () => void;
}

const CREATION_OPTIONS = [
  { id: 'group', label: 'Group', icon: Layers, color: 'text-gray-100', bg: 'bg-white/10' },
  { id: 'sticky', label: 'Sticky Note', icon: Plus, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 'document', label: 'Rich Text', icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'ai_chat', label: 'AI Assistant', icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  { id: 'youtube', label: 'YouTube', icon: PlayCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  { id: 'instagram', label: 'Instagram', icon: Camera, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'tiktok', label: 'TikTok', icon: Music2, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  { id: 'loom', label: 'Loom', icon: Video, color: 'text-[#625DF5]', bg: 'bg-[#625DF5]/10' },
  { id: 'voice', label: 'Voice Note', icon: Mic, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { id: 'google_drive', label: 'Google Drive', icon: HardDrive, color: 'text-blue-500', bg: 'bg-blue-500/10' }
];

export default function CreationMenu({ workspaceId, isOpen, onClose, onRecordVoice }: CreationMenuProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Create nodes directly (we bypass the Canvas.tsx logic and recreate the relevant parts for mobile)
  const handleCreate = async (overrideType?: string) => {
    const typeToCreate = typeof overrideType === 'string' ? overrideType : selectedOption;
    if (!typeToCreate) return;
    setIsLoading(true);

    try {
      const nodeId = crypto.randomUUID();
      let newNode: any = {
        id: nodeId,
        type: typeToCreate,
        // Mobile nodes still need position to not crash desktop view, we just put them somewhere near origin
        position: { x: Math.random() * 200, y: Math.random() * 200 },
        data: { title: 'Untitled', content: '' },
      };

      if (['youtube', 'instagram', 'tiktok', 'loom', 'google_drive'].includes(typeToCreate)) {
        if (!urlInput.trim()) {
          setIsLoading(false);
          return;
        }
        // First create processing placeholder
        newNode.data = { status: 'processing', metadata: { title: 'Extracting...' }, content: 'Extraction in progress...' };
        useCanvasStore.getState().addNode(newNode);
        await workspaceApi.upsertCard(workspaceId, newNode);

        // Run background extraction
        workspaceApi.extractLink(urlInput).then(async (extracted) => {
          const finalNode = {
            ...newNode,
            type: extracted.type || typeToCreate,
            data: { ...extracted, status: 'completed' }
          };
          // Update store directly
          useCanvasStore.getState().setNodes(
            useCanvasStore.getState().nodes.map(n => n.id === nodeId ? finalNode : n)
          );
          await workspaceApi.upsertCard(workspaceId, finalNode);
          useCanvasStore.getState().setLastSaved(new Date());
        }).catch(err => {
          console.error("Extraction error", err);
          // Update to error state
          const errorNode = {
            ...newNode,
            data: { status: 'error', metadata: { title: 'Extraction Failed' }, content: err.message }
          };
          useCanvasStore.getState().setNodes(
            useCanvasStore.getState().nodes.map(n => n.id === nodeId ? errorNode : n)
          );
          workspaceApi.upsertCard(workspaceId, errorNode).catch(console.error);
        });

      } else {
        // Simple nodes (Note, Document, Group, Chat)
        if (typeToCreate === 'ai_chat') {
          newNode.data.title = 'AI Assistant';
        } else if (typeToCreate === 'group') {
          newNode.data.title = 'New Group';
          newNode.data.count = 0;
        } else if (typeToCreate === 'document') {
          newNode.data.content = '<h1>Untitled Document</h1><p>Start writing here...</p>';
        }

        useCanvasStore.getState().addNode(newNode);
        await workspaceApi.upsertCard(workspaceId, newNode);
        useCanvasStore.getState().setLastSaved(new Date());
      }

      resetAndClose();
    } catch (err) {
      console.error("Creation error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setSelectedOption(null);
    setUrlInput('');
    setIsLoading(false);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={resetAndClose} title={selectedOption ? 'Details' : 'Create Asset'}>
      {!selectedOption ? (
        <div className="grid grid-cols-3 gap-y-6 gap-x-2">
          {CREATION_OPTIONS.map(opt => (
            <div
              key={opt.id}
              className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform"
              onClick={() => {
                if (['youtube', 'instagram', 'tiktok', 'loom', 'google_drive'].includes(opt.id)) {
                  setSelectedOption(opt.id);
                } else if (opt.id === 'voice') {
                  onRecordVoice();
                  onClose();
                } else {
                  // Instant creation
                  handleCreate(opt.id);
                }
              }}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 ${opt.bg}`}>
                <opt.icon className={`w-6 h-6 ${opt.color}`} />
              </div>
              <span className="text-[11px] font-medium text-gray-300">{opt.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-2">
          {['youtube', 'instagram', 'tiktok', 'loom', 'google_drive'].includes(selectedOption) && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-medium ml-1">Paste URL</label>
              <input
                type="url"
                autoFocus
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={`https://${selectedOption}.com/...`}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isLoading || (['youtube', 'instagram', 'tiktok', 'loom', 'google_drive'].includes(selectedOption) && !urlInput.trim())}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3.5 font-semibold mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-colors active:scale-[0.98]"
          >
            {isLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
