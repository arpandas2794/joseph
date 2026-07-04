import React, { useState, useRef } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import SmartHandle from './SmartHandle';
import { Trash2, FileText, Film, Loader2, AlertCircle } from 'lucide-react';
import UngroupButton from './UngroupButton';
import { useParams } from 'react-router-dom';
import { workspaceApi } from '../../lib/api';
import { useCanvasStore } from '../../store/canvasStore';

export default function TiktokNode({ id, data, selected }: { id: string, data: any, selected?: boolean }) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const removeNode = useCanvasStore((state) => state.removeNode);
  const [showTranscript, setShowTranscript] = useState(false);
  const [customTitle, setCustomTitle] = useState(data.customTitle || 'TikTok');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = (newTitle: string) => {
    useCanvasStore.getState().setNodes(useCanvasStore.getState().nodes.map(node => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, customTitle: newTitle } };
      }
      return node;
    }));

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    
    saveTimeout.current = setTimeout(() => {
      if (!workspaceId) return;
      workspaceApi.updateCardData(workspaceId, id, { ...data, customTitle: newTitle })
        .then(() => useCanvasStore.getState().setLastSaved(new Date()))
        .catch(err => console.error("Failed to save custom title:", err));
    }, 1000);
  };

  const handleDelete = async () => {
    if (!workspaceId) return;
    try {
      await workspaceApi.deleteCard(id);
      removeNode(id);
      useCanvasStore.getState().setLastSaved(new Date());
    } catch (err) {
      console.error("Failed to delete TikTok node:", err);
    }
  };

  const handleResizeEnd = (evt: any, params: any) => {
    if (!workspaceId) return;
    workspaceApi.upsertCard(workspaceId, {
      id,
      type: 'tiktok',
      position: { x: params.x, y: params.y },
      width: params.width,
      height: params.height,
      data
    }).then(() => useCanvasStore.getState().setLastSaved(new Date())).catch(console.error);
  };

  const { url, title, channel, thumbnail } = data.metadata || {};

  return (
    <>
      <NodeResizer 
        color="#00f2fe" 
        isVisible={selected} 
        minWidth={280} 
        minHeight={200}
        onResizeEnd={handleResizeEnd}
      />
      <div 
        className={`w-full h-full bg-[#18181b] text-white rounded-xl shadow-2xl border flex flex-col overflow-hidden transition-all duration-200 ${
          selected ? 'border-cyan-400 shadow-cyan-400/20' : 'border-white/10'
        }`}
      >
        {/* Header */}
        <div className="h-12 flex-shrink-0 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Film className="w-4 h-4 text-[#fe2c55] flex-shrink-0" />
            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                triggerSave(e.target.value);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="bg-transparent text-xs font-semibold uppercase tracking-wider text-gray-300 border-none outline-none focus:ring-0 w-full min-w-0 placeholder:text-gray-500 cursor-text hover:text-white focus:text-white transition-colors"
              placeholder="TikTok"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-1 rounded transition-colors text-xs flex items-center gap-1 font-medium ${showTranscript ? 'bg-[#00f2fe]/20 text-[#00f2fe]' : 'text-gray-400 hover:text-white bg-white/5'}`}
              title="Toggle Transcript"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Transcript</span>
            </button>
            
            <UngroupButton />
            
            <button 
              onClick={handleDelete}
              className="text-red-500 hover:text-red-400 p-1 rounded-md hover:bg-white/5 transition-colors"
              title="Delete TikTok card"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 w-full bg-black relative min-h-0">
          {data.status === 'processing' && (
            <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="text-sm font-medium text-white shadow-black drop-shadow-md">Processing Transcript...</span>
            </div>
          )}
          {data.status === 'error' && (
            <div className="absolute inset-0 z-20 bg-red-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <span className="text-sm font-medium text-red-200 line-clamp-3">{data.content || 'Extraction failed'}</span>
            </div>
          )}

          {showTranscript ? (
            <div 
              className="absolute inset-0 p-4 overflow-y-auto text-xs text-gray-300 bg-[#0f0f12] select-text nowheel custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              <h4 className="font-semibold text-gray-200 mb-2 font-mono text-cyan-400">TikTok Transcript (AI Extracted):</h4>
              <p className="leading-relaxed whitespace-pre-wrap">
                {data.content || "No transcript found or transcript is empty."}
              </p>
            </div>
          ) : (
            thumbnail ? (
              <div className="w-full h-full relative group">
                <img src={thumbnail} alt="Preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <a 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="px-5 py-2.5 bg-[#fe2c55] hover:bg-[#fe2c55]/85 text-white rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <Film className="w-4 h-4" />
                    Open TikTok Video
                  </a>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-500 text-sm p-4 text-center">
                <Film className="w-8 h-8 text-[#fe2c55]/50" />
                <span>TikTok Video</span>
                <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                  Open Original Link
                </a>
              </div>
            )
          )}
        </div>

        {/* Footer Info */}
        <div className="h-14 flex-shrink-0 p-3 bg-black/40 border-t border-white/5 flex flex-col justify-center">
          <h3 className="font-medium text-sm leading-tight truncate" title={title}>
            {title || 'TikTok Video'}
          </h3>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {channel || 'Unknown User'}
          </p>
        </div>

        <SmartHandle type="source" position={Position.Right} className="!bg-[#00f2fe] !w-3 !h-3 !border-2 !border-black" />
      </div>
    </>
  );
}
